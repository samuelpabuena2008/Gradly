"""Carga de la malla (data/malla_*.json) y consultas básicas sobre el grafo."""

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DATA = RAIZ / "data"
MALLA_SISTEMAS = DATA / "malla_sistemas.json"


def cargar_malla(ruta: Path | str = MALLA_SISTEMAS) -> dict:
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def predecesores(malla: dict, materia: str, incluir_blandas: bool = True) -> list[str]:
    """Materias previas que pueden influir en `materia` (prerrequisitos y, opcionalmente, aristas blandas)."""
    aristas = malla["prerrequisitos"] + (malla["aristas_blandas"] if incluir_blandas else [])
    return [e["de"] for e in aristas if e["a"] == materia]


def materias_por_semestre(malla: dict) -> dict[int, list[str]]:
    semestres: dict[int, list[str]] = {}
    for m in malla["materias"]:
        semestres.setdefault(m["semestre"], []).append(m["id"])
    return dict(sorted(semestres.items()))
