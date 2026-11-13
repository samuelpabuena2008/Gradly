"""Red neuronal (perceptrón de una capa oculta) escrita en NumPy, sin librerías de deep learning.

Una red pequeña por materia objetivo, con la MISMA entrada que la regresión:

    x_p  = y(s,p) − ȳ(s)            desviación en cada materia previa (0 si no la cursó)
    h    = tanh(x · W1 + b1)        capa oculta (`oculta` neuronas)
    o    = h · W2 + b2              salida: desviación esperada en la materia objetivo
    ŷ    = ȳ(s) + o

A diferencia de la regresión, la capa oculta puede aprender efectos no lineales (por ejemplo,
que una mala base pese más que una buena). Propagación, retropropagación y el optimizador Adam
están escritos a mano para poder explicarlos en la sustentación; la prueba
`test_retropropagacion_coincide_con_diferencias_finitas` comprueba el gradiente.

El entrenamiento aparta un 15 % de las filas para elegir cuántas épocas convienen (parada
temprana) y después reajusta con TODOS los datos esas mismas épocas: con pocos estudiantes,
desperdiciar ese 15 % se nota en el error.
"""

import numpy as np


def propagar(p: dict, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Propagación hacia adelante. Devuelve la salida (n,) y la activación oculta (n, H)."""
    h = np.tanh(X @ p["W1"] + p["b1"])
    return h @ p["W2"] + p["b2"], h


def perdida_y_gradientes(p: dict, X: np.ndarray, y: np.ndarray, l2: float) -> tuple[float, dict]:
    """Error cuadrático medio + penalización L2, y su gradiente respecto a cada parámetro.

    Retropropagación: la regla de la cadena aplicada capa por capa, de la salida a la entrada.
    """
    o, h = propagar(p, X)
    n = len(y)
    err = o - y
    perdida = float(err @ err / n + l2 * ((p["W1"] ** 2).sum() + (p["W2"] ** 2).sum()))
    d_o = 2.0 * err / n                              # dL/do
    d_pre = np.outer(d_o, p["W2"]) * (1.0 - h**2)    # dL/d(pre-activación); tanh' = 1 − tanh²
    grad = {
        "W2": h.T @ d_o + 2 * l2 * p["W2"],
        "b2": d_o.sum(),
        "W1": X.T @ d_pre + 2 * l2 * p["W1"],
        "b1": d_pre.sum(axis=0),
    }
    return perdida, grad


class RedNeuronal:
    """Misma interfaz que los modelos de scikit-learn: fit(X, y) y predict(X)."""

    def __init__(self, oculta: int = 8, l2: float = 1e-3, lr: float = 0.01, epocas: int = 400,
                 paciencia: int = 30, lote: int = 32, semilla: int = 0, reajuste: int = 40):
        self.oculta, self.l2, self.lr = oculta, l2, lr
        self.epocas, self.paciencia, self.lote, self.semilla = epocas, paciencia, lote, semilla
        self.reajuste = reajuste
        self.params: dict | None = None

    def _arranque(self, rng: np.random.Generator, k: int, y: np.ndarray) -> dict:
        """W1 con escala 1/√k (cada neurona ve una combinación de desviaciones) y salida casi nula."""
        return {
            "W1": rng.normal(0, np.sqrt(1.0 / k), (k, self.oculta)),
            "b1": np.zeros(self.oculta),
            "W2": rng.normal(0, 0.01, self.oculta),  # casi cero: arranca prediciendo el promedio
            "b2": float(y.mean()),
        }

    def _entrenar(self, p: dict, X: np.ndarray, y: np.ndarray, rng: np.random.Generator,
                  idx: np.ndarray, m: dict, v: dict, paso: int, epocas: int) -> int:
        """Adam sobre `idx` durante `epocas` pasadas completas. Devuelve el contador de pasos."""
        for _ in range(epocas):
            rng.shuffle(idx)
            for ini in range(0, len(idx), self.lote):
                b = idx[ini : ini + self.lote]
                _, g = perdida_y_gradientes(p, X[b], y[b], self.l2)
                paso += 1
                for c in p:
                    m[c] = 0.9 * m[c] + 0.1 * g[c]
                    v[c] = 0.999 * v[c] + 0.001 * g[c] ** 2
                    p[c] = p[c] - self.lr * (m[c] / (1 - 0.9**paso)) / (np.sqrt(v[c] / (1 - 0.999**paso)) + 1e-8)
        return paso

    def fit(self, X: np.ndarray, y: np.ndarray) -> "RedNeuronal":
        rng = np.random.default_rng(self.semilla)
        n, k = X.shape
        copia = lambda q: {c: np.array(w, copy=True) for c, w in q.items()}
        # Parada temprana: se aparta el 15 % de las filas (cada fila es un estudiante distinto)
        # y se guarda la red con menor error ahí. Con muy pocos datos no se aparta nada.
        n_val = int(round(0.15 * n)) if n >= 40 else 0
        if not n_val:
            p = self._arranque(rng, k, y)
            m = {c: np.zeros_like(w) for c, w in p.items()}
            v = {c: np.zeros_like(w) for c, w in p.items()}
            self._entrenar(p, X, y, rng, np.arange(n), m, v, 0, min(self.epocas, 100))
            self.params = p
            return self

        orden = rng.permutation(n)
        val, ent = orden[:n_val], orden[n_val:]
        p = self._arranque(rng, k, y)
        m = {c: np.zeros_like(w) for c, w in p.items()}
        v = {c: np.zeros_like(w) for c, w in p.items()}
        mejor, mejor_p, sin_mejora, paso = np.inf, copia(p), 0, 0
        for _ in range(self.epocas):
            paso = self._entrenar(p, X, y, rng, ent, m, v, paso, 1)
            error = float(np.mean(np.abs(propagar(p, X[val])[0] - y[val])))
            if error < mejor - 1e-4:
                mejor, mejor_p, sin_mejora = error, copia(p), 0
            else:
                sin_mejora += 1
                if sin_mejora >= self.paciencia:
                    break

        # La validación dice CUÁNTAS épocas convienen; el ajuste final usa TODOS los datos.
        # Así no se desperdicia el 15 % apartado (con pocos estudiantes se nota en el MAE).
        p = copia(mejor_p)
        if self.reajuste:
            m = {c: np.zeros_like(w) for c, w in p.items()}
            v = {c: np.zeros_like(w) for c, w in p.items()}
            self._entrenar(p, X, y, rng, np.arange(n), m, v, 0, self.reajuste)
        self.params = p
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return propagar(self.params, X)[0]

    def exportar(self) -> dict:
        """Pesos en listas, para data/pesos.json (W1: previas × oculta)."""
        p = self.params
        return {"W1": p["W1"].tolist(), "b1": p["b1"].tolist(), "W2": p["W2"].tolist(), "b2": float(p["b2"])}
