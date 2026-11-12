"""Lógica de las donaciones: validar, anonimizar, deduplicar y guardar."""

import csv
import hashlib
import hmac
import io
import json
from functools import lru_cache
from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from ..models import Donacion, NotaDonada
from ..schemas import DonacionIn, NotaIn

MIN_NOTAS_HUELLA = 3


class DonacionInvalida(ValueError):
    pass


class DonacionDuplicada(ValueError):
    pass


@lru_cache
def cargar_malla(malla_path: Path) -> dict:
    if not malla_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo de malla: {malla_path}")
    with open(malla_path, encoding="utf-8") as f:
        data = json.load(f)
    if "materias" not in data or not isinstance(data["materias"], list):
        raise ValueError(f"Malla inválida en {malla_path}: falta la lista 'materias'")
    return data


def materias_validas(malla_path: Path) -> frozenset[str]:
    return frozenset(m["id"] for m in cargar_malla(malla_path)["materias"])


def meta_malla(malla_path: Path) -> dict:
    malla = cargar_malla(malla_path)
    return {
        "programa": malla["programa"],
        "universidad": malla.get("universidad"),
        "version": malla["version"],
        "nota_aprobacion": malla["nota_aprobacion"],
        "materias": [
            {
                "id": m["id"],
                "nombre": m["nombre"],
                "semestre": m["semestre"],
                "creditos": m["creditos"],
            }
            for m in sorted(malla["materias"], key=lambda x: (x["semestre"], x["nombre"]))
        ],
    }


def calcular_huella(notas: list[NotaIn], version_malla: str, secreto: str) -> str:
    """Firma HMAC-SHA256 determinística sobre las notas canonizadas para detectar reenvíos."""
    canon = sorted((n.materia.upper(), n.periodo, round(float(n.nota), 4)) for n in notas)
    cuerpo = json.dumps({"v": version_malla, "n": canon}, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(secreto.encode("utf-8"), cuerpo.encode("utf-8"), hashlib.sha256).hexdigest()


def _validar_notas_sin_duplicados(notas: list[NotaIn], validas: frozenset[str]) -> None:
    desconocidas = sorted({n.materia.upper() for n in notas} - validas)
    if desconocidas:
        raise DonacionInvalida(f"Materias que no están en la malla: {', '.join(desconocidas)}")

    vistas: set[tuple[str, str]] = set()
    duplicadas: set[str] = set()
    for n in notas:
        clave = (n.materia.upper(), n.periodo)
        if clave in vistas:
            duplicadas.add(f"{clave[0]} ({clave[1]})")
        vistas.add(clave)
    if duplicadas:
        raise DonacionInvalida(f"Notas duplicadas en el mismo periodo: {', '.join(sorted(duplicadas))}")


def guardar_donacion(
    session: Session,
    datos: DonacionIn,
    validas: frozenset[str],
    secreto_huella: str = "",
) -> tuple[Donacion, int]:
    if not datos.consentimiento:
        raise DonacionInvalida("Sin autorización no se guarda nada")

    _validar_notas_sin_duplicados(datos.notas, validas)

    huella: str | None = None
    if len(datos.notas) >= MIN_NOTAS_HUELLA and secreto_huella:
        huella = calcular_huella(datos.notas, datos.version_malla, secreto_huella)
        existente = session.exec(select(Donacion).where(Donacion.huella == huella)).first()
        if existente is not None:
            raise DonacionDuplicada("Esta donación ya fue registrada anteriormente")

    donacion = Donacion(programa=datos.programa, version_malla=datos.version_malla, huella=huella)
    session.add(donacion)
    for n in datos.notas:
        session.add(NotaDonada(donacion_id=donacion.id, materia=n.materia.upper(), periodo=n.periodo, nota=n.nota))
    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        raise DonacionDuplicada("Esta donación ya fue registrada anteriormente") from e

    session.refresh(donacion)
    return donacion, len(datos.notas)


def resumen(session: Session) -> tuple[int, int]:
    donaciones = session.exec(select(func.count()).select_from(Donacion)).one()
    notas = session.exec(select(func.count()).select_from(NotaDonada)).one()
    return donaciones, notas


def estadisticas(session: Session) -> dict:
    donaciones, notas = resumen(session)
    filas_version = session.exec(
        select(
            Donacion.programa,
            Donacion.version_malla,
            func.count(func.distinct(Donacion.id)),
            func.count(NotaDonada.id),
        )
        .join(NotaDonada, NotaDonada.donacion_id == Donacion.id, isouter=True)
        .group_by(Donacion.programa, Donacion.version_malla)
        .order_by(Donacion.programa, Donacion.version_malla)
    ).all()
    filas_materia = session.exec(
        select(NotaDonada.materia, func.count(NotaDonada.id))
        .group_by(NotaDonada.materia)
        .order_by(func.count(NotaDonada.id).desc(), NotaDonada.materia)
    ).all()

    return {
        "donaciones": donaciones,
        "notas": notas,
        "por_version": [
            {"programa": prog, "version_malla": ver, "donaciones": n_don, "notas": n_not}
            for prog, ver, n_don, n_not in filas_version
        ],
        "por_materia": {mat: cnt for mat, cnt in filas_materia},
    }


def exportar_csv(
    session: Session,
    version_malla: str | None = None,
    programa: str | None = None,
) -> str:
    """Formato que lee model/: estudiante,materia,periodo,nota (estudiante = id aleatorio)."""
    consulta = (
        select(NotaDonada)
        .join(Donacion, NotaDonada.donacion_id == Donacion.id)
        .order_by(NotaDonada.donacion_id, NotaDonada.periodo, NotaDonada.materia)
    )
    if version_malla:
        consulta = consulta.where(Donacion.version_malla == version_malla)
    if programa:
        consulta = consulta.where(Donacion.programa == programa)

    salida = io.StringIO()
    escritor = csv.writer(salida, lineterminator="\n")
    escritor.writerow(["estudiante", "materia", "periodo", "nota"])
    for n in session.exec(consulta):
        escritor.writerow([n.donacion_id, n.materia, n.periodo, n.nota])
    return salida.getvalue()
