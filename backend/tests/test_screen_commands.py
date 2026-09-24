from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.realtime.manager import connection_manager
from app.rooms.store import room_store


@pytest.fixture(autouse=True)
def clear_runtime_state() -> None:
    room_store.clear()
    connection_manager.clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def bearer(token: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def playing_room(client: TestClient) -> tuple[dict[str, object], dict[str, object]]:
    room = client.post("/api/rooms").json()
    player = client.post(
        f"/api/rooms/{room['roomCode']}/join",
        json={"name": "Player"},
    ).json()
    headers = bearer(room["hostToken"])
    assert client.post(
        f"/api/rooms/{room['roomCode']}/game/configure",
        headers=headers,
        json={"mode": "guess_song"},
    ).status_code == 200
    assert client.post(
        f"/api/rooms/{room['roomCode']}/game/start",
        headers=headers,
    ).status_code == 200
    assert client.post(
        f"/api/rooms/{room['roomCode']}/game/round/activate",
        headers=headers,
    ).status_code == 200
    return room, player


def send_continue(
    client: TestClient,
    room_code: object,
    token: object | None,
):
    headers = bearer(token) if token is not None else {}
    return client.post(
        f"/api/rooms/{room_code}/screen/commands",
        headers=headers,
        json={"command": "continue_audio"},
    )


def test_valid_host_emits_one_ephemeral_command_without_version_change(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room, _ = playing_room(client)
    before = client.get(f"/api/rooms/{room['roomCode']}").json()
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_screen_command", broadcast)

    response = send_continue(client, room["roomCode"], room["hostToken"])

    assert response.status_code == 202
    assert response.json() == {"command": "continue_audio"}
    after = client.get(f"/api/rooms/{room['roomCode']}").json()
    assert after["version"] == before["version"]
    broadcast.assert_awaited_once_with(room["roomCode"], "continue_audio")


def test_screen_command_rejects_missing_invalid_cross_room_and_player_tokens(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room, player = playing_room(client)
    other = client.post("/api/rooms").json()
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_screen_command", broadcast)

    for token in (None, "invalid", other["hostToken"], player["playerToken"]):
        response = send_continue(client, room["roomCode"], token)
        assert response.status_code == 401

    broadcast.assert_not_awaited()


def test_continue_rejected_outside_active_round_without_version_or_event(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room = client.post("/api/rooms").json()
    before = client.get(f"/api/rooms/{room['roomCode']}").json()
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_screen_command", broadcast)

    response = send_continue(client, room["roomCode"], room["hostToken"])

    assert response.status_code == 409
    assert client.get(f"/api/rooms/{room['roomCode']}").json()["version"] == before["version"]
    broadcast.assert_not_awaited()


def test_continue_rejected_while_responder_pending_without_version_or_event(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room, player = playing_room(client)
    room_code = room["roomCode"]
    assert client.post(
        f"/api/rooms/{room_code}/game/actions",
        headers=bearer(player["playerToken"]),
        json={"actionType": "buzz"},
    ).status_code == 200
    before = client.get(f"/api/rooms/{room_code}").json()
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_screen_command", broadcast)

    response = send_continue(client, room_code, room["hostToken"])

    assert response.status_code == 409
    assert client.get(f"/api/rooms/{room_code}").json()["version"] == before["version"]
    broadcast.assert_not_awaited()
