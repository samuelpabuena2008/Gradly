# Plan del código base — Gradly

Predictor de rendimiento académico por estudiante (MAT 4021, Uninorte).
Entrega: domingo 15 de noviembre, 11:59 pm. El ejecutable se congela el viernes 13.

## 1. Arquitectura

Monorepo con tres partes que se comunican solo por archivos JSON/CSV:

```
Gradly/
├── data/                 # Contrato compartido (lo usan web, model y api)
│   ├── malla_sistemas.json   # Malla como grafo: materias, prerrequisitos, aristas blandas
│   ├── malla_prueba.json     # Malla pequeña hecha a mano (pruebas con resultado conocido)
│   ├── plantilla_notas.csv   # Formato de entrada: materia,periodo,nota
│   ├── pesos.json            # Modelo exportado por model/ y leído por web/
│   ├── schemas/              # Esquemas JSON del contrato (malla, pesos)
│   └── fixtures/             # Caso de predicción conocido que resuelven Python y TypeScript
│
├── web/                  # Frente 4 (+ Frente 2): React + TypeScript + Vite
│   └── src/
│       ├── types/            # Tipos del contrato, un archivo por dominio (malla, notas, modelo)
│       ├── lib/
│       │   ├── graph/        # Frente 2: orden topológico, camino más largo, centralidad, descendientes
│       │   ├── model/        # Inferencia en el navegador: predicción, rango, riesgo, "por qué"
│       │   └── import/       # Leer CSV de notas
│       ├── features/         # Pantallas por funcionalidad
│       │   ├── malla/        # Grafo interactivo (React Flow)
│       │   ├── notas/        # Importar notas
│       │   └── prediccion/   # Semáforo, "por qué", recomendación de enfoque
│       ├── App.tsx
│       └── main.tsx
│
├── model/                # Frente 3 (+ Frente 1): Python
│   ├── gradly_model/
│   │   ├── malla.py          # Cargar la malla
│   │   ├── simulate.py       # Estudiantes simulados con pesos conocidos + ruido
│   │   └── train.py          # Baseline vs regresión vs MLP, validación, exportar pesos.json
│   └── tests/
│
├── api/                  # Backend opcional: FastAPI (solo donaciones anónimas)
│   ├── app/
│   │   ├── config.py         # Variables de entorno
│   │   ├── db.py             # Conexión (SQLite local, Postgres/Supabase en producción)
│   │   ├── models.py         # Tablas
│   │   ├── schemas.py        # Lo que entra y sale de la API
│   │   ├── services/         # Lógica (validar, anonimizar, guardar)
│   │   ├── routers/          # Endpoints
│   │   └── main.py
│   └── tests/
│
└── docs/                 # Frente 5: plan, documento LaTeX, diapositivas
```

### Por qué no la estructura MVC genérica (src/controllers, services, models…)

Esa estructura sirve para **un solo servidor** (por ejemplo, una API en Node). Este proyecto tiene
tres programas en dos lenguajes y la parte principal (la predicción) corre en el navegador, sin servidor.
Por eso:

- **Se separa por programa** (`web/`, `model/`, `api/`): cada frente trabaja en su carpeta sin pisar a otro.
- **La idea de capas sí se conserva dentro de `api/`**: `routers/` hace de *controllers*, `services/` y
  `models/` quedan igual, y `config.py` reemplaza a `config/`.
- **En `web/` se organiza por funcionalidad** (`features/malla`, `features/notas`…) y la lógica pura va en
  `lib/`. Así los algoritmos de grafos y del modelo se prueban sin abrir el navegador.
- **Las pruebas van junto al código** (`*.test.ts`, `model/tests`, `api/tests`) en vez de un `tests/` global.
- **Sin archivos que todos editen**: los tipos están partidos por dominio (`types/malla.ts`, `notas.ts`,
  `modelo.ts`) y cada pantalla tiene su propio CSS en su carpeta; `index.css` solo tiene lo común.
