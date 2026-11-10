"""Lo que entra y sale de la API."""

from pydantic import BaseModel, ConfigDict, Field


class NotaIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    materia: str = Field(min_length=1, max_length=20)
    periodo: str = Field(pattern=r"^\d{4}-[123]$")  # AAAA-S
    nota: float = Field(ge=0, le=5)


class DonacionIn(BaseModel):
    # extra="forbid": si la web manda nombre, código u otro dato, se rechaza (422).
    model_config = ConfigDict(extra="forbid")

    consentimiento: bool  # autorización previa, expresa e informada (Ley 1581 de 2012)
    programa: str = Field(min_length=1, max_length=80)
    version_malla: str = Field(min_length=1, max_length=40)
    notas: list[NotaIn] = Field(min_length=1, max_length=120)


class DonacionOut(BaseModel):
    id: str
    notas_guardadas: int


class ResumenOut(BaseModel):
    donaciones: int
    notas: int
