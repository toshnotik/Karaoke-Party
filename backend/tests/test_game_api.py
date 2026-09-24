from concurrent.futures import ThreadPoolExecutor
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


def create_room(client: TestClient) -> dict[str, object]:
    response = client.post('/api/rooms')
    assert response.status_code == 201
    return response.json()


def join_room(client: TestClient, room_code: str, name: str) -> dict[str, object]:
    response = client.post(f'/api/rooms/{room_code}/join', json={'name': name})
    assert response.status_code == 201
    return response.json()


def bearer(token: object) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def command(
    client: TestClient,
    room: dict[str, object],
    path: str,
    json: dict[str, object] | None = None,
):
    return client.post(
        f"/api/rooms/{room['roomCode']}/game/{path}",
        headers=bearer(room['hostToken']),
        json=json,
    )


@pytest.mark.parametrize(
    'headers',
    [{}, {'Authorization': 'token'}, {'Authorization': 'Basic secret'}, {'Authorization': 'Bearer'}],
)
def test_host_command_requires_well_formed_bearer_token(
    client: TestClient,
    headers: dict[str, str],
) -> None:
    room = create_room(client)

    response = client.post(
        f"/api/rooms/{room['roomCode']}/game/configure",
        headers=headers,
        json={'mode': 'dummy'},
    )

    assert response.status_code == 401


def test_host_auth_rejects_invalid_cross_room_and_player_tokens(client: TestClient) -> None:
    first = create_room(client)
    second = create_room(client)
    player = join_room(client, str(first['roomCode']), 'Player')
    path = f"/api/rooms/{first['roomCode']}/game/configure"

    for token in ('invalid', second['hostToken'], player['playerToken']):
        response = client.post(path, headers=bearer(token), json={'mode': 'dummy'})
        assert response.status_code == 401

    snapshot = client.get(f"/api/rooms/{first['roomCode']}").json()
    assert snapshot['status'] == 'lobby'
    assert snapshot['version'] == 2


def test_missing_room_is_404_before_host_auth(client: TestClient) -> None:
    response = client.post('/api/rooms/ZZZZ/game/start')

    assert response.status_code == 404


def test_configure_dummy_is_authenticated_versioned_and_broadcast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room = create_room(client)
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, 'broadcast_room_updated', broadcast)

    response = command(client, room, 'configure', {'mode': 'dummy'})

    assert response.status_code == 200
    assert response.json() == {'roomCode': room['roomCode'], 'version': 2}
    snapshot = client.get(f"/api/rooms/{room['roomCode']}").json()
    assert snapshot['status'] == 'ready'
    assert snapshot['game']['mode'] == 'dummy'
    broadcast.assert_awaited_once_with(room['roomCode'], 2)


def test_unknown_mode_is_rejected_without_change_or_broadcast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room = create_room(client)
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, 'broadcast_room_updated', broadcast)

    response = command(client, room, 'configure', {'mode': 'unknown'})

    assert response.status_code == 400
    assert client.get(f"/api/rooms/{room['roomCode']}").json()['version'] == 1
    broadcast.assert_not_awaited()


def test_malformed_configure_does_not_change_or_broadcast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room = create_room(client)
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, 'broadcast_room_updated', broadcast)

    response = command(client, room, 'configure', {})

    assert response.status_code == 422
    assert client.get(f"/api/rooms/{room['roomCode']}").json()['version'] == 1
    broadcast.assert_not_awaited()


def test_host_lifecycle_updates_public_snapshot_once_per_command(client: TestClient) -> None:
    room = create_room(client)
    expected_versions = []

    for path, payload in (
        ('configure', {'mode': 'dummy'}),
        ('start', None),
        ('round/activate', None),
        ('round/reveal', None),
        ('round/scoreboard', None),
        ('round/finish', None),
    ):
        response = command(client, room, path, payload)
        assert response.status_code == 200
        expected_versions.append(response.json()['version'])

    assert expected_versions == [2, 3, 4, 5, 6, 7]
    snapshot = client.get(f"/api/rooms/{room['roomCode']}").json()
    assert snapshot['status'] == 'playing'
    assert snapshot['game']['roundNumber'] == 2
    assert snapshot['game']['currentRound']['phase'] == 'intro'

    for _ in range(2):
        for path in ('round/activate', 'round/reveal', 'round/scoreboard', 'round/finish'):
            assert command(client, room, path).status_code == 200

    finished = client.get(f"/api/rooms/{room['roomCode']}").json()
    assert finished['status'] == 'finished'
    assert finished['game']['roundNumber'] == 3
    assert finished['game']['currentRound']['phase'] == 'finished'


