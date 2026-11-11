"""Medidas extra de validación para el informe.

Todo se calcula con las predicciones FUERA DE MUESTRA de `train.validar` (validación por
estudiante), nunca con datos que el modelo ya vio.
"""

from math import erf, sqrt

import numpy as np

from .predict import UMBRALES


def diferencia_mae(real, pred_a, pred_b, grupos, repeticiones: int = 2000, semilla: int = 0) -> dict:
    """MAE(a) − MAE(b) con intervalo del 95 % por bootstrap de ESTUDIANTES.

    Se remuestrean estudiantes completos (no notas sueltas) porque las notas de una misma
    persona no son independientes. Negativo = `a` se equivoca menos que `b`.
    """
    ea, eb = np.abs(real - pred_a), np.abs(real - pred_b)
    _, inv = np.unique(grupos, return_inverse=True)
    k = inv.max() + 1
    sa, sb, cnt = (np.bincount(inv, weights=w, minlength=k) for w in (ea, eb, np.ones_like(ea)))
    idx = np.random.default_rng(semilla).integers(0, k, size=(repeticiones, k))
    dif = (sa[idx].sum(1) - sb[idx].sum(1)) / cnt[idx].sum(1)
    return {
        "diferencia": float(ea.mean() - eb.mean()),
        "ic95": [float(np.percentile(dif, 2.5)), float(np.percentile(dif, 97.5))],
    }


def auc(puntaje: np.ndarray, positivo: np.ndarray) -> float:
    """Área bajo la curva ROC: probabilidad de que un caso positivo tenga más puntaje que uno negativo."""
    n_pos, n_neg = int(positivo.sum()), int((~positivo).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    orden = np.argsort(puntaje, kind="mergesort")
    rangos = np.empty(len(puntaje))
    rangos[orden] = np.arange(1, len(puntaje) + 1)
    for valor in np.unique(puntaje):  # empates: rango medio
        iguales = puntaje == valor
        if iguales.sum() > 1:
            rangos[iguales] = rangos[iguales].mean()
    return float((rangos[positivo].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def calibracion(real, pred, sigma, aprobacion: float) -> dict:
    """¿Son honestos el rango y el semáforo que ve el estudiante?

    - El rango ŷ ± σ debería contener la nota real cerca del 68 % de las veces.
    - En cada color del semáforo se mide qué fracción reprobó de verdad.
    """
    prob = np.array([(1 + erf((aprobacion - p) / (s * sqrt(2)))) / 2 for p, s in zip(pred, sigma)])
    reprobo = real < aprobacion
    colores = {
        "verde": prob < UMBRALES["amarillo"],
        "amarillo": (prob >= UMBRALES["amarillo"]) & (prob < UMBRALES["rojo"]),
        "rojo": prob >= UMBRALES["rojo"],
    }
    return {
        "cobertura_rango": float(np.mean(np.abs(real - pred) <= sigma)),
        "auc_riesgo": auc(prob, reprobo),
        "detectados_amarillo_o_rojo": float(reprobo[prob >= UMBRALES["amarillo"]].sum() / max(reprobo.sum(), 1)),
        "semaforo": {
            c: {"n": int(m.sum()), "reprobaron": float(reprobo[m].mean()) if m.any() else None}
            for c, m in colores.items()
        },
    }
