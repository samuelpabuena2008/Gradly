"""Entrena y compara los modelos, y exporta data/pesos.json para la web.

Niveles (del PDF):
  1. Baseline: la nota esperada es el promedio previo del estudiante.
  2. Regresión por materia (Ridge) sobre la malla:

         ŷ(s,c) = μ(c) + b(c) + β(c)·a(s) + Σ w(p→c) · z(s,p)       p recorre los ancestros de c

     μ(c)   media de la materia c
     a(s)   nivel del estudiante: Σ (y_p − μ_p) / (n + K_NIVEL) sobre sus n materias anteriores
     z(s,p) cómo le fue en p frente a su propio nivel: (y_p − μ_p) − a(s)

     La penalización L2 de cada peso crece con la distancia en la malla (ver `penalizaciones`):
     los prerrequisitos oficiales directos dominan y los ancestros lejanos se encogen a cero.
  3. Red neuronal pequeña (1 capa oculta, escrita en NumPy: ver red.py): misma entrada, puede
     captar efectos no lineales.

Validación: GroupKFold por estudiante, así nunca se evalúa con estudiantes del entrenamiento.
Además de pesos.json (lo que lee la web), se exportan los pesos de la red y un bloque
"validacion" con la comparación entre modelos y la calibración del rango y del semáforo.

Uso:
  python -m gradly_model.train                       # simula 300 estudiantes y entrena
  python -m gradly_model.train --notas notas.csv     # CSV con estudiante,materia,periodo,nota
"""

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

from .evaluacion import calibracion, diferencia_mae
from .malla import DATA, ancestros, cargar_malla, distancias_ancestros, predecesores, tipo_arista
from .red import RedNeuronal
from .simulate import simular

MIN_ESTUDIANTES = 10
K_NIVEL = 1.0  # encoge el nivel hacia 0 cuando hay pocas notas: con 1 materia pesa la mitad
SUAVIZADO_MEDIA = 3.0  # notas "virtuales" en la media global al promediar una materia


@dataclass
class DatosCurso:
    materia: str
    previas: list[str]  # prerrequisitos directos y aristas blandas (entrada de la red)
    X: np.ndarray  # (n, k): y_p − ȳ de cada materia previa (0 si no la cursó)
    y: np.ndarray  # (n,): y_c − ȳ
    ybar: np.ndarray  # (n,): promedio previo del estudiante
    grupos: np.ndarray  # (n,): id del estudiante
    ancestros: list[str]  # todas las materias de las que depende (entrada de la regresión)
    H: np.ndarray  # (n, N): notas ANTERIORES en cada materia de la malla, NaN si no la ha cursado


def medias_por_materia(df: pd.DataFrame, malla: dict) -> dict[str, float]:
    """μ(c): media de cada materia (último intento), suavizada hacia la media global.

    El suavizado evita que una materia con dos o tres notas tenga una media poco fiable.
    """
    ultimo = df.sort_values("periodo").drop_duplicates(["estudiante", "materia"], keep="last")
    global_ = float(ultimo["nota"].mean())
    por_materia = ultimo.groupby("materia")["nota"].agg(["sum", "count"])
    mu = {}
    for m in malla["materias"]:
        suma, n = por_materia.loc[m["id"]] if m["id"] in por_materia.index else (0.0, 0)
        mu[m["id"]] = float((suma + SUAVIZADO_MEDIA * global_) / (n + SUAVIZADO_MEDIA))
    return mu


def rasgos(datos: "DatosCurso", malla: dict, mu: dict[str, float]) -> tuple[np.ndarray, np.ndarray]:
    """Nivel a(s) de cada estudiante y matriz z(s,p) para los ancestros de la materia."""
    ids = [m["id"] for m in malla["materias"]]
    medias = np.array([mu[i] for i in ids])
    visto = ~np.isnan(datos.H)
    D = np.where(visto, datos.H - medias, 0.0)
    a = D.sum(axis=1) / (visto.sum(axis=1) + K_NIVEL)
    columnas = [ids.index(p) for p in datos.ancestros]
    Z = np.where(visto[:, columnas], D[:, columnas] - a[:, None], 0.0)
    return a, Z


