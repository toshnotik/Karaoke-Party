import asyncio
from typing import cast
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocket
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.realtime.manager import ConnectionManager, connection_manager
from app.rooms.store import room_store


@pytest.fixture(autouse=True)
def clear_runtime_state() -> None:
    room_store.clear()
    connection_manager.clear()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def create_room(client: TestClient) -> dict[str, object]:
    response = client.post("/api/rooms")
    assert response.status_code == 201
    return response.json()


def join_room(
    client: TestClient,
    room_code: str,
    name: str,
    player_token: str | None = None,
) -> dict[str, object]:
    payload = {"name": name}
    if player_token is not None:
        payload["playerToken"] = player_token
    response = client.post(f"/api/rooms/{room_code}/join", json=payload)
    assert response.status_code in (200, 201)
    return response.json()


def test_existing_room_connection_sends_current_room_version(
    client: TestClient,
) -> None:
    room = create_room(client)
    room_code = str(room["roomCode"])
    join_room(client, room_code, "First player")

    with client.websocket_connect(f"/ws/rooms/{room_code}") as websocket:
        assert websocket.receive_json() == {
            "type": "room.connected",
            "roomCode": room_code,
            "version": 2,
        }


def test_missing_room_connection_is_rejected(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as error:
        with client.websocket_connect("/ws/rooms/ZZZZ"):
            pass

    assert error.value.code == 1008


def test_two_clients_receive_update_for_same_room(client: TestClient) -> None:
    room_code = str(create_room(client)["roomCode"])

    with (
        client.websocket_connect(f"/ws/rooms/{room_code}") as first,
        client.websocket_connect(f"/ws/rooms/{room_code}") as second,
    ):
        first.receive_json()
        second.receive_json()

        joined = join_room(client, room_code, "Player")

        expected = {
            "type": "room.updated",
            "roomCode": room_code,
            "version": joined["room"]["version"],
        }
        assert first.receive_json() == expected
        assert second.receive_json() == expected


def test_join_update_contains_only_public_notification_fields(
    client: TestClient,
) -> None:
    room = create_room(client)
    room_code = str(room["roomCode"])

    with client.websocket_connect(f"/ws/rooms/{room_code}") as websocket:
        connected = websocket.receive_json()
        joined = join_room(client, room_code, "Player")
        updated = websocket.receive_json()

    assert set(connected) == {"type", "roomCode", "version"}
    assert set(updated) == {"type", "roomCode", "version"}
    event_text = str(updated)
    assert str(room["hostToken"]) not in event_text
    assert str(joined["playerToken"]) not in event_text
    assert "players" not in event_text
    assert "acceptedActions" not in event_text
    assert "result" not in event_text


def test_disconnect_of_one_client_does_not_affect_another(
    client: TestClient,
) -> None:
    room_code = str(create_room(client)["roomCode"])

    with client.websocket_connect(f"/ws/rooms/{room_code}") as remaining:
        remaining.receive_json()
        with client.websocket_connect(f"/ws/rooms/{room_code}") as leaving:
            leaving.receive_json()
        assert connection_manager.connection_count(room_code) == 1

        join_room(client, room_code, "Player")

        assert remaining.receive_json() == {
            "type": "room.updated",
            "roomCode": room_code,
            "version": 2,
        }


def test_reconnect_broadcast_depends_on_version_change(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room_code = str(create_room(client)["roomCode"])
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_room_updated", broadcast)
    joined = join_room(client, room_code, "Original")
    broadcast.reset_mock()

    join_room(client, room_code, "Original", str(joined["playerToken"]))
    broadcast.assert_not_awaited()

    renamed = join_room(client, room_code, "Renamed", str(joined["playerToken"]))
    broadcast.assert_awaited_once_with(room_code, renamed["room"]["version"])


def test_invalid_join_does_not_broadcast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room_code = str(create_room(client)["roomCode"])
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_room_updated", broadcast)

    response = client.post(
        f"/api/rooms/{room_code}/join",
        json={"name": "Player", "playerToken": "invalid"},
    )

    assert response.status_code == 401
    broadcast.assert_not_awaited()


class FakeWebSocket:
    def __init__(self, fail_on_send: bool = False) -> None:
        self.fail_on_send = fail_on_send
        self.events: list[dict[str, object]] = []

    async def accept(self) -> None:
        pass

    async def send_json(self, event: dict[str, object]) -> None:
        if self.fail_on_send:
            raise RuntimeError("connection closed")
        self.events.append(event)


def test_rooms_are_isolated_and_dead_connection_is_removed() -> None:
    manager = ConnectionManager()
    room_one = FakeWebSocket()
    room_two = FakeWebSocket()
    dead = FakeWebSocket(fail_on_send=True)

    async def scenario() -> None:
        await manager.connect("ONE1", cast(WebSocket, room_one), 1)
        await manager.connect("TWO2", cast(WebSocket, room_two), 1)
        dead.fail_on_send = False
        await manager.connect("ONE1", cast(WebSocket, dead), 1)
        dead.fail_on_send = True
        room_one.events.clear()
        room_two.events.clear()

        await manager.broadcast_room_updated("ONE1", 2)

    asyncio.run(scenario())

    assert room_one.events == [
        {"type": "room.updated", "roomCode": "ONE1", "version": 2}
    ]
    assert room_two.events == []
    assert manager.connection_count("ONE1") == 1
    assert manager.connection_count("TWO2") == 1
