"""Configuración por variables de entorno (ver api/.env.example)."""

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

API_DIR = Path(__file__).resolve().parents[1]
RAIZ = API_DIR.parent

# Carga .env locales si existen sin sobrescribir variables ya definidas en el entorno.
load_dotenv(API_DIR / ".env", override=False)
load_dotenv(RAIZ / ".env", override=False)


def _parse_cors_origins(raw: str) -> list[str]:
    return [origen.strip() for origen in raw.split(",") if origen.strip()]


def _default_malla_path() -> Path:
    env_path = os.getenv("MALLA_PATH", "").strip()
    if env_path:
        return Path(env_path)
    en_raiz = RAIZ / "data" / "malla_sistemas.json"
    if en_raiz.exists():
        return en_raiz
    return API_DIR / "data" / "malla_sistemas.json"


@dataclass
class Settings:
    # SQLite en local; en producción, la URL de Postgres (por ejemplo, Supabase).
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./gradly.db").strip())
    # Orígenes que pueden llamar a la API (la web en desarrollo corre en el 5173).
    cors_origins: list[str] = field(
        default_factory=lambda: _parse_cors_origins(os.getenv("CORS_ORIGINS", "http://localhost:5173"))
    )
    # Token para descargar las donaciones. Si no está definido, la exportación queda apagada.
    admin_token: str | None = field(default_factory=lambda: os.getenv("ADMIN_TOKEN", "").strip() or None)
    malla_path: Path = field(default_factory=_default_malla_path)
    # Secreto para huella HMAC anti-duplicados (si no se define, usa uno efímero por instancia).
    anon_hash_secret: str = field(
        default_factory=lambda: os.getenv("ANON_HASH_SECRET", "").strip() or secrets.token_hex(32)
    )
    rate_limit_max: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_MAX", "20")))
    rate_limit_window_sec: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60")))
