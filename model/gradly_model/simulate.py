"""Estudiantes simulados sobre la malla real (plan B permitido por el enunciado).

Cada estudiante cursa la malla semestre por semestre. Su nota en una materia sale de la
misma fórmula que el modelo (con pesos que fijamos nosotros) más ruido:

    y(s,c) = ȳ(s) + b(c) + Σ w(p→c) · (y(s,p) − ȳ(s)) + ruido

Con `no_lineal=True` se agrega un castigo extra si algún prerrequisito quedó por debajo de 3,0.
Así un modelo no lineal (la red) tiene algo que aprender que la regresión no ve.

Uso:  python -m gradly_model.simulate --n 300 --salida ../data/simulados.csv
"""

import argparse
import sys

import numpy as np
import pandas as pd

from .malla import DATA, cargar_malla, materias_por_semestre, predecesores

MEDIA_BASE = 3.5
CASTIGO_NO_LINEAL = 0.4


def periodo(semestre: int, anio_inicio: int = 2023) -> str:
    """Semestre 1 → 2023-1, semestre 2 → 2023-2, semestre 3 → 2024-1…"""
    return f"{anio_inicio + (semestre - 1) // 2}-{(semestre - 1) % 2 + 1}"


def pesos_reales(malla: dict, rng: np.random.Generator) -> dict[str, dict]:
    """Pesos "verdaderos" que la simulación usa y que el modelo debería recuperar."""
    blandas = {(e["de"], e["a"]) for e in malla["aristas_blandas"]}
    cursos = {}
    for m in malla["materias"]:
        previas = predecesores(malla, m["id"])
        if not previas:
            continue
        cursos[m["id"]] = {
            "b": float(rng.normal(0, 0.2)),
            "pesos": {
                p: float(rng.uniform(0.05, 0.3) if (p, m["id"]) in blandas else rng.uniform(0.3, 0.7))
                for p in previas
            },
        }
    return cursos


def simular(
    malla: dict,
    n_estudiantes: int = 300,
    semilla: int = 42,
    no_lineal: bool = True,
    ruido: float = 0.35,
    reales: dict | None = None,
) -> tuple[pd.DataFrame, dict]:
    """Devuelve (tabla estudiante, materia, periodo, nota) y los pesos reales usados."""
    rng = np.random.default_rng(semilla)
    reales = reales or pesos_reales(malla, rng)
    filas = []

    for s in range(n_estudiantes):
        aptitud = rng.normal(0, 0.4)
        notas: dict[str, float] = {}
        for semestre, materias in materias_por_semestre(malla).items():
            previas_cursadas = dict(notas)  # solo semestres anteriores
            ybar = np.mean(list(previas_cursadas.values())) if previas_cursadas else MEDIA_BASE + aptitud

            for c in materias:
                y = ybar
                if c in reales:
                    y += reales[c]["b"]
                    for p, w in reales[c]["pesos"].items():
                        y += w * (previas_cursadas[p] - ybar)
                        if no_lineal and previas_cursadas[p] < 3.0:
                            y -= CASTIGO_NO_LINEAL / len(reales[c]["pesos"])
                y = float(np.clip(y + rng.normal(0, ruido), 0, 5))
                notas[c] = round(y, 1)
                filas.append({"estudiante": f"sim{s:04d}", "materia": c, "periodo": periodo(semestre), "nota": notas[c]})

    return pd.DataFrame(filas), reales


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # tildes en la consola de Windows
    parser = argparse.ArgumentParser(description="Genera estudiantes simulados sobre la malla")
    parser.add_argument("--n", type=int, default=300)
    parser.add_argument("--semilla", type=int, default=42)
    parser.add_argument("--lineal", action="store_true", help="sin el castigo no lineal")
    parser.add_argument("--salida", default=str(DATA / "simulados.csv"))
    args = parser.parse_args()

    df, _ = simular(cargar_malla(), args.n, args.semilla, no_lineal=not args.lineal)
    df.to_csv(args.salida, index=False)
    print(f"{df['estudiante'].nunique()} estudiantes, {len(df)} notas -> {args.salida}")


if __name__ == "__main__":
    main()
