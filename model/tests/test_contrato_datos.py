"""Contrato de datos: todo lo que hay en data/ cumple los esquemas y usa los mismos códigos.

Si alguien cambia un código de materia en la malla, esta prueba avisa qué archivo quedó
desactualizado (pesos, plantilla o fixtures) antes de que se rompa la web, el modelo o la API.
"""

import csv
import json
import re

import pytest
from jsonschema import Draft202012Validator

from gradly_model.malla import DATA, ancestros

ESQUEMA_MALLA = json.loads((DATA / "schemas" / "malla.schema.json").read_text(encoding="utf-8"))
ESQUEMA_PESOS = json.loads((DATA / "schemas" / "pesos.schema.json").read_text(encoding="utf-8"))
FIXTURE = json.loads((DATA / "fixtures" / "prediccion_caso_conocido.json").read_text(encoding="utf-8"))


def leer(nombre: str) -> dict:
    return json.loads((DATA / nombre).read_text(encoding="utf-8"))


MALLAS = {
    "malla_sistemas.json": leer("malla_sistemas.json"),
    "malla_prueba.json": leer("malla_prueba.json"),
    "fixture (malla)": FIXTURE["malla"],
}


def errores_esquema(esquema: dict, datos: dict) -> list[str]:
    validador = Draft202012Validator(esquema)
    return [f"{'/'.join(map(str, e.path)) or '(raíz)'}: {e.message}" for e in validador.iter_errors(datos)]


@pytest.mark.parametrize("nombre", MALLAS)
def test_malla_cumple_el_esquema(nombre):
    assert errores_esquema(ESQUEMA_MALLA, MALLAS[nombre]) == []


@pytest.mark.parametrize("nombre", MALLAS)
def test_malla_es_coherente(nombre):
    malla = MALLAS[nombre]
    ids = [m["id"] for m in malla["materias"]]
    semestre = {m["id"]: m["semestre"] for m in malla["materias"]}

    assert len(ids) == len(set(ids)), "hay códigos de materia repetidos"
    for e in malla["prerrequisitos"] + malla["aristas_blandas"]:
        assert e["de"] in semestre and e["a"] in semestre, f"arista {e} usa una materia que no existe"
        assert semestre[e["de"]] < semestre[e["a"]], f"{e['de']} → {e['a']}: el prerrequisito debe ir en un semestre anterior"


@pytest.mark.parametrize("nombre", MALLAS)
def test_malla_no_tiene_ciclos(nombre):
    malla = MALLAS[nombre]
    entrada = {m["id"]: 0 for m in malla["materias"]}
    for e in malla["prerrequisitos"]:
        entrada[e["a"]] += 1
    pendientes = [i for i, g in entrada.items() if g == 0]
    vistos = 0
    while pendientes:
        u = pendientes.pop()
        vistos += 1
        for e in malla["prerrequisitos"]:
            if e["de"] == u:
                entrada[e["a"]] -= 1
                if entrada[e["a"]] == 0:
                    pendientes.append(e["a"])
    assert vistos == len(entrada), "la malla tiene un ciclo"


@pytest.mark.parametrize(
    "pesos, malla",
    [(leer("pesos.json"), MALLAS["malla_sistemas.json"]), (FIXTURE["modelo"], FIXTURE["malla"])],
    ids=["pesos.json", "fixture (modelo)"],
)
def test_pesos_cumplen_el_esquema_y_la_malla(pesos, malla):
    assert errores_esquema(ESQUEMA_PESOS, pesos) == []
    ids = {m["id"] for m in malla["materias"]}
    for materia, curso in pesos["cursos"].items():
        assert materia in ids, f"pesos.json tiene la materia {materia}, que no está en la malla (¿reentrenar?)"
        previas = set(ancestros(malla, materia))
        sobrantes = set(curso["pesos"]) - previas
        assert not sobrantes, f"{materia}: pesos para {sobrantes}, que no son ancestros en la malla"
    assert set(pesos["medias"]) >= ids & (set(pesos["cursos"]) | {p for c in pesos["cursos"].values() for p in c["pesos"]}), (
        "faltan medias de materias que el modelo usa"
    )


def test_plantilla_de_notas():
    ids = {m["id"] for m in MALLAS["malla_sistemas.json"]["materias"]}
    with open(DATA / "plantilla_notas.csv", encoding="utf-8", newline="") as f:
        lector = csv.DictReader(f)
        assert lector.fieldnames == ["materia", "periodo", "nota"]
        for i, fila in enumerate(lector, start=2):
            assert fila["materia"] in ids, f"fila {i}: {fila['materia']} no está en la malla"
            assert re.fullmatch(r"\d{4}-[123]", fila["periodo"]), f"fila {i}: periodo debe ser AAAA-S"
            assert 0 <= float(fila["nota"]) <= 5, f"fila {i}: nota fuera de 0–5"
