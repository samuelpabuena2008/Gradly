"""Conexión a la base de datos."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def normalizar_database_url(database_url: str) -> str:
    """Normaliza URLs de Postgres para SQLAlchemy + psycopg v3."""
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


def crear_engine(database_url: str) -> Engine:
    url = normalizar_database_url(database_url)
    if url.startswith("sqlite"):
        opciones = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            opciones["poolclass"] = StaticPool  # base en memoria compartida (pruebas)
        return create_engine(url, **opciones)
    return create_engine(url, pool_pre_ping=True)


def init_db(engine: Engine) -> None:
    from . import models  # noqa: F401  registra las tablas

    SQLModel.metadata.create_all(engine)

    # Migración ligera por si ya existía una tabla local sin la columna huella.
    inspector = inspect(engine)
    if inspector.has_table("donacion"):
        columnas = {c["name"] for c in inspector.get_columns("donacion")}
        if "huella" not in columnas:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE donacion ADD COLUMN huella VARCHAR"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_donacion_huella ON donacion (huella)"))


def verificar_db(engine: Engine) -> None:
    """Comprueba conectividad ejecutando una consulta mínima."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
