from concurrent.futures import ThreadPoolExecutor
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.api import game as game_api
from app.main import app
from app.realtime.manager import connection_manager
from app.rooms.store import room_store
from app.songs import Song


TEST_SONGS = (
    Song("song-1", "Hidden Title", "Hidden Artist", 2001, "secret/path.mp3", 10, 8),
    Song("song-2", "Next Title", "Next Artist", None, "next.mp3", 20, 9),
)


@pytest.fixture(autouse=True)
def runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    room_store.clear()
    connection_manager.clear()
    game_api.modes.pop("guess_song", None)
    monkeypatch.setattr(game_api, "load_songs", lambda _: TEST_SONGS)


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def bearer(token: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_room(client: TestClient) -> dict[str, object]:
    return client.post("/api/rooms").json()


def join(client: TestClient, room: dict[str, object], name: str) -> dict[str, object]:
    response = client.post(f"/api/rooms/{room['roomCode']}/join", json={"name": name})
    assert response.status_code == 201
    return response.json()


def host_command(
    client: TestClient,
    room: dict[str, object],
    path: str,
    payload: dict[str, object] | None = None,
    token: object | None = None,
):
    return client.post(
        f"/api/rooms/{room['roomCode']}/game/{path}",
        headers=bearer(token if token is not None else room["hostToken"]),
        json=payload,
    )


def buzz(client: TestClient, room: dict[str, object], player: dict[str, object]):
    return client.post(
        f"/api/rooms/{room['roomCode']}/game/actions",
        headers=bearer(player["playerToken"]),
        json={"actionType": "buzz"},
    )


def prepare_active_round(client: TestClient):
    room = create_room(client)
    first = join(client, room, "First")
    second = join(client, room, "Second")
    assert host_command(client, room, "configure", {"mode": "guess_song"}).status_code == 200
    assert host_command(client, room, "start").status_code == 200
    assert host_command(client, room, "round/activate").status_code == 200
    return room, first, second


def snapshot(client: TestClient, room: dict[str, object]) -> dict[str, object]:
    return client.get(f"/api/rooms/{room['roomCode']}").json()


def test_configure_and_start_use_manifest_order_and_hide_song(client: TestClient) -> None:
    room = create_room(client)
    configured = host_command(client, room, "configure", {"mode": "guess_song"})
    assert configured.status_code == 200
    assert host_command(client, room, "start").status_code == 200

    public = snapshot(client, room)
    serialized = str(public)
    assert public["game"]["mode"] == "guess_song"
    assert public["game"]["totalRounds"] == 2
    assert public["game"]["currentRound"]["number"] == 1
    assert "Hidden Title" not in serialized
    assert "Hidden Artist" not in serialized
    assert "2001" not in serialized
    assert "secret/path.mp3" not in serialized


def test_configure_rejects_empty_songs(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    room = create_room(client)
    monkeypatch.setattr(game_api, "load_songs", lambda _: ())

    response = host_command(client, room, "configure", {"mode": "guess_song"})

    assert response.status_code == 400
    assert "at least one song" in response.json()["detail"]
    assert snapshot(client, room)["version"] == 1


def test_buzz_judging_reveal_and_scoring_lifecycle(client: TestClient) -> None:
    room, first, second = prepare_active_round(client)
    active_version = snapshot(client, room)["version"]

    accepted = buzz(client, room, first)
    assert accepted.status_code == 200
    after_first = snapshot(client, room)
    assert accepted.json()["version"] == active_version + 1
    assert after_first["game"]["currentRound"]["modeState"] == {
        "currentResponderId": first["player"]["id"],
        "excludedPlayerIds": [],
    }

    rejected = buzz(client, room, second)
    assert rejected.status_code == 409
    assert snapshot(client, room)["version"] == accepted.json()["version"]

    wrong = host_command(client, room, "round/judge", {"correct": False})
    assert wrong.status_code == 200
    after_wrong = snapshot(client, room)
    round_state = after_wrong["game"]["currentRound"]
    assert round_state["phase"] == "active"
    assert round_state["modeState"]["currentResponderId"] is None
    assert round_state["modeState"]["excludedPlayerIds"] == [first["player"]["id"]]
    assert round_state["result"] is None
    assert after_wrong["game"]["scores"] == []

    repeat = buzz(client, room, first)
    assert repeat.status_code == 409
    assert snapshot(client, room)["version"] == wrong.json()["version"]

    assert buzz(client, room, second).status_code == 200
    correct = host_command(client, room, "round/judge", {"correct": True})
    assert correct.status_code == 200
    revealed = snapshot(client, room)
    result = revealed["game"]["currentRound"]["result"]
    assert revealed["game"]["currentRound"]["phase"] == "reveal"
    assert result["song"] == {
        "title": "Hidden Title",
        "artist": "Hidden Artist",
        "year": 2001,
    }
    assert result["winnerPlayerId"] == second["player"]["id"]
    assert "secret/path.mp3" not in str(revealed)

    assert host_command(client, room, "round/scoreboard").status_code == 200
    scored = snapshot(client, room)
    assert scored["game"]["scores"] == [{
        "targetType": "player",
        "targetId": second["player"]["id"],
        "points": 100,
    }]
    duplicate = host_command(client, room, "round/scoreboard")
    assert duplicate.status_code == 409
    assert snapshot(client, room)["game"]["scores"][0]["points"] == 100

    assert host_command(client, room, "round/finish").status_code == 200
    next_round = snapshot(client, room)
    assert next_round["game"]["roundNumber"] == 2
    assert next_round["game"]["currentRound"]["phase"] == "intro"


def test_no_winner_manual_reveal_scores_nobody_and_finishes(client: TestClient) -> None:
    room, first, second = prepare_active_round(client)
    for player in (first, second):
        assert buzz(client, room, player).status_code == 200
        assert host_command(client, room, "round/judge", {"correct": False}).status_code == 200

    no_winner = snapshot(client, room)
    assert no_winner["game"]["currentRound"]["modeState"]["currentResponderId"] is None
    assert host_command(client, room, "round/reveal").status_code == 200
    revealed = snapshot(client, room)
    assert revealed["game"]["currentRound"]["result"]["winnerPlayerId"] is None
    assert host_command(client, room, "round/scoreboard").status_code == 200
    assert snapshot(client, room)["game"]["scores"] == []
    assert host_command(client, room, "round/finish").status_code == 200

    assert host_command(client, room, "round/activate").status_code == 200
    assert host_command(client, room, "round/reveal").status_code == 200
    assert host_command(client, room, "round/scoreboard").status_code == 200
    assert host_command(client, room, "round/finish").status_code == 200
    finished = snapshot(client, room)
    assert finished["status"] == "finished"
    assert finished["game"]["currentRound"]["phase"] == "finished"


def test_judging_auth_and_pending_validation(client: TestClient) -> None:
    room, first, _ = prepare_active_round(client)
    other_room = create_room(client)

    no_responder = host_command(client, room, "round/judge", {"correct": True})
    assert no_responder.status_code == 409
    for token in ("invalid", first["playerToken"], other_room["hostToken"]):
        assert host_command(
            client, room, "round/judge", {"correct": True}, token=token
        ).status_code == 401

    assert buzz(client, room, first).status_code == 200
    version = snapshot(client, room)["version"]
    pending_reveal = host_command(client, room, "round/reveal")
    assert pending_reveal.status_code == 409
    assert snapshot(client, room)["version"] == version
    assert host_command(client, room, "round/judge", {"correct": False}).status_code == 200
    assert host_command(client, room, "round/reveal").status_code == 200


def test_rejected_buzz_does_not_broadcast(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    room, first, second = prepare_active_round(client)
    assert buzz(client, room, first).status_code == 200
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_room_updated", broadcast)
    version = snapshot(client, room)["version"]

    response = buzz(client, room, second)

    assert response.status_code == 409
    assert snapshot(client, room)["version"] == version
    broadcast.assert_not_awaited()


def test_concurrent_buzz_accepts_exactly_one_and_broadcasts_once(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room, first, second = prepare_active_round(client)
    room_code = str(room["roomCode"])
    version = snapshot(client, room)["version"]
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, "broadcast_room_updated", broadcast)

    def submit(player: dict[str, object]):
        with TestClient(app) as thread_client:
            return buzz(thread_client, room, player)

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, (first, second)))

    assert sorted(response.status_code for response in responses) == [200, 409]
    final = snapshot(client, room)
    accepted_index = next(i for i, response in enumerate(responses) if response.status_code == 200)
    accepted_player = (first, second)[accepted_index]
    assert final["version"] == version + 1
    assert final["game"]["currentRound"]["modeState"]["currentResponderId"] == accepted_player["player"]["id"]
    broadcast.assert_awaited_once_with(room_code, version + 1)