def preparar(df: pd.DataFrame, malla: dict, materia: str) -> DatosCurso | None:
    """Arma la tabla de entrenamiento de una materia.

    ȳ se calcula solo con materias de periodos ANTERIORES al de la materia objetivo,
    para no usar información del futuro.
    """
    previas = predecesores(malla, materia)
    if not previas:
        return None

    # Si una materia se repitió, cuenta el intento más reciente (igual que la web).
    df = df.sort_values("periodo").drop_duplicates(["estudiante", "materia"], keep="last")

    ids = [m["id"] for m in malla["materias"]]
    filas_X, filas_y, filas_ybar, filas_g, filas_H = [], [], [], [], []
    for estudiante, notas in df.groupby("estudiante"):
        objetivo = notas[notas["materia"] == materia]
        if objetivo.empty:
            continue
        periodo_c = objetivo["periodo"].iloc[0]
        anteriores = notas[notas["periodo"] < periodo_c]
        if anteriores.empty:
            continue
        ybar = anteriores["nota"].mean()
        nota_previa = dict(zip(anteriores["materia"], anteriores["nota"]))
        filas_X.append([nota_previa[p] - ybar if p in nota_previa else 0.0 for p in previas])
        filas_y.append(objetivo["nota"].iloc[0] - ybar)
        filas_ybar.append(ybar)
        filas_g.append(estudiante)
        filas_H.append([nota_previa.get(i, np.nan) for i in ids])

    if len(filas_y) < MIN_ESTUDIANTES:
        return None
    return DatosCurso(materia, previas, np.array(filas_X), np.array(filas_y), np.array(filas_ybar),
                      np.array(filas_g), ancestros(malla, materia), np.array(filas_H, dtype=float))


def penalizaciones(datos: DatosCurso, malla: dict, alpha: float) -> np.ndarray:
    """Penalización L2 de cada columna de `[a, Z]`, creciente con la distancia en la malla.

    El nivel `a` casi no se penaliza (es la señal principal). Un prerrequisito directo oficial
    paga `alpha`; una arista blanda directa paga el doble; y un ancestro indirecto (distancia
    ≥ 2) paga `alpha·4^(dist−1)`, que lo empuja a cero salvo que aporte información real.
    """
    distancias = distancias_ancestros(malla, datos.materia)
    alphas = [alpha * 0.25]
    for p in datos.ancestros:
        d = distancias.get(p, 1)
        if d == 1:
            alphas.append(alpha * (1.0 if tipo_arista(malla, p, datos.materia) == "oficial" else 2.0))
        else:
            alphas.append(alpha * 4.0 ** (d - 1))
    return np.array(alphas)


def ajustar_regresion(datos: DatosCurso, malla: dict, mu: dict[str, float], alpha: float, filas=slice(None)) -> dict:
    """Ridge con penalización por distancia en la malla sobre el residuo r = y − μ(c) − a.

    Se resuelve la forma cerrada con intercepto no penalizado: se centran X y r, se resuelve
    (XᵀX + diag(α_j)) w = Xᵀr sobre las columnas centradas y el intercepto absorbe las medias.
    Así la regularización encoge hacia la línea base (β → 1, pesos → 0) y no hacia la media,
    y cada ancestro paga según su distancia a la materia objetivo.
    """
    a, Z = rasgos(datos, malla, mu)
    real = (datos.y + datos.ybar)[filas]
    X = np.column_stack([a[filas], Z[filas]])
    r = real - mu[datos.materia] - a[filas]
    alphas = penalizaciones(datos, malla, alpha)
    # Intercepto no penalizado: centrar X y r equivale a eliminarlo del sistema.
    medias_X = X.mean(axis=0)
    w = np.linalg.solve((X - medias_X).T @ (X - medias_X) + np.diag(alphas), (X - medias_X).T @ (r - r.mean()))
    return {
        "b": float(r.mean() - medias_X @ w),
        "beta": float(1.0 + w[0]),
        "pesos": {p: float(v) for p, v in zip(datos.ancestros, w[1:])},
    }


def aplicar_regresion(curso: dict, datos: DatosCurso, malla: dict, mu: dict[str, float], filas=slice(None)) -> np.ndarray:
    a, Z = rasgos(datos, malla, mu)
    w = np.array([curso["pesos"][p] for p in datos.ancestros])
    return mu[datos.materia] + curso["b"] + curso["beta"] * a[filas] + Z[filas] @ w


