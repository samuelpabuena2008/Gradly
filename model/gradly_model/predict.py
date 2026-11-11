"""Predicción con los pesos exportados: la MISMA fórmula que web/src/lib/model/predict.ts.

Sirve para revisar en Python lo que verá el estudiante en la web. Las dos versiones
se comparan con el caso de data/fixtures/prediccion_caso_conocido.json.

    ŷ(s,c) = ȳ(s) + b(c) + Σ w(p→c) · (y(s,p) − ȳ(s))
"""

from dataclasses import dataclass, field
from math import erf, sqrt, tanh

# Probabilidad de no aprobar a partir de la cual cambia el color del semáforo.
UMBRALES = {"amarillo": 0.2, "rojo": 0.5}


@dataclass
class Prediccion:
    materia: str
    nota: float
    rango: tuple[float, float]
    prob_no_aprobar: float
    semaforo: str
    por_que: list[tuple[str, float]] = field(default_factory=list)  # (materia previa, aporte)
    usa_modelo: bool = False


def normal_cdf(x: float) -> float:
    return (1 + erf(x / sqrt(2))) / 2


def ultimas_notas(notas: list[dict]) -> dict[str, float]:
    """Una nota por materia: si se repitió, cuenta el periodo más reciente."""
    ultima: dict[str, dict] = {}
    for n in notas:
        previa = ultima.get(n["materia"])
        if previa is None or n["periodo"] >= previa["periodo"]:
            ultima[n["materia"]] = n
    return {m: n["nota"] for m, n in ultima.items()}


def _semaforo(prob: float) -> str:
    if prob >= UMBRALES["rojo"]:
        return "rojo"
    if prob >= UMBRALES["amarillo"]:
        return "amarillo"
    return "verde"


def _limitar(x: float) -> float:
    return min(5.0, max(0.0, x))


def predecir_materia(materia: str, malla: dict, modelo: dict, notas: dict[str, float]) -> Prediccion | None:
    if not notas:
        return None
    ybar = sum(notas.values()) / len(notas)
    curso = modelo["cursos"].get(materia)

    nota, sigma, contribuciones = ybar, modelo["sigma_global"], []
    if curso:
        nota += curso["b"]
        sigma = curso["sigma"]
        for previa, w in curso["pesos"].items():
            if previa not in notas:
                continue  # materia previa sin nota: no aporta
            aporte = w * (notas[previa] - ybar)
            nota += aporte
            contribuciones.append((previa, aporte))

    nota = _limitar(nota)
    prob = normal_cdf((malla["nota_aprobacion"] - nota) / sigma)
    por_que = sorted((c for c in contribuciones if abs(c[1]) > 0.005), key=lambda c: -abs(c[1]))[:3]

    return Prediccion(
        materia=materia,
        nota=nota,
        rango=(_limitar(nota - sigma), _limitar(nota + sigma)),
        prob_no_aprobar=prob,
        semaforo=_semaforo(prob),
        por_que=por_que,
        usa_modelo=curso is not None,
    )


def salida_red(red: dict, x: list[float]) -> float:
    """Propagación hacia adelante de la red exportada: o = tanh(x·W1 + b1)·W2 + b2."""
    oculta = [
        tanh(sum(x[i] * red["W1"][i][j] for i in range(len(x))) + red["b1"][j]) for j in range(len(red["b1"]))
    ]
    return sum(h * w for h, w in zip(oculta, red["W2"])) + red["b2"]


def predecir_materia_red(materia: str, malla: dict, modelo: dict, notas: dict[str, float]) -> Prediccion | None:
    """Igual que `predecir_materia`, pero con la red neuronal: ŷ = ȳ + red(y_p − ȳ).

    El "por qué" se calcula por oclusión: cuánto cambia la predicción si se "olvida" la nota
    de una materia previa (se pone su desviación en 0, como si no la hubiera cursado).
    Si no hay red para la materia, usa la regresión.
    """
    red = modelo.get("red", {}).get("cursos", {}).get(materia)
    if not notas or red is None:
        return predecir_materia(materia, malla, modelo, notas)
    ybar = sum(notas.values()) / len(notas)
    x = [notas[p] - ybar if p in notas else 0.0 for p in red["previas"]]
    salida = salida_red(red, x)

    contribuciones = []
    for i, previa in enumerate(red["previas"]):
        if previa in notas:
            contribuciones.append((previa, salida - salida_red(red, x[:i] + [0.0] + x[i + 1 :])))

    nota = _limitar(ybar + salida)
    prob = normal_cdf((malla["nota_aprobacion"] - nota) / red["sigma"])
    por_que = sorted((c for c in contribuciones if abs(c[1]) > 0.005), key=lambda c: -abs(c[1]))[:3]
    return Prediccion(
        materia=materia,
        nota=nota,
        rango=(_limitar(nota - red["sigma"]), _limitar(nota + red["sigma"])),
        prob_no_aprobar=prob,
        semaforo=_semaforo(prob),
        por_que=por_que,
        usa_modelo=True,
    )
