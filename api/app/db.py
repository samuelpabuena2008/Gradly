"""Conexión a la base de datos."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def crear_engine(database_url: str) -> Engine:
    if database_url.startswith("sqlite"):
        opciones = {"connect_args": {"check_same_thread": False}}
        if database_url in ("sqlite://", "sqlite:///:memory:"):
            opciones["poolclass"] = StaticPool  # base en memoria compartida (pruebas)
        return create_engine(database_url, **opciones)
    return create_engine(database_url, pool_pre_ping=True)


def init_db(engine: Engine) -> None:
    from . import models  # noqa: F401  registra las tablas

    SQLModel.metadata.create_all(engine)


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
