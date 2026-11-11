"""Pruebas con resultado conocido de la red neuronal y de las medidas de validación."""

import json

import numpy as np
import pytest

from gradly_model.evaluacion import auc, calibracion, diferencia_mae
from gradly_model.malla import DATA, cargar_malla
from gradly_model.predict import predecir_materia, predecir_materia_red, salida_red, ultimas_notas
from gradly_model.red import RedNeuronal, perdida_y_gradientes
from gradly_model.simulate import simular
from gradly_model.train import entrenar

CASO = json.loads((DATA / "fixtures" / "red_caso_conocido.json").read_text(encoding="utf-8"))
TOL = CASO["tolerancia"]


def test_retropropagacion_coincide_con_diferencias_finitas():
    """El gradiente escrito a mano debe ser igual a la derivada numérica de la pérdida."""
    rng = np.random.default_rng(1)
    X, y = rng.normal(size=(9, 3)), rng.normal(size=9)
    p = {"W1": rng.normal(size=(3, 4)), "b1": rng.normal(size=4), "W2": rng.normal(size=4), "b2": 0.3}
    _, grad = perdida_y_gradientes(p, X, y, l2=0.01)

    def perdida_con(clave, indice, valor):
        q = {c: np.array(v, dtype=float, copy=True) for c, v in p.items()}
        q[clave][indice] = valor
        return perdida_y_gradientes(q, X, y, 0.01)[0]

    h = 1e-6
    for clave in p:
        actual = np.asarray(p[clave], dtype=float)
        for indice in np.ndindex(actual.shape):
            numerica = (perdida_con(clave, indice, actual[indice] + h) - perdida_con(clave, indice, actual[indice] - h)) / (2 * h)
            assert np.asarray(grad[clave])[indice] == pytest.approx(numerica, abs=1e-6)


def test_la_red_aprende_una_relacion_que_la_recta_no_puede():
    """y = |x| (forma de V): una recta no la ajusta; la red sí."""
    rng = np.random.default_rng(0)
    X = rng.uniform(-1.5, 1.5, size=(600, 1))
    y = np.abs(X[:, 0])
    red = RedNeuronal(oculta=8, epocas=600, paciencia=80).fit(X[:400], y[:400])
    error_red = np.mean(np.abs(red.predict(X[400:]) - y[400:]))
    pendiente, corte = np.polyfit(X[:400, 0], y[:400], 1)
    error_recta = np.mean(np.abs(pendiente * X[400:, 0] + corte - y[400:]))
    assert error_red < 0.25 * error_recta


def test_misma_semilla_mismo_resultado():
    rng = np.random.default_rng(2)
    X, y = rng.normal(size=(80, 2)), rng.normal(size=80)
    a, b = RedNeuronal(semilla=5).fit(X, y), RedNeuronal(semilla=5).fit(X, y)
    assert np.array_equal(a.predict(X), b.predict(X))


@pytest.mark.parametrize("caso", CASO["casos"], ids=[c["nombre"] for c in CASO["casos"]])
def test_caso_conocido_de_la_red(caso):
    """Mismo caso que web/src/lib/model/red.test.ts."""
    p = predecir_materia_red(caso["materia"], CASO["malla"], CASO["modelo"], ultimas_notas(caso["notas"]))
    e = caso["esperado"]
    assert p.nota == pytest.approx(e["nota"], abs=TOL)
    assert p.rango == pytest.approx(tuple(e["rango"]), abs=TOL)
    assert p.prob_no_aprobar == pytest.approx(e["probNoAprobar"], abs=TOL)
    assert p.semaforo == e["semaforo"]
    assert [m for m, _ in p.por_que] == [x["materia"] for x in e["porQue"]]
    assert [a for _, a in p.por_que] == pytest.approx([x["aporte"] for x in e["porQue"]], abs=TOL)


def test_sin_red_para_la_materia_usa_la_regresion():
    notas = {"CAL1": 4.0}
    assert predecir_materia_red("CAL2", CASO["malla"], CASO["modelo"], notas) == predecir_materia(
        "CAL2", CASO["malla"], CASO["modelo"], notas
    )


def test_la_red_exportada_predice_igual_que_la_entrenada():
    malla = cargar_malla()
    df, _ = simular(malla, n_estudiantes=80)
    pesos, _ = entrenar(df, malla)
    assert set(pesos["red"]["cursos"]) == set(pesos["cursos"])
    red = pesos["red"]["cursos"]["ED"]
    x = [0.4, -0.7][: len(red["previas"])]
    params = {"W1": np.array(red["W1"]), "b1": np.array(red["b1"]), "W2": np.array(red["W2"]), "b2": red["b2"]}
    modelo = RedNeuronal()
    modelo.params = params
    assert salida_red(red, x) == pytest.approx(float(modelo.predict(np.array([x]))[0]), abs=1e-9)
    assert pesos["validacion"]["recomendado"] in ("regresion", "red")


def test_auc_casos_conocidos():
    positivo = np.array([True, True, False, False])
    assert auc(np.array([0.9, 0.8, 0.2, 0.1]), positivo) == 1.0
    assert auc(np.array([0.1, 0.2, 0.8, 0.9]), positivo) == 0.0
    assert auc(np.array([0.5, 0.5, 0.5, 0.5]), positivo) == 0.5


def test_diferencia_mae_a_mano():
    # errores de a: 1 y 1; de b: 0 y 0 → a se equivoca 1,0 más, con cualquier remuestreo
    real, a, b = np.array([3.0, 4.0]), np.array([4.0, 3.0]), np.array([3.0, 4.0])
    d = diferencia_mae(real, a, b, np.array(["e1", "e2"]), repeticiones=200)
    assert d["diferencia"] == 1.0 and d["ic95"] == [1.0, 1.0]


def test_calibracion_a_mano():
    # 4 predicciones con σ = 0,5: errores 0,2 / 0,6 / 0,1 / 1,0 → 2 de 4 dentro del rango
    real = np.array([3.2, 3.6, 2.4, 2.0])
    pred = np.array([3.0, 3.0, 2.5, 3.0])
    c = calibracion(real, pred, np.full(4, 0.5), aprobacion=3.0)
    assert c["cobertura_rango"] == 0.5
    # pred 3,0 → P = 0,5 (rojo); pred 2,5 → P = 0,84 (rojo): todas en rojo, reprobaron 2 de 4
    assert c["semaforo"]["rojo"] == {"n": 4, "reprobaron": 0.5}
    assert c["semaforo"]["verde"]["n"] == 0