MODELOS = ("baseline", "nivel", "regresion", "red")


def validar(datos: DatosCurso, df: pd.DataFrame, malla: dict, alpha: float = 1.0, pliegues: int = 5) -> dict[str, np.ndarray]:
    """Predicciones fuera de muestra (en escala de nota 0–5) de cada modelo.

    En cada partición, las medias μ se calculan SOLO con los estudiantes de entrenamiento.
    "nivel" es la predicción sin pesos, μ(c) + a: lo que se usa si una materia no tiene modelo.
    """
    n_grupos = len(np.unique(datos.grupos))
    gkf = GroupKFold(n_splits=min(pliegues, n_grupos))
    oof = {nombre: np.zeros_like(datos.y) for nombre in MODELOS}

    for train, test in gkf.split(datos.X, datos.y, datos.grupos):
        mu = medias_por_materia(df[df["estudiante"].isin(datos.grupos[train])], malla)
        a, _ = rasgos(datos, malla, mu)
        oof["baseline"][test] = datos.ybar[test]  # ŷ = ȳ: el promedio que trae el estudiante
        oof["nivel"][test] = mu[datos.materia] + a[test]
        oof["regresion"][test] = aplicar_regresion(ajustar_regresion(datos, malla, mu, alpha, train), datos, malla, mu, test)
        red = RedNeuronal(oculta=8, semilla=0).fit(datos.X[train], datos.y[train])
        oof["red"][test] = red.predict(datos.X[test]) + datos.ybar[test]

    return {nombre: np.clip(pred, 0, 5) for nombre, pred in oof.items()}


def entrenar_regresion(datos: DatosCurso, malla: dict, mu: dict[str, float], alpha: float = 1.0) -> dict:
    """Ajusta la regresión con todos los datos: b, β y el peso de cada ancestro."""
    return ajustar_regresion(datos, malla, mu, alpha)


def entrenar_red(datos: DatosCurso) -> dict:
    """Ajusta la red con todos los datos y devuelve sus pesos (el orden de W1 sigue a `previas`)."""
    return {"previas": datos.previas, **RedNeuronal(oculta=8, semilla=0).fit(datos.X, datos.y).exportar()}


def metricas(real: np.ndarray, pred: np.ndarray, aprobacion: float) -> dict:
    """MAE en puntos de nota, y precision/recall de "en riesgo" (nota < aprobación)."""
    en_riesgo, marcado = real < aprobacion, pred < aprobacion
    vp = int(np.sum(en_riesgo & marcado))
    return {
        "mae": float(np.mean(np.abs(real - pred))),
        "precision_riesgo": vp / max(int(marcado.sum()), 1),
        "recall_riesgo": vp / max(int(en_riesgo.sum()), 1),
    }