- **La fórmula vive en dos lenguajes** (Python para entrenar, TypeScript para predecir). Ambas resuelven el
  mismo caso de `data/fixtures/`; si alguien cambia una sin la otra, falla una prueba.
- **El contrato de datos se valida**: `data/schemas/` + `model/tests/test_contrato_datos.py` revisan que la
  malla, los pesos, la plantilla y los fixtures cumplan el formato y usen los mismos códigos de materia.
- **`dist/`/`build/` no se versionan**: se generan con `npm run build` y están en `.gitignore`.

## 2. Contrato de datos (lo que todos deben respetar)

**Malla** (`data/malla_*.json`):
```json
{
  "programa": "Ingeniería de Sistemas",
  "version": "ejemplo",
  "nota_aprobacion": 3.0,
  "materias": [{ "id": "CAL1", "nombre": "Cálculo I", "semestre": 1, "creditos": 4 }],
  "prerrequisitos": [{ "de": "CAL1", "a": "CAL2" }],
  "aristas_blandas": [{ "de": "ALGLIN", "a": "ED" }]
}
```

**Notas** (CSV): `materia,periodo,nota`. Escala 0–5. Si una materia aparece repetida, cuenta el intento
más reciente.

**Modelo** (`data/pesos.json`):
```json
{
  "tipo": "regresion_nivel",
  "sigma_global": 0.45,
  "k_nivel": 1,
  "medias": { "CAL1": 3.6, "CAL2": 3.2, "ALGLIN": 3.4, "ED": 3.1 },
  "cursos": { "ED": { "b": -0.1, "beta": 1.1, "sigma": 0.4, "pesos": { "CAL2": 0.6, "ALGLIN": 0.2 } } }
}
```

Fórmula, **solo con materias anteriores** (cambiada el 10 nov; ver `docs/modelo/DECISIONES.md`):

ŷ(s,c) = μ(c) + b(c) + β(c) · a(s) + Σ w(p→c) · z(s,p)

- μ(c): media de la materia (`medias`).
- a(s) = Σ (y(s,p) − μ(p)) / (n + k_nivel): nivel del estudiante sobre sus n materias con nota.
- z(s,p) = (y(s,p) − μ(p)) − a(s): cómo le fue en p frente a su propio nivel.
- p recorre los ancestros de c en la malla (prerrequisitos directos e indirectos, y aristas blandas).
- Sin pesos para c: ŷ = μ(c) + a(s), con `sigma_global`.

- Rango: ŷ ± σ(c).
- Riesgo: P(no aprobar) = Φ((3,0 − ŷ) / σ(c)). Verde < 20 %, amarillo < 50 %, rojo ≥ 50 %.
- "Por qué": las 3 materias previas con mayor |w · z|.

## 3. Pasos

| # | Paso | Frente | Hecho cuando… |
|---|------|--------|---------------|
| 1 | Esqueleto del repo, README, `.gitignore` | 5 | Todos pueden clonar y correr |
| 2 | Malla de ejemplo + malla de prueba + plantilla CSV | 1 | JSON válido y sin ciclos |
| 3 | Algoritmos de grafos en TS + pruebas a mano | 2 | Las pruebas pasan con los valores calculados en papel |
| 4 | Simulador + entrenamiento (baseline, ridge, MLP) | 3 | El modelo recupera los pesos simulados y le gana al promedio |
| 5 | Inferencia en TS + pantalla (malla, importar, semáforo, por qué) | 4 | Se sube un CSV y se ven predicciones coloreadas |
| 6 | API de donaciones (FastAPI) | 1/4 | Guarda notas sin datos personales; rechaza si no hay consentimiento |
| 7 | Reemplazar la malla de ejemplo por la oficial de Sistemas (hecho el 13 nov; la de ejemplo queda en `data/malla_ejemplo.json` para las pruebas) | 1 | IDs y prerrequisitos verificados con el catálogo |
| 8 | Exportar el MLP a JSON y correrlo en TS | 3/4 | La web puede usar lineal o red |

