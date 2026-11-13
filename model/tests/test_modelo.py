"""Pruebas con resultado conocido del modelo."""

import numpy as np
import pandas as pd

from gradly_model.malla import DATA, ancestros, cargar_malla, distancias_ancestros, tipo_arista
from gradly_model.simulate import simular
from gradly_model.train import (
    K_NIVEL,
    entrenar,
    entrenar_regresion,
    medias_por_materia,
    penalizaciones,
    preparar,
    rasgos,
    validar,
)

MALLA = cargar_malla(DATA / "malla_ejemplo.json")  # malla pequeña de 16 materias, estable para las pruebas


def test_distancias_ancestros_cuenta_aristas_hacia_atras():
    """En la malla de ejemplo ED depende de CAL2 (distancia 1) y de CAL1 (distancia 2)."""
    assert distancias_ancestros(MALLA, "ED") == {"CAL1": 2, "CAL2": 1, "ALGLIN": 1}
    # Sin aristas blandas, ALGLIN deja de ser ancestro de ED.
    assert distancias_ancestros(MALLA, "ED", incluir_blandas=False) == {"CAL1": 2, "CAL2": 1}
    # Una materia sin previas no tiene ancestros.
    assert distancias_ancestros(MALLA, "CAL1") == {}


def test_distancias_ancestros_son_el_camino_mas_corto():
    """MET llega por dos caminos: ED→MET y ALGLIN→MET (1), CAL2 (2) y CAL1 (3)."""
    distancias = distancias_ancestros(MALLA, "MET")
    assert distancias["ED"] == 1 and distancias["ALGLIN"] == 1
    assert distancias["CAL2"] == 2 and distancias["CAL1"] == 3
    # Cada ancestro lejano cuelga de algún predecesor directo, una arista más cerca.
    for materia, d in distancias.items():
        if d == 1:
            continue
        assert any(distancias_ancestros(MALLA, p).get(materia) == d - 1 for p in ancestros(MALLA, "MET"))


def test_tipo_arista_distingue_oficial_de_blanda():
    assert tipo_arista(MALLA, "CAL2", "ED") == "oficial"
    assert tipo_arista(MALLA, "ALGLIN", "ED") == "blanda"  # solo arista blanda
    assert tipo_arista(MALLA, "CAL1", "ED") is None  # ancestro indirecto, sin arista directa


def test_penalizaciones_crecen_con_la_distancia():
    """a paga poco; el prerrequisito oficial paga alpha; la blanda el doble; el indirecto 4^(d−1)."""
    df, _ = simular(MALLA, n_estudiantes=40, no_lineal=False)
    datos = preparar(df, MALLA, "ED")
    alphas = dict(zip(["nivel", *datos.ancestros], penalizaciones(datos, MALLA, alpha=1.0)))
    assert alphas["nivel"] == 0.25
    assert alphas["CAL2"] == 1.0  # oficial, distancia 1
    assert alphas["ALGLIN"] == 2.0  # blanda, distancia 1
    assert alphas["CAL1"] == 4.0  # indirecto, distancia 2 → 4^1


def test_recupera_los_pesos_simulados():
    """Notas simuladas con pesos que fijamos: la regresión debe recuperarlos (error < 0,1).

    Se usan 3000 estudiantes porque con ~800 el error típico de cada peso ya es ~0,04
    y algunas semillas se salen de la tolerancia (con pocos datos los pesos son ruidosos).
    """
    reales = {"ED": {"b": -0.1, "pesos": {"CAL2": 0.6, "ALGLIN": 0.2}}}
    df, _ = simular(MALLA, n_estudiantes=3000, no_lineal=False, ruido=0.2, reales=reales)

    estimado = entrenar_regresion(preparar(df, MALLA, "ED"), MALLA, medias_por_materia(df, MALLA), alpha=0.01)

    assert abs(estimado["pesos"]["CAL2"] - 0.6) < 0.1
    assert abs(estimado["pesos"]["ALGLIN"] - 0.2) < 0.1
    # CAL1 es ancestro de ED pero no prerrequisito directo: su peso propio debe ser casi nulo.
    assert abs(estimado["pesos"]["CAL1"]) < 0.1


