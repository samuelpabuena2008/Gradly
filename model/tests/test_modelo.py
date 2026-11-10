"""Pruebas con resultado conocido del modelo."""

import numpy as np
import pandas as pd

from gradly_model.malla import cargar_malla, predecesores
from gradly_model.simulate import simular
from gradly_model.train import entrenar, entrenar_regresion, preparar, validar

MALLA = cargar_malla()


def test_recupera_los_pesos_simulados():
    """Notas simuladas con pesos que fijamos: la regresión debe recuperarlos (error < 0,1).

    Se usan 3000 estudiantes porque con ~800 el error típico de cada peso ya es ~0,04
    y algunas semillas se salen de la tolerancia (con pocos datos los pesos son ruidosos).
    """
    reales = {"ED": {"b": -0.1, "pesos": {"CAL2": 0.6, "ALGLIN": 0.2}}}
    df, _ = simular(MALLA, n_estudiantes=3000, no_lineal=False, ruido=0.2, reales=reales)

    estimado = entrenar_regresion(preparar(df, MALLA, "ED"), alpha=0.01)

    assert abs(estimado["pesos"]["CAL2"] - 0.6) < 0.1
    assert abs(estimado["pesos"]["ALGLIN"] - 0.2) < 0.1
    assert abs(estimado["b"] - (-0.1)) < 0.1


def test_la_regresion_le_gana_al_promedio():
    df, _ = simular(MALLA, n_estudiantes=300)
    pesos, _ = entrenar(df, MALLA)
    m = pesos["metricas"]
    assert m["regresion"]["mae"] < m["baseline"]["mae"]


def test_exporta_el_formato_que_lee_la_web():
    df, _ = simular(MALLA, n_estudiantes=100)
    pesos, _ = entrenar(df, MALLA)
    assert pesos["sigma_global"] > 0
    for materia, curso in pesos["cursos"].items():
        assert set(curso) == {"b", "sigma", "pesos"}
        assert set(curso["pesos"]) == set(predecesores(MALLA, materia))


def test_el_promedio_solo_usa_periodos_anteriores():
    """ȳ no puede incluir notas del mismo periodo o posteriores (sería hacer trampa)."""
    filas = []
    for i in range(12):
        e = f"e{i}"
        filas += [
            {"estudiante": e, "materia": "CAL1", "periodo": "2024-1", "nota": 4.0},
            {"estudiante": e, "materia": "CAL2", "periodo": "2024-2", "nota": 3.0},
            {"estudiante": e, "materia": "ALGLIN", "periodo": "2024-2", "nota": 5.0},  # mismo periodo: no cuenta
            {"estudiante": e, "materia": "ED", "periodo": "2025-1", "nota": 3.5},
            {"estudiante": e, "materia": "CAL3", "periodo": "2025-2", "nota": 0.0},  # posterior: no cuenta
        ]
    datos = preparar(pd.DataFrame(filas), MALLA, "CAL2")
    assert np.allclose(datos.ybar, 4.0)  # solo CAL1
    assert np.allclose(datos.y, -1.0)  # 3,0 − 4,0


def test_validacion_devuelve_notas_en_escala():
    df, _ = simular(MALLA, n_estudiantes=60)
    preds = validar(preparar(df, MALLA, "ED"))
    for p in preds.values():
        assert p.min() >= 0 and p.max() <= 5
