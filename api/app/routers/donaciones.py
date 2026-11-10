"""Endpoints de donación de notas (opcional y con autorización)."""

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

from ..db import get_session
from ..schemas import DonacionIn, DonacionOut, ResumenOut
from ..services import donaciones as servicio

router = APIRouter(prefix="/donaciones", tags=["donaciones"])


@router.post("", response_model=DonacionOut, status_code=status.HTTP_201_CREATED)
def donar(datos: DonacionIn, request: Request, session: Session = Depends(get_session)):
    validas = servicio.materias_validas(request.app.state.settings.malla_path)
    try:
        donacion, n = servicio.guardar_donacion(session, datos, validas)
    except servicio.DonacionInvalida as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return DonacionOut(id=donacion.id, notas_guardadas=n)


@router.get("/resumen", response_model=ResumenOut)
def ver_resumen(session: Session = Depends(get_session)):
    donaciones, notas = servicio.resumen(session)
    return ResumenOut(donaciones=donaciones, notas=notas)


@router.get("/export.csv", response_class=PlainTextResponse)
def exportar(
    request: Request,
    x_admin_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
):
    esperado = request.app.state.settings.admin_token
    if not esperado or not x_admin_token or not secrets.compare_digest(x_admin_token, esperado):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token inválido o exportación desactivada")
    return PlainTextResponse(servicio.exportar_csv(session), media_type="text/csv")
