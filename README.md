# Gradly

Predictor de rendimiento académico por estudiante. Proyecto final de Matemáticas Discretas (MAT 4021), Uninorte.

El estudiante importa sus notas y ve, sobre la malla de su carrera, cómo le puede ir en las materias que vienen,
con un semáforo de riesgo, el "por qué" de cada predicción y qué conviene repasar.
**Las notas se procesan en el navegador y no salen del computador del estudiante.**

## Estructura

```
data/    Contrato compartido: malla (JSON), plantilla de notas (CSV), pesos del modelo (JSON)
web/     App web: React + TypeScript + Vite (grafos, predicción, interfaz)
model/   Python: estudiantes simulados, entrenamiento y validación, exporta data/pesos.json
api/     Backend opcional (FastAPI): recibe notas donadas con autorización
docs/    Plan, documento LaTeX y diapositivas
```

El plan completo y las decisiones están en [docs/PLAN.md](docs/PLAN.md).

## Requisitos

- Node 20 o superior
- Python 3.11 o superior

## Cómo correrlo

### Web

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas (grafos, predicción, CSV)
```

### Modelo (Python)

Desde la raíz del repo:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (en Mac/Linux: source .venv/bin/activate)
pip install -r model/requirements.txt -r api/requirements.txt
```

```bash
cd model
python -m gradly_model.train                   # simula 300 estudiantes, entrena y exporta ../data/pesos.json
python -m gradly_model.train --notas notas.csv # con datos reales: estudiante,materia,periodo,nota
python -m gradly_model.simulate --n 300        # solo genera ../data/simulados.csv
pytest
```

### API (opcional)

```bash
cd api
uvicorn app.main:app --reload    # http://localhost:8000/docs
pytest
```

Variables de entorno en [api/.env.example](api/.env.example). Sin `DATABASE_URL` usa SQLite local;
para producción basta poner la URL de un Postgres (por ejemplo, Supabase).

## Formato de los datos

**Notas** (`data/plantilla_notas.csv`): `materia,periodo,nota`, escala 0–5, periodo `AAAA-S`.
Si una materia se repite, cuenta el intento más reciente.

**Malla** (`data/malla_sistemas.json`): materias con su semestre, prerrequisitos (aristas dirigidas) y
aristas blandas (relaciones del mismo área que no son prerrequisito oficial).
⚠️ La malla actual es **de ejemplo**: hay que reemplazarla por el plan de estudios oficial.

**Modelo** (`data/pesos.json`): para cada materia, `b` (dificultad), `sigma` (error típico) y el peso de cada
materia previa. La predicción es

ŷ = ȳ + b + Σ w · (nota previa − ȳ)

donde ȳ es el promedio del estudiante en materias anteriores.

## Pruebas con resultado conocido

| Prueba | Dónde |
|---|---|
| Malla de 6 materias calculada a mano (orden topológico, camino más largo, centralidad, descendientes) | `web/src/lib/graph/dag.test.ts` |
| Predicción, rango y semáforo con pesos fijos | `web/src/lib/model/predict.test.ts` |
| Lectura del CSV | `web/src/lib/import/csv.test.ts` |
| El modelo recupera pesos simulados y le gana al promedio | `model/tests/test_modelo.py` |
| Donaciones sin datos personales y con consentimiento | `api/tests/test_donaciones.py` |
