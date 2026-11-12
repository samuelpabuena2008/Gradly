"""Descarga (opcional) y valida el CSV exportado por la API antes de pasarlo a model/.

Uso:
  python api/scripts/verificar_export.py --url http://localhost:8000 --token "$ADMIN_TOKEN" --salida data/reales.csv
  python api/scripts/verificar_export.py --archivo data/reales.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlencode

import httpx

COLUMNAS_ESPERADAS = ["estudiante", "materia", "periodo", "nota"]
PATRON_PERIODO = re.compile(r"^\d{4}-[123]$")


def validar_csv(contenido: str) -> dict:
    lector = csv.DictReader(contenido.splitlines())
    if lector.fieldnames != COLUMNAS_ESPERADAS:
        raise ValueError(f"Columnas inválidas: {lector.fieldnames!r} (esperadas: {COLUMNAS_ESPERADAS})")

    estudiantes_periodos: dict[str, set[str]] = defaultdict(set)
    por_materia: Counter[str] = Counter()
    errores: list[str] = []
    total_notas = 0

    for i, fila in enumerate(lector, start=2):
        est = (fila["estudiante"] or "").strip()
        mat = (fila["materia"] or "").strip()
        per = (fila["periodo"] or "").strip()
        try:
            nota = float(fila["nota"])
        except (TypeError, ValueError):
            errores.append(f"Fila {i}: nota no numérica ({fila['nota']!r})")
            continue

        if not est or not mat:
            errores.append(f"Fila {i}: falta estudiante o materia")
            continue
        if not PATRON_PERIODO.fullmatch(per):
            errores.append(f"Fila {i}: periodo inválido {per!r}")
            continue
        if not (0.0 <= nota <= 5.0):
            errores.append(f"Fila {i}: nota fuera de 0-5 ({nota})")
            continue

        total_notas += 1
        estudiantes_periodos[est].add(per)
        por_materia[mat] += 1

    con_varios_periodos = sum(1 for ps in estudiantes_periodos.values() if len(ps) >= 2)
    return {
        "total_notas": total_notas,
        "estudiantes": len(estudiantes_periodos),
        "estudiantes_multi_periodo": con_varios_periodos,
        "materias_con_10_o_mas": sorted(m for m, c in por_materia.items() if c >= 10),
        "top_materias": por_materia.most_common(10),
        "errores": errores,
    }


def descargar_csv(url: str, token: str, version_malla: str | None, programa: str | None) -> str:
    params = {}
    if version_malla:
        params["version_malla"] = version_malla
    if programa:
        params["programa"] = programa
    endpoint = f"{url.rstrip('/')}/donaciones/export.csv"
    if params:
        endpoint = f"{endpoint}?{urlencode(params)}"
    resp = httpx.get(endpoint, headers={"X-Admin-Token": token}, timeout=20.0)
    resp.raise_for_status()
    return resp.text


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Descarga y valida donaciones exportadas para model/")
    parser.add_argument("--archivo", type=Path, help="Ruta a un CSV ya descargado (omite HTTP)")
    parser.add_argument("--url", default="http://localhost:8000", help="URL base de la API")
    parser.add_argument("--token", default=os.getenv("ADMIN_TOKEN", ""), help="X-Admin-Token")
    parser.add_argument("--version-malla", default=None, help="Filtrar por version_malla")
    parser.add_argument("--programa", default=None, help="Filtrar por programa")
    parser.add_argument("--salida", type=Path, default=None, help="Guardar CSV validado en esta ruta")
    args = parser.parse_args()

    if args.archivo:
        contenido = args.archivo.read_text(encoding="utf-8")
    else:
        if not args.token:
            print("Error: falta --token o variable ADMIN_TOKEN", file=sys.stderr)
            return 2
        contenido = descargar_csv(args.url, args.token, args.version_malla, args.programa)

    res = validar_csv(contenido)
    print(f"Estudiantes únicos: {res['estudiantes']} (con >=2 periodos: {res['estudiantes_multi_periodo']})")
    print(f"Total de notas válidas: {res['total_notas']}")
    print(f"Materias con >=10 notas: {len(res['materias_con_10_o_mas'])} -> {res['materias_con_10_o_mas']}")
    if res["top_materias"]:
        print("Top materias:", ", ".join(f"{m}={c}" for m, c in res["top_materias"]))

    if res["errores"]:
        print(f"\nSe encontraron {len(res['errores'])} errores:")
        for err in res["errores"][:20]:
            print(" -", err)
        return 1

    if args.salida:
        args.salida.parent.mkdir(parents=True, exist_ok=True)
        args.salida.write_text(contenido, encoding="utf-8")
        print(f"\nCSV validado guardado en -> {args.salida}")

    if res["estudiantes_multi_periodo"] == 0 or not res["materias_con_10_o_mas"]:
        print("\nAviso: aún hay pocos datos para entrenar con train.py (MIN_ESTUDIANTES=10 por materia); "
              "sirve para evaluación/calibración.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
