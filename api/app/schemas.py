"""Lo que entra y sale de la API."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotaIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    materia: str = Field(min_length=1, max_length=20)
    periodo: str = Field(pattern=r"^\d{4}-[123]$")  # AAAA-S
    nota: float = Field(ge=0, le=5, allow_inf_nan=False)

    @field_validator("materia")
    @classmethod
    def normalizar_materia(cls, v: str) -> str:
        return v.upper()


class DonacionIn(BaseModel):
    # extra="forbid": si la web manda nombre, código u otro dato, se rechaza (422).
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

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


class VersionStatsOut(BaseModel):
    programa: str
    version_malla: str
    donaciones: int
    notas: int


class EstadisticasOut(BaseModel):
    donaciones: int
    notas: int
    por_version: list[VersionStatsOut]
    por_materia: dict[str, int]


class MateriaMetaOut(BaseModel):
    id: str
    nombre: str
    semestre: int
    creditos: int


class MallaMetaOut(BaseModel):
    programa: str
    universidad: str | None = None
    version: str
    nota_aprobacion: float
    materias: list[MateriaMetaOut]
