"""Tablas. Nada identificable: sin nombre, sin código de estudiante, sin hora exacta."""

import uuid
from datetime import date

from sqlmodel import Field, SQLModel


class Donacion(SQLModel, table=True):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex, primary_key=True)  # id aleatorio
    fecha: date = Field(default_factory=date.today)
    programa: str
    version_malla: str


class NotaDonada(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    donacion_id: str = Field(foreign_key="donacion.id", index=True)
    materia: str
    periodo: str
    nota: float
