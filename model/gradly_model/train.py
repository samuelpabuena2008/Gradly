"""Entrena y compara los modelos, y exporta data/pesos.json para la web.

Niveles (del PDF):
  1. Baseline: la nota esperada es el promedio previo del estudiante.
  2. Regresión por materia (Ridge): ŷ = ȳ + b + Σ w · (y_p − ȳ). Los pesos se leen directo.
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
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold

from .evaluacion import calibracion, diferencia_mae
from .malla import DATA, cargar_malla, predecesores
from .red import RedNeuronal
from .simulate import simular

MIN_ESTUDIANTES = 10


@dataclass
class DatosCurso:
    materia: str
    previas: list[str]
    X: np.ndarray  # (n, k): y_p − ȳ de cada materia previa (0 si no la cursó)
    y: np.ndarray  # (n,): y_c − ȳ
    ybar: np.ndarray  # (n,): promedio previo del estudiante
    grupos: np.ndarray  # (n,): id del estudiante


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

    filas_X, filas_y, filas_ybar, filas_g = [], [], [], []
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

    if len(filas_y) < MIN_ESTUDIANTES:
        return None
    return DatosCurso(materia, previas, np.array(filas_X), np.array(filas_y), np.array(filas_ybar), np.array(filas_g))


def nuevos_modelos(alpha: float) -> dict:
    return {
        "baseline": None,
        "regresion": Ridge(alpha=alpha),
        "red": RedNeuronal(oculta=8, semilla=0),
    }


def validar(datos: DatosCurso, alpha: float = 1.0, pliegues: int = 5) -> dict[str, np.ndarray]:
    """Predicciones fuera de muestra (en escala de nota 0–5) de cada modelo."""
    n_grupos = len(np.unique(datos.grupos))
    gkf = GroupKFold(n_splits=min(pliegues, n_grupos))
    oof = {nombre: np.zeros_like(datos.y) for nombre in nuevos_modelos(alpha)}

    for train, test in gkf.split(datos.X, datos.y, datos.grupos):
        for nombre, modelo in nuevos_modelos(alpha).items():
            if modelo is None:
                oof[nombre][test] = 0.0  # baseline: desviación 0 → ŷ = ȳ
            else:
                modelo.fit(datos.X[train], datos.y[train])
                oof[nombre][test] = modelo.predict(datos.X[test])

    return {nombre: np.clip(pred + datos.ybar, 0, 5) for nombre, pred in oof.items()}


def entrenar_regresion(datos: DatosCurso, alpha: float = 1.0) -> dict:
    """Ajusta la regresión con todos los datos y devuelve b y los pesos por materia previa."""
    modelo = Ridge(alpha=alpha).fit(datos.X, datos.y)
    return {
        "b": float(modelo.intercept_),
        "pesos": {p: float(w) for p, w in zip(datos.previas, modelo.coef_)},
    }


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
    cursos, redes, resumen = {}, {}, []
    todos_real, todos_grupos, todos_pred = [], [], {n: [] for n in nuevos_modelos(alpha)}
    todos_sigma = {"regresion": [], "red": []}

    for m in malla["materias"]:
        datos = preparar(df, malla, m["id"])
        if datos is None:
            continue
        real = datos.y + datos.ybar
        preds = validar(datos, alpha)
        residuo = real - preds["regresion"]

        cursos[m["id"]] = {**entrenar_regresion(datos, alpha), "sigma": float(np.sqrt(np.mean(residuo**2)))}
        sigma_red = float(np.sqrt(np.mean((real - preds["red"]) ** 2)))
        redes[m["id"]] = {**entrenar_red(datos), "sigma": sigma_red}
        todos_sigma["regresion"].append(np.full(len(real), cursos[m["id"]]["sigma"]))
        todos_sigma["red"].append(np.full(len(real), sigma_red))
        todos_grupos.append(datos.grupos)
        resumen.append({"materia": m["id"], "n": len(real), **{n: np.mean(np.abs(real - p)) for n, p in preds.items()}})
        todos_real.append(real)
        for n, p in preds.items():
            todos_pred[n].append(p)

    real = np.concatenate(todos_real)
    globales = {n: metricas(real, np.concatenate(p), aprobacion) for n, p in todos_pred.items()}
    pred = {n: np.concatenate(p) for n, p in todos_pred.items()}
    grupos = np.concatenate(todos_grupos)
    sigma_global = float(np.sqrt(np.mean((real - pred["baseline"]) ** 2)))

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
        "tipo": "regresion_lineal",
        "generado": date.today().isoformat(),
        "version_malla": malla["version"],
        "n_estudiantes": int(df["estudiante"].nunique()),
        "sigma_global": sigma_global,
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