Los pasos 1 a 6 ya están en el código base (10 nov). Los pasos 7 y 8 son lo siguiente.

## 4. Pruebas

Cada parte guarda sus pruebas junto a su código. Se corren con `npm test` (en `web/`) y `pytest`
(en `model/` y en `api/`).

| Dónde | Qué prueba |
|---|---|
| `web/src/lib/graph/dag.test.ts` | Algoritmos de grafos con la malla pequeña hecha a mano |
| `web/src/lib/model/predict.test.ts` | Predicción, rango y semáforo con pesos fijos |
| `web/src/lib/import/csv.test.ts` | Lectura del CSV: separadores, coma decimal, notas fuera de 0–5 |
| `model/tests/test_modelo.py` | Recupera los pesos simulados, le gana al promedio, sin fuga de datos |
| `web/src/lib/model/contrato.test.ts` y `model/tests/test_contrato_prediccion.py` | El mismo caso conocido da lo mismo en TypeScript y en Python |
| `model/tests/test_contrato_datos.py` | `data/` cumple los esquemas, sin ciclos, y todos usan los mismos códigos |
| `api/tests/test_donaciones.py` | Sin datos personales, con consentimiento, exportación con token |

### Resultados calculados a mano (`data/malla_prueba.json`)

```
A ──► B ──► D ──► E
 └──► C ──┘
F (aislada)
```

| Medida | Esperado |
|---|---|
| Camino más largo | A → B → D → E (4 materias; A → C → D → E empata) |
| Grado de salida | A = 2, B = 1, C = 1, D = 1, E = 0, F = 0 |
| Intermediación | D = 3, B = 1, C = 1, el resto 0 |
| Descendientes de B | D, E |

Intermediación de D: está en todos los caminos A→E, B→E y C→E (1 + 1 + 1 = 3).
B: de los 2 caminos A→D, uno pasa por B (½); igual para A→E (½); total 1. C es simétrico.

### Predicción calculada a mano

Medias: CAL1 = 3,6, ALGLIN = 3,4, CAL2 = 3,2, ED = 3,1.
Pesos: ED con b = −0,1, β = 1,1, σ = 0,5, CAL2 → ED = 0,6, ALGLIN → ED = 0,2.
Notas: CAL1 = 4,0, ALGLIN = 3,5, CAL2 = 2,5, así que las desviaciones son +0,4, +0,1 y −0,7.

a = (0,4 + 0,1 − 0,7) / (3 + 1) = −0,05; z(CAL2) = −0,65; z(ALGLIN) = 0,15.
ŷ = 3,1 − 0,1 + 1,1·(−0,05) + 0,6·(−0,65) + 0,2·(0,15) = **2,585**
P(no aprobar) = Φ((3 − 2,585) / 0,5) = Φ(0,83) ≈ **0,797**, así que el semáforo queda en rojo.

## 5. Decisiones tomadas

- **React + TypeScript + Vite**, grafo con **React Flow** (`@xyflow/react`). Las posiciones salen del semestre
  de cada materia, así que no hace falta una librería de layout.
- **Modelo lineal como JSON** y suma en TS; sin ONNX por ahora. El MLP está escrito en NumPy
  (`model/gradly_model/red.py`), se exporta en `pesos.json` y corre en TS (`web/src/lib/model/red.ts`).
- **Backend: FastAPI + SQLModel**. En local usa SQLite; para producción basta cambiar `DATABASE_URL` a un
  Postgres (por ejemplo, Supabase). La web funciona sin backend.
- **La simulación tiene una parte no lineal** (un castigo extra si un prerrequisito quedó por debajo de 3,0)
  para que la comparación lineal vs. red tenga sentido.
- **Validación por estudiante** (GroupKFold): nunca se evalúa con estudiantes del entrenamiento.
