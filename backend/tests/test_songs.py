import json
from pathlib import Path

import pytest

from app.game.errors import InvalidGameConfiguration
from app.songs import load_songs


def write_manifest(path: Path, songs: object) -> None:
    path.write_text(json.dumps(songs), encoding="utf-8")


def valid_song() -> dict[str, object]:
    return {
        "id": "song-1",
        "title": "Test Song",
        "artist": "Test Artist",
        "year": 2001,
        "audio_file": "test-song.mp3",
        "preview_start": 12,
        "preview_duration": 8,
    }


def test_loads_valid_song_manifest(tmp_path: Path) -> None:
    path = tmp_path / "songs.json"
    write_manifest(path, [valid_song()])

    songs = load_songs(path)

    assert songs[0].title == "Test Song"
    assert songs[0].year == 2001
    assert songs[0].audio_file == "test-song.mp3"


@pytest.mark.parametrize(
    ("contents", "message"),
    [
        ("not-json", "invalid JSON"),
        (json.dumps([]), "at least one song"),
        (json.dumps([{"id": "song-1"}]), "missing required fields"),
    ],
)
def test_rejects_invalid_manifests(
    tmp_path: Path,
    contents: str,
    message: str,
) -> None:
    path = tmp_path / "songs.json"
    path.write_text(contents, encoding="utf-8")

    with pytest.raises(InvalidGameConfiguration, match=message):
        load_songs(path)


def test_rejects_missing_manifest(tmp_path: Path) -> None:
    with pytest.raises(InvalidGameConfiguration, match="not found"):
        load_songs(tmp_path / "missing.json")
