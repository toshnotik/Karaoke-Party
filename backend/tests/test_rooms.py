import asyncio
import re

import pytest
from httpx import ASGITransport, AsyncClient, Response

from app.main import app
from app.rooms.store import room_store


@pytest.fixture(autouse=True)
def clear_room_store() -> None:
    room_store.clear()


async def _request(
    method: str,
    path: str,
    json: dict[str, str] | None = None,
) -> Response:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        return await client.request(method, path, json=json)


def request(
    method: str,
    path: str,
    json: dict[str, str] | None = None,
) -> Response:
    return asyncio.run(_request(method, path, json))


def create_room() -> dict[str, object]:
    response = request("POST", "/api/rooms")
    assert response.status_code == 201
    return response.json()


def join_room(
    room_code: str,
    name: str,
    player_token: str | None = None,
) -> Response:
    payload = {"name": name}
    if player_token is not None:
        payload["playerToken"] = player_token
    return request("POST", f"/api/rooms/{room_code}/join", payload)


def test_create_room_returns_initial_state_and_secure_code() -> None:
    room = create_room()

    assert re.fullmatch(r"[A-HJ-NP-Z2-9]{4}", str(room["roomCode"]))
    assert room["status"] == "lobby"
    assert room["version"] == 1
    assert isinstance(room["hostToken"], str)
    assert len(room["hostToken"]) >= 32


def test_different_rooms_receive_different_host_tokens() -> None:
    first_room = create_room()
    second_room = create_room()

    assert first_room["hostToken"] != second_room["hostToken"]


def test_public_snapshot_excludes_private_tokens() -> None:
    room = create_room()
    join_response = join_room(str(room["roomCode"]), "Konstantin")
    player_token = join_response.json()["playerToken"]

    response = request("GET", f"/api/rooms/{room['roomCode']}")

    assert response.status_code == 200
    snapshot_text = response.text
    assert "hostToken" not in snapshot_text
    assert "playerToken" not in snapshot_text
    assert room["hostToken"] not in snapshot_text
    assert player_token not in snapshot_text


def test_join_player_returns_identity_token_and_updated_snapshot() -> None:
    room = create_room()

    response = join_room(str(room["roomCode"]), "Konstantin")

    assert response.status_code == 201
    body = response.json()
    assert body["player"]["name"] == "Konstantin"
    assert body["player"]["participationType"] == "remote"
    assert body["player"]["id"]
    assert len(body["playerToken"]) >= 32
    assert body["room"]["version"] == 2
    assert body["room"]["players"] == [body["player"]]


def test_each_new_player_increments_room_version() -> None:
    room = create_room()
    room_code = str(room["roomCode"])

    first_join = join_room(room_code, "First")
    second_join = join_room(room_code, "Second")

    assert first_join.json()["room"]["version"] == 2
    assert second_join.json()["room"]["version"] == 3
    assert len(second_join.json()["room"]["players"]) == 2


def test_reconnect_returns_same_player_without_duplicate_or_version_change() -> None:
    room = create_room()
    room_code = str(room["roomCode"])
    first_join = join_room(room_code, "Konstantin")
    first_body = first_join.json()

    reconnect = join_room(room_code, "Konstantin", first_body["playerToken"])

    assert reconnect.status_code == 200
    reconnect_body = reconnect.json()
    assert reconnect_body["player"] == first_body["player"]
    assert reconnect_body["playerToken"] == first_body["playerToken"]
    assert reconnect_body["room"]["version"] == 2
    assert len(reconnect_body["room"]["players"]) == 1


def test_reconnect_can_update_name_and_version() -> None:
    room = create_room()
    room_code = str(room["roomCode"])
    first_join = join_room(room_code, "Old name").json()

    reconnect = join_room(room_code, "  New name  ", first_join["playerToken"])

    assert reconnect.status_code == 200
    body = reconnect.json()
    assert body["player"]["id"] == first_join["player"]["id"]
    assert body["player"]["name"] == "New name"
    assert body["room"]["version"] == 3
    assert len(body["room"]["players"]) == 1


def test_unknown_player_token_is_rejected_without_creating_player() -> None:
    room = create_room()
    room_code = str(room["roomCode"])

    response = join_room(room_code, "Konstantin", "unknown-token")
    snapshot = request("GET", f"/api/rooms/{room_code}").json()

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid player token"}
    assert snapshot["version"] == 1
    assert snapshot["players"] == []


def test_player_token_from_another_room_is_rejected() -> None:
    first_room = create_room()
    second_room = create_room()
    player_token = join_room(
        str(first_room["roomCode"]),
        "Konstantin",
    ).json()["playerToken"]

    response = join_room(str(second_room["roomCode"]), "Konstantin", player_token)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid player token"}


def test_room_not_found() -> None:
    response = request("GET", "/api/rooms/ZZZZ")

    assert response.status_code == 404
    assert response.json() == {"detail": "Room not found"}


@pytest.mark.parametrize("name", ["", "   ", "x" * 41])
def test_invalid_player_name_is_rejected(name: str) -> None:
    room = create_room()

    response = join_room(str(room["roomCode"]), name)

    assert response.status_code == 422


def test_player_name_is_trimmed() -> None:
    room = create_room()

    response = join_room(str(room["roomCode"]), "  Konstantin  ")

    assert response.status_code == 201
    assert response.json()["player"]["name"] == "Konstantin"


def test_duplicate_display_names_are_allowed() -> None:
    room = create_room()
    room_code = str(room["roomCode"])

    first_player = join_room(room_code, "Same name").json()["player"]
    second_player = join_room(room_code, "Same name").json()["player"]

    assert first_player["id"] != second_player["id"]


def test_concurrent_joins_keep_every_player_and_version() -> None:
    async def join_concurrently() -> tuple[list[Response], Response]:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            room = (await client.post("/api/rooms")).json()
            room_code = room["roomCode"]
            responses = await asyncio.gather(
                *(
                    client.post(
                        f"/api/rooms/{room_code}/join",
                        json={"name": f"Player {index}"},
                    )
                    for index in range(20)
                )
            )
            snapshot = await client.get(f"/api/rooms/{room_code}")
            return responses, snapshot

    responses, snapshot_response = asyncio.run(join_concurrently())
    snapshot = snapshot_response.json()

    assert all(response.status_code == 201 for response in responses)
    assert len(snapshot["players"]) == 20
    assert len({player["id"] for player in snapshot["players"]}) == 20
    assert snapshot["version"] == 21