def test_invalid_transition_is_conflict_without_change_or_broadcast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room = create_room(client)
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, 'broadcast_room_updated', broadcast)

    response = command(client, room, 'start')

    assert response.status_code == 409
    assert client.get(f"/api/rooms/{room['roomCode']}").json()['version'] == 1
    broadcast.assert_not_awaited()


def test_player_action_uses_authenticated_player_and_rejects_spoofing(
    client: TestClient,
) -> None:
    room = create_room(client)
    first = join_room(client, str(room['roomCode']), 'First')
    second = join_room(client, str(room['roomCode']), 'Second')
    command(client, room, 'configure', {'mode': 'dummy'})
    command(client, room, 'start')
    command(client, room, 'round/activate')

    response = client.post(
        f"/api/rooms/{room['roomCode']}/game/actions",
        headers=bearer(first['playerToken']),
        json={'actionType': 'answer', 'value': 'Answer 1', 'playerId': second['player']['id']},
    )

    assert response.status_code == 422
    accepted = client.post(
        f"/api/rooms/{room['roomCode']}/game/actions",
        headers=bearer(first['playerToken']),
        json={'actionType': 'answer', 'value': 'Answer 1'},
    )
    assert accepted.status_code == 200
    assert accepted.json()['version'] == 7
    assert command(client, room, 'round/reveal').status_code == 200
    snapshot = client.get(f"/api/rooms/{room['roomCode']}").json()
    assert snapshot['game']['currentRound']['result']['correctPlayerIds'] == [
        first['player']['id']
    ]


def test_player_action_auth_and_state_failures_do_not_broadcast(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room = create_room(client)
    other = create_room(client)
    player = join_room(client, str(room['roomCode']), 'Player')
    other_player = join_room(client, str(other['roomCode']), 'Other')
    broadcast = AsyncMock()
    monkeypatch.setattr(connection_manager, 'broadcast_room_updated', broadcast)
    path = f"/api/rooms/{room['roomCode']}/game/actions"
    payload = {'actionType': 'answer', 'value': 'Answer 1'}

    for headers in ({}, bearer('invalid'), bearer(other_player['playerToken']), bearer(room['hostToken'])):
        response = client.post(path, headers=headers, json=payload)
        assert response.status_code == 401

    response = client.post(path, headers=bearer(player['playerToken']), json=payload)
    assert response.status_code == 409
    assert client.get(f"/api/rooms/{room['roomCode']}").json()['version'] == 2
    broadcast.assert_not_awaited()


def test_concurrent_player_actions_are_serialized(client: TestClient) -> None:
    room = create_room(client)
    room_code = str(room['roomCode'])
    players = [join_room(client, room_code, name) for name in ('One', 'Two')]
    command(client, room, 'configure', {'mode': 'dummy'})
    command(client, room, 'start')
    active = command(client, room, 'round/activate').json()

    def submit(player: dict[str, object]):
        with TestClient(app) as thread_client:
            return thread_client.post(
                f'/api/rooms/{room_code}/game/actions',
                headers=bearer(player['playerToken']),
                json={'actionType': 'answer', 'value': 'Answer 1'},
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, players))

    assert all(response.status_code == 200 for response in responses)
    versions = sorted(response.json()['version'] for response in responses)
    assert versions == [active['version'] + 1, active['version'] + 2]


def test_websocket_receives_monotonic_events_for_full_lifecycle(client: TestClient) -> None:
    room = create_room(client)
    room_code = str(room['roomCode'])
    player = join_room(client, room_code, 'Player')

    with client.websocket_connect(f'/ws/rooms/{room_code}') as websocket:
        websocket.receive_json()
        operations = [
            lambda: command(client, room, 'configure', {'mode': 'dummy'}),
            lambda: command(client, room, 'start'),
            lambda: command(client, room, 'round/activate'),
            lambda: client.post(
                f'/api/rooms/{room_code}/game/actions',
                headers=bearer(player['playerToken']),
                json={'actionType': 'answer', 'value': 'Answer 1'},
            ),
            lambda: command(client, room, 'round/reveal'),
            lambda: command(client, room, 'round/scoreboard'),
            lambda: command(client, room, 'round/finish'),
        ]
        versions = []
        for operation in operations:
            response = operation()
            assert response.status_code == 200
            event = websocket.receive_json()
            assert event['type'] == 'room.updated'
            versions.append(event['version'])

    assert versions == list(range(3, 10))
