import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api import media as media_api
from app.main import app


@pytest.fixture
def media_source(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    songs = tmp_path / "songs"
    media = songs / "media"
    media.mkdir(parents=True)
    manifest = songs / "songs.json"
    manifest.write_text(json.dumps([
        {
            "id": "known-song",
            "title": "Known",
            "artist": "Artist",
            "year": 2001,
            "audio_file": "known.mp3",
            "preview_start": 10,
            "preview_duration": 8,
        },
        {
            "id": "missing-song",
            "title": "Missing",
            "artist": "Artist",
            "audio_file": "missing.mp3",
            "preview_start": 0,
            "preview_duration": 8,
        },
    ]), encoding="utf-8")
    (media / "known.mp3").write_bytes(b"ID3-test-audio")
    monkeypatch.setattr(
        media_api,
        "settings",
        SimpleNamespace(song_manifest_path=manifest, song_media_path=media),
    )
    return tmp_path


def test_known_song_returns_media(media_source: Path) -> None:
    with TestClient(app) as client:
        response = client.get("/api/media/songs/known-song")

    assert response.status_code == 200
    assert response.content == b"ID3-test-audio"
    assert response.headers["content-type"] == "audio/mpeg"
    assert str(media_source) not in str(response.headers)


@pytest.mark.parametrize(
    "song_id",
    ["unknown", "missing-song", "..%2F..%2Fsecret", "%2E%2E%2Fsecret"],
)
def test_unknown_missing_and_traversal_ids_are_not_served(
    media_source: Path,
    song_id: str,
) -> None:
    with TestClient(app) as client:
        response = client.get(f"/api/media/songs/{song_id}")

    assert response.status_code == 404
    assert "songs" not in response.json()["detail"].casefold()