def test_la_distancia_en_la_malla_encoge_al_ancestro_indirecto():
    """CAL1 solo llega a ED a través de CAL2: su peso debe quedar mucho más cerca de 0 que el directo.

    Se comparan dos ajustes con el MISMO alpha: uno con la penalización por distancia y otro
    con penalización uniforme. La distancia debe encoger a CAL1 (distancia 2) bastante más.
    """
    reales = {"ED": {"b": 0.0, "pesos": {"CAL2": 0.6, "ALGLIN": 0.2}}}
    df, _ = simular(MALLA, n_estudiantes=600, no_lineal=False, ruido=0.2, reales=reales)
    datos = preparar(df, MALLA, "ED")
    mu = medias_por_materia(df, MALLA)

    con_distancia = entrenar_regresion(datos, MALLA, mu, alpha=10.0)
    # Misma forma cerrada, pero con todas las columnas penalizadas por igual (α = 10).
    a, Z = rasgos(datos, MALLA, mu)
    X = np.column_stack([a, Z])
    Xc = X - X.mean(axis=0)
    r = datos.y + datos.ybar - mu["ED"] - a
    uniforme = np.linalg.solve(Xc.T @ Xc + 10.0 * np.eye(X.shape[1]), Xc.T @ (r - r.mean()))
    indirecto = 1 + datos.ancestros.index("CAL1")
    directo = 1 + datos.ancestros.index("CAL2")

    # CAL1 (distancia 2) paga 4·α: se encoge mucho más que el prerrequisito directo CAL2.
    assert abs(con_distancia["pesos"]["CAL1"]) < 0.6 * abs(uniforme[indirecto])
    assert abs(con_distancia["pesos"]["CAL1"]) < 0.1 * abs(con_distancia["pesos"]["CAL2"])
    # El directo oficial casi no cambia frente a la penalización uniforme: la distancia no lo castiga.
    assert abs(con_distancia["pesos"]["CAL2"] - uniforme[directo]) < 1e-3


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
        assert set(curso) == {"b", "beta", "sigma", "pesos"}
        assert set(curso["pesos"]) == set(ancestros(MALLA, materia))
    assert set(pesos["medias"]) == {m["id"] for m in MALLA["materias"]}
    assert pesos["k_nivel"] == K_NIVEL


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
    df = pd.DataFrame(filas)
    datos = preparar(df, MALLA, "CAL2")
    assert np.allclose(datos.ybar, 4.0)  # solo CAL1
    assert np.allclose(datos.y, -1.0)  # 3,0 − 4,0
    # La historia que ve la regresión también es solo CAL1.
    ids = [m["id"] for m in MALLA["materias"]]
    assert np.allclose(datos.H[:, ids.index("CAL1")], 4.0)
    assert np.isnan(np.delete(datos.H, ids.index("CAL1"), axis=1)).all()


def test_nivel_y_desviaciones_a_mano():
    """μ = 3,0 en todo; notas previas CAL1 = 4,0 y ALGLIN = 2,5 → a = (1,0 − 0,5) / (2 + 1)."""
    filas = []
    for i in range(12):
        filas += [
            {"estudiante": f"e{i}", "materia": "CAL1", "periodo": "2024-1", "nota": 4.0},
            {"estudiante": f"e{i}", "materia": "ALGLIN", "periodo": "2024-1", "nota": 2.5},
            {"estudiante": f"e{i}", "materia": "CAL2", "periodo": "2024-2", "nota": 3.0},
            {"estudiante": f"e{i}", "materia": "ED", "periodo": "2025-1", "nota": 3.0},
        ]
    datos = preparar(pd.DataFrame(filas), MALLA, "CAL2")
    a, Z = rasgos(datos, MALLA, {m["id"]: 3.0 for m in MALLA["materias"]})
    assert datos.ancestros == ["CAL1"]
    assert np.allclose(a, 0.5 / 3)
    assert np.allclose(Z[:, 0], 1.0 - 0.5 / 3)


def test_validacion_devuelve_notas_en_escala():
    df, _ = simular(MALLA, n_estudiantes=60)
    preds = validar(preparar(df, MALLA, "ED"), df, MALLA)
    for p in preds.values():
        assert p.min() >= 0 and p.max() <= 5
