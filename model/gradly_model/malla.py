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


def ancestros(malla: dict, materia: str, incluir_blandas: bool = True) -> list[str]:
    """Todas las materias de las que depende `materia`, directa o indirectamente (cierre transitivo).

    Se devuelven en el orden en que aparecen en la malla.
    """
    vistos: set[str] = set()
    pendientes = predecesores(malla, materia, incluir_blandas)
    while pendientes:
        p = pendientes.pop()
        if p not in vistos:
            vistos.add(p)
            pendientes += predecesores(malla, p, incluir_blandas)
    return [m["id"] for m in malla["materias"] if m["id"] in vistos]


def distancias_ancestros(malla: dict, materia: str, incluir_blandas: bool = True) -> dict[str, int]:
    """Cuántas aristas separan a cada ancestro de `materia` (camino más corto, BFS hacia atrás).

    Un prerrequisito directo queda a distancia 1 y el prerrequisito de un prerrequisito a 2.
    Se devuelven en el orden en que aparecen en la malla, igual que `ancestros`.
    """
    aristas = malla["prerrequisitos"] + (malla["aristas_blandas"] if incluir_blandas else [])
    previas_de: dict[str, list[str]] = {}
    for e in aristas:
        previas_de.setdefault(e["a"], []).append(e["de"])

    distancia: dict[str, int] = {}
    frontera = [materia]
    while frontera:
        siguiente = []
        for nodo in frontera:
            for p in previas_de.get(nodo, []):
                if p not in distancia:
                    distancia[p] = distancia.get(nodo, 0) + 1
                    siguiente.append(p)
        frontera = siguiente
    return {m["id"]: distancia[m["id"]] for m in malla["materias"] if m["id"] in distancia}


def tipo_arista(malla: dict, previa: str, materia: str) -> str | None:
    """'oficial' si `previa` es prerrequisito de `materia`, 'blanda' si solo es arista blanda."""
    if any(e["de"] == previa and e["a"] == materia for e in malla["prerrequisitos"]):
        return "oficial"
    if any(e["de"] == previa and e["a"] == materia for e in malla["aristas_blandas"]):
        return "blanda"
    return None


def materias_por_semestre(malla: dict) -> dict[int, list[str]]:
    semestres: dict[int, list[str]] = {}
    for m in malla["materias"]:
        semestres.setdefault(m["semestre"], []).append(m["id"])
    return dict(sorted(semestres.items()))
