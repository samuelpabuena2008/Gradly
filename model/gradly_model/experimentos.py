"""Experimentos y figuras para el informe (sección de resultados del modelo).

  1. Curva de aprendizaje: ¿cuántos estudiantes hacen falta? MAE de cada modelo según el
     tamaño de los datos, con el simulador lineal y con el no lineal.
  2. Recuperación de pesos: la simulación usa pesos que fijamos nosotros; se comparan con los
     que aprende la regresión.
  3. Reporte: tabla de resultados de data/pesos.json en Markdown.

Uso:  python -m gradly_model.experimentos          (tarda cerca de un minuto)
Escribe en docs/modelo/: experimentos.json, reporte.md y figuras/*.png
"""

import argparse
import json
import sys

import numpy as np

from .malla import DATA, RAIZ, cargar_malla
from .simulate import pesos_reales, simular
from .train import entrenar, entrenar_regresion, medias_por_materia, preparar

SALIDA = RAIZ / "docs" / "modelo"
NOMBRES = {"baseline": "Promedio del estudiante", "regresion": "Regresión sobre la malla", "red": "Red neuronal"}


def curva_aprendizaje(malla: dict, tamanos: list[int]) -> list[dict]:
    # Los mismos pesos verdaderos en todos los tamaños: así solo cambia la cantidad de datos.
    reales = pesos_reales(malla, np.random.default_rng(7))
    filas = []
    for no_lineal in (False, True):
        for n in tamanos:
            df, _ = simular(malla, n, semilla=100 + n, no_lineal=no_lineal, reales=reales)
            pesos, _ = entrenar(df, malla)
            fila = {"simulador": "no lineal" if no_lineal else "lineal", "estudiantes": n,
                    **{m: round(v["mae"], 4) for m, v in pesos["metricas"].items()}}
            filas.append(fila)
            print(fila)
    return filas


def recuperacion_pesos(malla: dict, tamanos: list[int]) -> list[dict]:
    reales = pesos_reales(malla, np.random.default_rng(7))
    filas = []
    for n in tamanos:
        df, _ = simular(malla, n, semilla=200 + n, no_lineal=False, reales=reales)
        mu = medias_por_materia(df, malla)
        pares = []
        for materia, curso in reales.items():
            datos = preparar(df, malla, materia)
            if datos is None:
                continue
            estimado = entrenar_regresion(datos, malla, mu, alpha=1.0)["pesos"]
            pares += [[round(w, 4), round(estimado[p], 4)] for p, w in curso["pesos"].items()]
        real, est = np.array(pares).T
        fila = {"estudiantes": n, "error_medio_abs": round(float(np.abs(real - est).mean()), 3),
                "correlacion": round(float(np.corrcoef(real, est)[0, 1]), 3), "pares": pares}
        filas.append(fila)
        print({k: v for k, v in fila.items() if k != "pares"})
    return filas


def reporte(pesos: dict) -> str:
    v, m = pesos["validacion"], pesos["metricas"]
    num = lambda x, d=3: f"{x:.{d}f}".replace(".", ",")
    pct = lambda x: f"{100 * x:.0f} %"
    L = ["# Resultados del modelo", "",
         f"Fuente de datos: {pesos.get('fuente', '—')}. Malla: versión «{pesos['version_malla']}». "
         f"Validación {v['tipo']}, {v['notas_evaluadas']} notas evaluadas.", ""]
    if str(pesos.get("fuente", "")).startswith("simulado"):
        L += ["> Estos números salen de datos **simulados** sobre la malla: muestran que el método funciona y "
              "recupera pesos conocidos, no qué tan bien predice notas reales.", ""]
    L += ["| Modelo | MAE (puntos de nota) | Precisión de riesgo | Recall de riesgo |", "| --- | --- | --- | --- |"]
    L += [f"| {NOMBRES[k]} | {num(x['mae'])} | {num(x['precision_riesgo'], 2)} | {num(x['recall_riesgo'], 2)} |"
          for k, x in m.items()]
    d = v["diferencia_mae"]
    ic = lambda x: f"{num(x['diferencia'])} (IC 95 %: {num(x['ic95'][0])} a {num(x['ic95'][1])})"
    cal = v["calibracion"][v["recomendado"]]
    L += ["", "\"Riesgo\" = nota real menor que la de aprobación; el modelo alerta cuando predice menos que eso.", "",
          "## Comparación entre modelos", "",
          f"- Regresión frente al promedio del estudiante: {ic(d['regresion_vs_baseline'])}.",
          f"- Red neuronal frente a la regresión: {ic(d['red_vs_regresion'])}.", "",
          "Diferencia de MAE; negativo significa que el primero se equivoca menos. El intervalo se calcula "
          "remuestreando estudiantes completos.", "",
          f"**Modelo recomendado: {NOMBRES[v['recomendado']].lower()}.** La red solo se recomienda si todo su "
          "intervalo frente a la regresión queda por debajo de cero.", "",
          "## Rango y semáforo (modelo recomendado)", "",
          f"- El rango ŷ ± σ contiene la nota real el {pct(cal['cobertura_rango'])} de las veces (lo esperado es 68 %).",
          f"- El semáforo en amarillo o rojo detecta al {pct(cal['detectados_amarillo_o_rojo'])} de quienes reprueban "
          f"(AUC {num(cal['auc_riesgo'], 2)})."]
    for color, c in cal["semaforo"].items():
        if c["n"]:
            L.append(f"- {color.capitalize()}: {c['n']} predicciones; reprobó de verdad el {pct(c['reprobaron'])}.")
    return "\n".join(L) + "\n"


