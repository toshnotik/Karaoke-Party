import os
from dataclasses import dataclass
from pathlib import Path


DEV_CORS_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|10\.[0-9]+\.[0-9]+\.[0-9]+|"
    r"192\.168\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[0-1])\."
    r"[0-9]+\.[0-9]+)(:[0-9]+)?$"
)


def _cors_origins() -> list[str]:
    configured_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]


def _cors_origin_regex() -> str | None:
    return os.getenv("CORS_ORIGIN_REGEX", DEV_CORS_ORIGIN_REGEX) or None


@dataclass(frozen=True)
class Settings:
    app_name: str = "Karaoke Party API"
    cors_origins: tuple[str, ...] = tuple(_cors_origins())
    cors_origin_regex: str | None = _cors_origin_regex()
    song_manifest_path: Path = Path(
        os.getenv(
            "SONG_MANIFEST_PATH",
            Path(__file__).resolve().parents[2] / "data" / "songs" / "songs.json",
        )
    )


settings = Settings()
