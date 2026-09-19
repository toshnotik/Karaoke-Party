import os
from dataclasses import dataclass


def _cors_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = "Karaoke Party API"
    cors_origins: tuple[str, ...] = tuple(_cors_origins())


settings = Settings()

