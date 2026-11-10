"""API opcional de Gradly: solo recibe notas donadas con autorización.

La predicción NO pasa por aquí: corre en el navegador. La web funciona sin esta API.

Uso (desde api/):  uvicorn app.main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .db import crear_engine, init_db
from .routers import donaciones


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = crear_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db(engine)
        yield
        engine.dispose()

    app = FastAPI(title="Gradly API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.include_router(donaciones.router)

    @app.get("/salud", tags=["sistema"])
    def salud():
        return {"estado": "ok"}

    return app


app = create_app()