def figuras(exp: dict, pesos: dict, carpeta) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Paleta categórica validada para daltonismo (azul, naranja, verde agua) sobre fondo claro.
    azul, naranja, agua = "#2a78d6", "#eb6834", "#1baf7a"
    tinta, gris, rejilla, fondo = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"
    plt.rcParams.update({
        "font.size": 10, "axes.edgecolor": rejilla, "axes.labelcolor": gris, "text.color": tinta,
        "xtick.color": gris, "ytick.color": gris, "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": rejilla, "grid.linewidth": 0.8, "axes.axisbelow": True,
        "figure.facecolor": fondo, "axes.facecolor": fondo, "savefig.facecolor": fondo, "savefig.dpi": 200,
        "axes.titlesize": 11, "axes.titleweight": "bold", "axes.titlelocation": "left",
    })
    carpeta.mkdir(parents=True, exist_ok=True)
    titulo = lambda fig, texto: fig.suptitle(texto, x=0.01, ha="left", fontweight="bold", fontsize=12)

    # 1) Error por modelo
    m = pesos["metricas"]
    orden = sorted(m, key=lambda k: -m[k]["mae"])
    fig, ax = plt.subplots(figsize=(7, 2.4))
    barras = ax.barh([NOMBRES[k] for k in orden], [m[k]["mae"] for k in orden], color=azul, height=0.55)
    for b, k in zip(barras, orden):
        ax.text(m[k]["mae"] + 0.006, b.get_y() + b.get_height() / 2, f"{m[k]['mae']:.3f}".replace(".", ","), va="center")
    ax.set_xlim(0, max(x["mae"] for x in m.values()) * 1.15)
    ax.set_xlabel("Error absoluto medio (puntos de nota, escala 0 a 5)")
    ax.grid(axis="y", visible=False)
    titulo(fig, "La regresión sobre la malla se equivoca menos que el promedio")
    fig.tight_layout()
    fig.savefig(carpeta / "error_por_modelo.png")
    plt.close(fig)

    # 2) Curva de aprendizaje
    series = [("baseline", naranja, "s"), ("regresion", azul, "o"), ("red", agua, "^")]
    fig, ejes = plt.subplots(1, 2, figsize=(9, 3.6), sharey=True)
    for ax, sim in zip(ejes, ("lineal", "no lineal")):
        filas = [f for f in exp["curva_aprendizaje"] if f["simulador"] == sim]
        xs = [f["estudiantes"] for f in filas]
        for clave, color, marca in series:
            ax.plot(xs, [f[clave] for f in filas], color=color, marker=marca, lw=2, ms=6, label=NOMBRES[clave],
                    markeredgecolor=fondo, markeredgewidth=1.5)
        ax.set_xscale("log")
        ax.set_xticks(xs, [str(x) for x in xs])
        ax.minorticks_off()
        ax.set_xlabel("Estudiantes en los datos")
        ax.set_title(f"Simulador {sim}")
    ejes[0].set_ylabel("Error absoluto medio")
    titulo(fig, "Error de cada modelo según la cantidad de estudiantes")
    fig.tight_layout(rect=(0, 0.08, 1, 1))
    fig.legend(*ejes[0].get_legend_handles_labels(), frameon=False, loc="lower center", ncol=3)
    fig.savefig(carpeta / "curva_aprendizaje.png")
    plt.close(fig)

    # 3) Recuperación de pesos (el tamaño más pequeño y el más grande)
    casos = [exp["recuperacion_pesos"][0], exp["recuperacion_pesos"][-1]]
    fig, ejes = plt.subplots(1, 2, figsize=(8.4, 4), sharey=True)
    for ax, caso in zip(ejes, casos):
        real, est = zip(*caso["pares"])
        ax.plot([0, 0.8], [0, 0.8], color=gris, lw=1, ls="--", zorder=1)
        ax.scatter(real, est, s=42, color=azul, edgecolor=fondo, linewidth=1.2, zorder=2)
        ax.set_xlabel("Peso verdadero del simulador")
        ax.set_title(f"{caso['estudiantes']} estudiantes · error medio {caso['error_medio_abs']:.2f}".replace(".", ","))
    ejes[0].set_ylabel("Peso aprendido por la regresión")
    ejes[0].annotate("línea punteada =\nrecuperación perfecta", xy=(0.97, 0.05), xycoords="axes fraction", ha="right",
                     color=gris, fontsize=9)
    titulo(fig, "Con más datos, la regresión recupera los pesos entre materias")
    fig.tight_layout()
    fig.savefig(carpeta / "recuperacion_pesos.png")
    plt.close(fig)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Experimentos y figuras del modelo para el informe")
    parser.add_argument("--tamanos", type=int, nargs="+", default=[50, 100, 200, 400, 800, 1600])
    parser.add_argument("--solo-figuras", action="store_true", help="reutiliza docs/modelo/experimentos.json")
    args = parser.parse_args()

    SALIDA.mkdir(parents=True, exist_ok=True)
    malla = cargar_malla()
    pesos = json.loads((DATA / "pesos.json").read_text(encoding="utf-8"))
    ruta = SALIDA / "experimentos.json"
    if args.solo_figuras and ruta.exists():
        exp = json.loads(ruta.read_text(encoding="utf-8"))
    else:
        exp = {"curva_aprendizaje": curva_aprendizaje(malla, args.tamanos),
               "recuperacion_pesos": recuperacion_pesos(malla, args.tamanos)}
        ruta.write_text(json.dumps(exp, ensure_ascii=False, indent=1), encoding="utf-8")
    (SALIDA / "reporte.md").write_text(reporte(pesos), encoding="utf-8")
    figuras(exp, pesos, SALIDA / "figuras")
    print(f"Listo -> {SALIDA}")


if __name__ == "__main__":
    main()