def entrenar(df: pd.DataFrame, malla: dict, alpha: float = 1.0) -> tuple[dict, pd.DataFrame]:
    """Valida los tres modelos en cada materia y arma el JSON de pesos (regresión)."""
    aprobacion = malla["nota_aprobacion"]
    df = df.assign(periodo=df["periodo"].astype(str))
    mu = medias_por_materia(df, malla)
    cursos, redes, resumen = {}, {}, []
    todos_real, todos_grupos, todos_pred = [], [], {n: [] for n in MODELOS}
    todos_sigma = {"regresion": [], "red": []}

    for m in malla["materias"]:
        datos = preparar(df, malla, m["id"])
        if datos is None:
            continue
        real = datos.y + datos.ybar
        preds = validar(datos, df, malla, alpha)
        residuo = real - preds["regresion"]

        cursos[m["id"]] = {**entrenar_regresion(datos, malla, mu, alpha), "sigma": float(np.sqrt(np.mean(residuo**2)))}
        sigma_red = float(np.sqrt(np.mean((real - preds["red"]) ** 2)))
        redes[m["id"]] = {**entrenar_red(datos), "sigma": sigma_red}
        todos_sigma["regresion"].append(np.full(len(real), cursos[m["id"]]["sigma"]))
        todos_sigma["red"].append(np.full(len(real), sigma_red))
        todos_grupos.append(datos.grupos)
        resumen.append({"materia": m["id"], "n": len(real), **{n: np.mean(np.abs(real - p)) for n, p in preds.items() if n != "nivel"}})
        todos_real.append(real)
        for n, p in preds.items():
            todos_pred[n].append(p)

    real = np.concatenate(todos_real)
    globales = {n: metricas(real, np.concatenate(p), aprobacion) for n, p in todos_pred.items() if n != "nivel"}
    pred = {n: np.concatenate(p) for n, p in todos_pred.items()}
    grupos = np.concatenate(todos_grupos)
    # Error típico de "materia + nivel", que es lo que usa la web si una materia no tiene modelo.
    sigma_global = float(np.sqrt(np.mean((real - pred["nivel"]) ** 2)))

    # La red solo se recomienda si mejora a la regresión de forma clara: todo el intervalo
    # del 95 % de la diferencia de MAE debe quedar por debajo de cero.
    red_vs_regresion = diferencia_mae(real, pred["red"], pred["regresion"], grupos)
    validacion = {
        "tipo": "cruzada por estudiante (5 particiones)",
        "notas_evaluadas": int(len(real)),
        "diferencia_mae": {
            "regresion_vs_baseline": diferencia_mae(real, pred["regresion"], pred["baseline"], grupos),
            "red_vs_regresion": red_vs_regresion,
        },
        "calibracion": {
            n: calibracion(real, pred[n], np.concatenate(todos_sigma[n]), aprobacion) for n in ("regresion", "red")
        },
        "recomendado": "red" if red_vs_regresion["ic95"][1] < 0 else "regresion",
    }

    pesos = {
        "tipo": "regresion_nivel",
        "generado": date.today().isoformat(),
        "version_malla": malla["version"],
        "n_estudiantes": int(df["estudiante"].nunique()),
        "sigma_global": sigma_global,
        "k_nivel": K_NIVEL,
        "medias": mu,
        "metricas": globales,
        "validacion": validacion,
        "cursos": cursos,
        "red": {"activacion": "tanh", "cursos": redes},
    }
    return pesos, pd.DataFrame(resumen)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # tildes en la consola de Windows
    parser = argparse.ArgumentParser(description="Entrena el predictor y exporta pesos.json")
    parser.add_argument("--notas", help="CSV con estudiante,materia,periodo,nota (si no, se simula)")
    parser.add_argument("--n", type=int, default=300, help="estudiantes simulados si no hay --notas")
    parser.add_argument("--alpha", type=float, default=1.0, help="regularización de la regresión")
    parser.add_argument("--salida", default=str(DATA / "pesos.json"))
    args = parser.parse_args()

    malla = cargar_malla()
    if args.notas:
        df, fuente = pd.read_csv(args.notas, dtype={"periodo": str}), args.notas
    else:
        df, _ = simular(malla, args.n)
        fuente = f"simulado ({args.n} estudiantes)"

    pesos, resumen = entrenar(df, malla, args.alpha)
    pesos["fuente"] = fuente

    print(f"Fuente: {fuente}\n")
    print("MAE por materia (puntos de nota, validación por estudiante):")
    print(resumen.round(3).to_string(index=False))
    print("\nGlobal:")
    for nombre, m in pesos["metricas"].items():
        print(f"  {nombre:10s} MAE {m['mae']:.3f}  precision {m['precision_riesgo']:.2f}  recall {m['recall_riesgo']:.2f}")
    v = pesos["validacion"]
    for nombre, d in v["diferencia_mae"].items():
        print(f"  {nombre.replace('_', ' ')}: {d['diferencia']:+.3f}  IC 95 % [{d['ic95'][0]:+.3f}, {d['ic95'][1]:+.3f}]")
    cal = v["calibracion"][v["recomendado"]]
    print(f"  Modelo recomendado: {v['recomendado']}. El rango ŷ ± σ contiene la nota real el "
          f"{cal['cobertura_rango']:.0%} de las veces; AUC de riesgo {cal['auc_riesgo']:.2f}.")

    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(pesos, f, ensure_ascii=False, indent=2)
    print(f"\nPesos exportados -> {args.salida}")


if __name__ == "__main__":
    main()
