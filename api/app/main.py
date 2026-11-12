"""API opcional de Gradly: recibe notas donadas con autorización y sirve el formulario /donar.

La predicción NO pasa por aquí: corre en el navegador. La web funciona sin esta API.

Uso (desde api/):  uvicorn app.main:app --reload
"""

import math
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .config import Settings
from .db import crear_engine, init_db, verificar_db
from .rate_limit import LimitadorPeticiones
from .routers import donaciones
from .services.donaciones import cargar_malla

STATIC_DIR = Path(__file__).resolve().parent / "static"


def _limpiar_no_finitos(valor):
    if isinstance(valor, float) and not math.isfinite(valor):
        return str(valor)
    if isinstance(valor, dict):
        return {k: _limpiar_no_finitos(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_limpiar_no_finitos(v) for v in valor]
    if isinstance(valor, tuple):
        return tuple(_limpiar_no_finitos(v) for v in valor)
    return valor


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = crear_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        cargar_malla(settings.malla_path)
        init_db(engine)
        yield
        engine.dispose()

    app = FastAPI(title="Gradly API", version="0.2.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.limitador = LimitadorPeticiones(settings.rate_limit_max, settings.rate_limit_window_sec)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(donaciones.router)

    @app.exception_handler(RequestValidationError)
    async def manejar_error_validacion(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": jsonable_encoder(_limpiar_no_finitos(exc.errors()))},
        )

    @app.get("/donar", response_class=HTMLResponse, tags=["formulario"])
    def formulario_donacion():
        html_path = STATIC_DIR / "donar.html"
        return HTMLResponse(html_path.read_text(encoding="utf-8"))

    @app.get("/salud", tags=["sistema"])
    def salud(request: Request):
        try:
            verificar_db(request.app.state.engine)
        except SQLAlchemyError as e:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Base de datos no disponible",
            ) from e
        return {"estado": "ok"}

    return app


app = create_app()
