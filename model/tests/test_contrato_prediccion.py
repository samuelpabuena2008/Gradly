"""Contrato con web/: Python debe resolver los casos de data/fixtures igual que TypeScript
(web/src/lib/model/contrato.test.ts corre los mismos casos)."""

import json

import pytest

from gradly_model.malla import DATA
from gradly_model.predict import UMBRALES, predecir_materia, ultimas_notas

CASO = json.loads((DATA / "fixtures" / "prediccion_caso_conocido.json").read_text(encoding="utf-8"))
TOL = CASO["tolerancia"]


def test_usa_los_mismos_umbrales_del_semaforo():
    assert UMBRALES == CASO["umbrales"]


@pytest.mark.parametrize("caso", CASO["casos"], ids=[c["nombre"] for c in CASO["casos"]])
def test_caso_conocido(caso):
    p = predecir_materia(caso["materia"], CASO["malla"], CASO["modelo"], ultimas_notas(caso["notas"]))
    e = caso["esperado"]

    assert p.nota == pytest.approx(e["nota"], abs=TOL)
    assert p.rango == pytest.approx(tuple(e["rango"]), abs=TOL)
    assert p.prob_no_aprobar == pytest.approx(e["probNoAprobar"], abs=TOL)
    assert p.semaforo == e["semaforo"]
    assert p.usa_modelo == e["usaModelo"]
    assert [m for m, _ in p.por_que] == [x["materia"] for x in e["porQue"]]
    assert [a for _, a in p.por_que] == pytest.approx([x["aporte"] for x in e["porQue"]], abs=TOL)
