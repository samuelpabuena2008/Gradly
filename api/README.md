# Gradly API

Backend en FastAPI + SQLModel para recolectar donaciones anónimas de notas (Ley 1581 de 2012) y exportar el CSV que consume `model/`.

La predicción de notas corre en el navegador del estudiante; esta API solo gestiona el formulario `/donar` y las donaciones autorizadas.

## Ejecución local

Desde la raíz del repo (con `.venv` activado):

```bash
pip install -r api/requirements.txt
cd api
uvicorn app.main:app --reload
```

- Formulario web de donación: `http://localhost:8000/donar`
- Documentación interactiva: `http://localhost:8000/docs`
- Healthcheck (incluye verificación de DB): `http://localhost:8000/salud`

## Endpoints

| Método y ruta | Descripción |
|---|---|
| `GET /donar` | Formulario web con autorización expresa (Ley 1581 de 2012) |
| `GET /donaciones/meta` | Programa, versión y materias aceptadas por la malla activa |
| `POST /donaciones` | Guarda una donación anónima si `consentimiento=true` (detecta duplicados con HMAC) |
| `GET /donaciones/resumen` | Conteo total de donaciones y notas |
| `GET /donaciones/estadisticas` | Desglose agregado por versión de malla y por materia |
| `GET /donaciones/export.csv` | Exporta `estudiante,materia,periodo,nota` (requiere header `X-Admin-Token`; soporta `?version_malla=` y `?programa=`) |

## Variables de entorno

Ver [api/.env.example](.env.example):

- `DATABASE_URL`: SQLite en local (`sqlite:///./gradly.db`), o la URL de Postgres en producción (ej. Supabase / Neon). Se normaliza `postgres://` y `postgresql://` a `postgresql+psycopg://`.
- `CORS_ORIGINS`: Orígenes permitidos separados por coma (ej. `https://gradly.vercel.app,http://localhost:5173`).
- `ADMIN_TOKEN`: Token secreto para `GET /donaciones/export.csv`. Vacío desactiva la exportación.
- `ANON_HASH_SECRET`: Secreto fijo para la huella HMAC-SHA256 anti-duplicados (sin guardar PII).
- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SEC`: Límite de envíos a `POST /donaciones` por ventana (por defecto `20` cada `60` s).
- `MALLA_PATH`: Ruta opcional al JSON de la malla (por defecto usa `../data/malla_sistemas.json`).

## Despliegue (Render / Railway + Supabase o Neon)

1. **Base de datos Postgres** (Supabase o Neon): copia la connection string (`postgresql://...`).
2. **API con Docker** (usando la **raíz del repo** como contexto de build):
   - Dockerfile: `api/Dockerfile`
   - Configura `DATABASE_URL`, `CORS_ORIGINS`, `ADMIN_TOKEN` y `ANON_HASH_SECRET`.
3. **API sin Docker (Python nativo en Render/Railway, Root Directory `.`):**
   - Build command: `pip install -r api/requirements.txt`
   - Start command: `uvicorn app.main:app --app-dir api --host 0.0.0.0 --port $PORT`

## Exportar y validar datos reales para `model/`

```bash
python api/scripts/verificar_export.py --url https://tu-api.onrender.com --token "$ADMIN_TOKEN" --version-malla oficial --salida data/donaciones_reales.csv
```

## Pruebas

```bash
cd api
pytest -v
```
