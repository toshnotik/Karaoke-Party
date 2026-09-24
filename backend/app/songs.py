import json
from dataclasses import dataclass
from pathlib import Path

from app.game.errors import InvalidGameConfiguration


@dataclass(frozen=True)
class Song:
    id: str
    title: str
    artist: str
    year: int | None
    audio_file: str
    preview_start: int
    preview_duration: int


def load_songs(path: Path) -> tuple[Song, ...]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise InvalidGameConfiguration(f"Song manifest not found: {path}") from error
    except json.JSONDecodeError as error:
        raise InvalidGameConfiguration(f"Song manifest contains invalid JSON: {path}") from error

    if not isinstance(raw, list):
        raise InvalidGameConfiguration("Song manifest must contain a list")

    songs: list[Song] = []
    required = {
        "id",
        "title",
        "artist",
        "audio_file",
        "preview_start",
        "preview_duration",
    }
    for index, item in enumerate(raw):
        if not isinstance(item, dict) or not required.issubset(item):
            missing = sorted(required - set(item) if isinstance(item, dict) else required)
            raise InvalidGameConfiguration(
                f"Song at index {index} is missing required fields: {', '.join(missing)}"
            )
        try:
            songs.append(
                Song(
                    id=str(item["id"]),
                    title=str(item["title"]),
                    artist=str(item["artist"]),
                    year=int(item["year"]) if item.get("year") is not None else None,
                    audio_file=str(item["audio_file"]),
                    preview_start=int(item["preview_start"]),
                    preview_duration=int(item["preview_duration"]),
                )
            )
        except (TypeError, ValueError) as error:
            raise InvalidGameConfiguration(
                f"Song at index {index} contains invalid field values"
            ) from error

    if not songs:
        raise InvalidGameConfiguration("Song manifest must contain at least one song")
    return tuple(songs)
