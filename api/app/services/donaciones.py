"""Lógica de las donaciones: validar, anonimizar y guardar."""

import csv
import io
import json
from functools import lru_cache
from pathlib import Path

from sqlmodel import Session, func, select

from ..models import Donacion, NotaDonada
from ..schemas import DonacionIn


class DonacionInvalida(ValueError):
    pass


@lru_cache
def materias_validas(malla_path: Path) -> frozenset[str]:
    with open(malla_path, encoding="utf-8") as f:
        return frozenset(m["id"] for m in json.load(f)["materias"])


def guardar_donacion(session: Session, datos: DonacionIn, validas: frozenset[str]) -> tuple[Donacion, int]:
    if not datos.consentimiento:
        raise DonacionInvalida("Sin autorización no se guarda nada")

    desconocidas = sorted({n.materia.upper() for n in datos.notas} - validas)
    if desconocidas:
        raise DonacionInvalida(f"Materias que no están en la malla: {', '.join(desconocidas)}")

    donacion = Donacion(programa=datos.programa, version_malla=datos.version_malla)
    session.add(donacion)
    for n in datos.notas:
        session.add(NotaDonada(donacion_id=donacion.id, materia=n.materia.upper(), periodo=n.periodo, nota=n.nota))
    session.commit()
    session.refresh(donacion)
    return donacion, len(datos.notas)


def resumen(session: Session) -> tuple[int, int]:
    donaciones = session.exec(select(func.count()).select_from(Donacion)).one()
    notas = session.exec(select(func.count()).select_from(NotaDonada)).one()
    return donaciones, notas


def exportar_csv(session: Session) -> str:
    """Formato que lee model/: estudiante,materia,periodo,nota (estudiante = id aleatorio)."""
    salida = io.StringIO()
    escritor = csv.writer(salida, lineterminator="\n")
    escritor.writerow(["estudiante", "materia", "periodo", "nota"])
    for n in session.exec(select(NotaDonada).order_by(NotaDonada.donacion_id, NotaDonada.periodo)):
        escritor.writerow([n.donacion_id, n.materia, n.periodo, n.nota])
    return salida.getvalue()
