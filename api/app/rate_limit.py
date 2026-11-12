"""Limitador sencillo en memoria para evitar ráfagas sin almacenar IPs en base de datos."""

import hashlib
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


class LimitadorPeticiones:
    """Ventana deslizante por origen de petición (usa hash en memoria, nunca persiste IPs)."""

    def __init__(self, max_peticiones: int, ventana_seg: int) -> None:
        self.max_peticiones = max_peticiones
        self.ventana_seg = ventana_seg
        self._eventos: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _clave_cliente(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        ip = forwarded or (request.client.host if request.client else "desconocido")
        return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]

    def verificar(self, request: Request) -> None:
        if self.max_peticiones <= 0 or self.ventana_seg <= 0:
            return
        ahora = time.monotonic()
        limite = ahora - self.ventana_seg
        clave = self._clave_cliente(request)

        with self._lock:
            cola = self._eventos[clave]
            while cola and cola[0] <= limite:
                cola.popleft()
            if not cola and clave in self._eventos:
                del self._eventos[clave]
                cola = self._eventos[clave]
            if len(cola) >= self.max_peticiones:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Demasiadas peticiones seguidas. Espera un minuto antes de volver a intentar.",
                )
            cola.append(ahora)
