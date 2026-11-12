"""Tablas. Nada identificable: sin nombre, sin código de estudiante, sin hora exacta."""

import uuid
from datetime import date

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Donacion(SQLModel, table=True):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex, primary_key=True)  # id aleatorio
    fecha: date = Field(default_factory=date.today)
    programa: str
    version_malla: str
    # Huella HMAC-SHA256 opcional para evitar duplicar el mismo historial sin guardar PII.
    huella: str | None = Field(default=None, index=True, unique=True)


class NotaDonada(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("donacion_id", "materia", "periodo", name="uq_nota_donada_periodo"),)

    id: int | None = Field(default=None, primary_key=True)
    donacion_id: str = Field(foreign_key="donacion.id", index=True)
    materia: str
    periodo: str
    nota: float
