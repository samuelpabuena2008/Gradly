"""Configuración por variables de entorno (ver api/.env.example)."""

import os
from dataclasses import dataclass, field
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


@dataclass
class Settings:
    # SQLite en local; en producción, la URL de Postgres (por ejemplo, Supabase).
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./gradly.db"))
    # Orígenes que pueden llamar a la API (la web en desarrollo corre en el 5173).
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    )
    # Token para descargar las donaciones. Si no está definido, la exportación queda apagada.
    admin_token: str | None = field(default_factory=lambda: os.getenv("ADMIN_TOKEN") or None)
    malla_path: Path = field(
        default_factory=lambda: Path(os.getenv("MALLA_PATH", RAIZ / "data" / "malla_sistemas.json"))
    )
