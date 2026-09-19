from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest

from app.api.rooms import _room_snapshot
from app.game.engine import GameEngine
from app.game.errors import (
    InvalidGameState,
    InvalidPlayerAction,
    InvalidRoundPhase,
    PlayerNotFound,
)
from app.game.modes.dummy import DummyGameMode
from app.game.state import GameStatus, RoundPhase, ScoreTargetType
from app.rooms.models import ParticipationType, Player, Room
from app.rooms.store import InMemoryRoomStore


@pytest.fixture
def engine() -> GameEngine:
    return GameEngine()


@pytest.fixture
def mode() -> DummyGameMode:
    return DummyGameMode()


@pytest.fixture
def room() -> Room:
    return Room(
        room_code="TEST",
        host_token="host-secret",
        version=1,
        created_at=datetime.now(UTC),
        players=[
            Player(
                id="player-1",
                name="Player One",
                participation_type=ParticipationType.REMOTE,
                player_token="player-secret",
                joined_at=datetime.now(UTC),
            )
        ],
    )


def configure_and_start(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    engine.configure_game(room, mode)
    engine.start_game(room, mode)


def activate(engine: GameEngine, room: Room, mode: DummyGameMode) -> None:
    configure_and_start(engine, room, mode)
    engine.activate_round(room, mode)


def play_current_round(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
    answer: str,
) -> None:
    engine.activate_round(room, mode)
    engine.submit_action(room, mode, "player-1", "answer", answer)
    engine.reveal_round(room, mode)
    engine.show_scoreboard(room, mode)
    engine.finish_round(room, mode)


def test_new_room_starts_in_lobby(room: Room) -> None:
    assert room.game.status is GameStatus.LOBBY
    assert room.game.mode is None
    assert room.game.round_number == 0
    assert room.game.total_rounds == 0
    assert room.game.current_round is None


def test_configure_game_moves_lobby_to_ready(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    engine.configure_game(room, mode)

    assert room.game.status is GameStatus.READY
    assert room.game.mode == "dummy"
    assert room.game.total_rounds == 3
    assert room.game.round_number == 0
    assert room.game.current_round is None


def test_configure_game_outside_lobby_is_rejected_without_version_change(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    engine.configure_game(room, mode)
    version = room.version

    with pytest.raises(InvalidGameState):
        engine.configure_game(room, mode)

    assert room.version == version


def test_start_game_prepares_first_round_in_intro(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    configure_and_start(engine, room, mode)

    assert room.game.status is GameStatus.PLAYING
    assert room.game.round_number == 1
    assert room.game.current_round is not None
    assert room.game.current_round.number == 1
    assert room.game.current_round.phase is RoundPhase.INTRO


def test_start_game_from_lobby_is_rejected(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    with pytest.raises(InvalidGameState):
        engine.start_game(room, mode)


def test_activate_round_moves_intro_to_active(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    configure_and_start(engine, room, mode)

    engine.activate_round(room, mode)

    assert room.game.current_round is not None
    assert room.game.current_round.phase is RoundPhase.ACTIVE


@pytest.mark.parametrize("phase", [RoundPhase.INTRO, RoundPhase.REVEAL])
def test_action_outside_active_round_is_rejected(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
    phase: RoundPhase,
) -> None:
    configure_and_start(engine, room, mode)
    if phase is RoundPhase.REVEAL:
        engine.activate_round(room, mode)
        engine.reveal_round(room, mode)
    version = room.version

    with pytest.raises(InvalidRoundPhase):
        engine.submit_action(room, mode, "player-1", "answer", "Answer 1")

    assert room.version == version


def test_player_action_is_accepted_during_active_round(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    activate(engine, room, mode)

    action = engine.submit_action(
        room,
        mode,
        "player-1",
        "answer",
        "Answer 1",
    )

    assert room.game.current_round is not None
    assert room.game.current_round.accepted_actions == [action]


def test_unknown_player_is_rejected(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    activate(engine, room, mode)

    with pytest.raises(PlayerNotFound):
        engine.submit_action(room, mode, "missing", "answer", "Answer 1")


def test_invalid_and_duplicate_actions_follow_mode_rules(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    activate(engine, room, mode)

    with pytest.raises(InvalidPlayerAction):
        engine.submit_action(room, mode, "player-1", "buzz", None)

    engine.submit_action(room, mode, "player-1", "answer", "Answer 1")
    version = room.version
    with pytest.raises(InvalidPlayerAction):
        engine.submit_action(room, mode, "player-1", "answer", "Answer 1")

    assert room.version == version


def test_result_is_created_only_on_reveal(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    activate(engine, room, mode)
    assert room.game.current_round is not None
    assert room.game.current_round.result is None

    engine.submit_action(room, mode, "player-1", "answer", "Answer 1")
    assert room.game.current_round.result is None

    engine.reveal_round(room, mode)
    assert room.game.current_round.phase is RoundPhase.REVEAL
    assert room.game.current_round.result is not None
    assert room.game.current_round.result.answer == "Answer 1"


def test_scoreboard_applies_points_once(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    activate(engine, room, mode)
    engine.submit_action(room, mode, "player-1", "answer", "Answer 1")
    engine.reveal_round(room, mode)

    engine.show_scoreboard(room, mode)

    assert len(room.game.scores) == 1
    score = room.game.scores[0]
    assert score.target_type is ScoreTargetType.PLAYER
    assert score.target_id == "player-1"
    assert score.points == 1

    version = room.version
    with pytest.raises(InvalidRoundPhase):
        engine.show_scoreboard(room, mode)
    assert score.points == 1
    assert room.version == version


def test_finish_round_starts_next_round_in_intro(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    configure_and_start(engine, room, mode)
    play_current_round(engine, room, mode, "Answer 1")

    assert room.game.status is GameStatus.PLAYING
    assert room.game.round_number == 2
    assert room.game.current_round is not None
    assert room.game.current_round.number == 2
    assert room.game.current_round.phase is RoundPhase.INTRO


def test_three_rounds_complete_game_with_final_score(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    configure_and_start(engine, room, mode)

    for number in range(1, 4):
        play_current_round(engine, room, mode, f"Answer {number}")

    assert room.game.status is GameStatus.FINISHED
    assert room.game.round_number == 3
    assert room.game.current_round is not None
    assert room.game.current_round.phase is RoundPhase.FINISHED
    assert room.game.scores[0].points == 3

    version = room.version
    with pytest.raises(InvalidGameState):
        engine.submit_action(room, mode, "player-1", "answer", "Answer 3")
    assert room.version == version


@pytest.mark.parametrize(
    ("operation", "error"),
    [
        ("reveal", InvalidRoundPhase),
        ("scoreboard", InvalidRoundPhase),
        ("finish", InvalidRoundPhase),
    ],
)
def test_invalid_phase_transitions_are_rejected(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
    operation: str,
    error: type[Exception],
) -> None:
    configure_and_start(engine, room, mode)
    transitions = {
        "reveal": engine.reveal_round,
        "scoreboard": engine.show_scoreboard,
        "finish": engine.finish_round,
    }

    with pytest.raises(error):
        transitions[operation](room, mode)


def test_each_successful_operation_increments_version_once(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    operations = [
        lambda: engine.configure_game(room, mode),
        lambda: engine.start_game(room, mode),
        lambda: engine.activate_round(room, mode),
        lambda: engine.submit_action(
            room,
            mode,
            "player-1",
            "answer",
            "Answer 1",
        ),
        lambda: engine.reveal_round(room, mode),
        lambda: engine.show_scoreboard(room, mode),
        lambda: engine.finish_round(room, mode),
    ]

    for operation in operations:
        version = room.version
        operation()
        assert room.version == version + 1


def test_public_snapshot_hides_secrets_actions_and_unrevealed_answer(
    engine: GameEngine,
    room: Room,
    mode: DummyGameMode,
) -> None:
    activate(engine, room, mode)
    engine.submit_action(room, mode, "player-1", "answer", "Answer 1")

    before_reveal = _room_snapshot(room).model_dump_json(by_alias=True)
    before_reveal_data = _room_snapshot(room).model_dump(by_alias=True)

    assert "Answer 1" not in before_reveal
    assert "host-secret" not in before_reveal
    assert "player-secret" not in before_reveal
    assert "acceptedActions" not in before_reveal
    assert before_reveal_data["status"] == before_reveal_data["game"]["status"]

    engine.reveal_round(room, mode)
    after_reveal = _room_snapshot(room).model_dump(by_alias=True)
    assert after_reveal["game"]["currentRound"]["result"]["answer"] == "Answer 1"


def test_store_runs_mutations_under_lock_and_returns_snapshot() -> None:
    store = InMemoryRoomStore()
    engine = GameEngine()
    mode = DummyGameMode()
    created = store.create_room()
    room_code = created.room_code

    configured_mutation = store.mutate_room(
        room_code,
        lambda current: engine.configure_game(current, mode),
    )
    configured = configured_mutation.room
    assert configured.version == created.version + 1

    engine.start_game(configured, mode)

    stored = store.get_room(room_code)
    assert stored.game.status is GameStatus.READY
    assert configured.game.status is GameStatus.PLAYING


def test_concurrent_valid_and_invalid_actions_do_not_corrupt_room() -> None:
    store = InMemoryRoomStore()
    engine = GameEngine()
    mode = DummyGameMode()
    created = store.create_room()
    room_code = created.room_code
    join_mutation = store.add_or_reconnect_player(room_code, "Player")
    joined = join_mutation.room
    player, _ = join_mutation.value
    store.mutate_room(room_code, lambda room: engine.configure_game(room, mode))
    store.mutate_room(room_code, lambda room: engine.start_game(room, mode))
    active = store.mutate_room(
        room_code,
        lambda room: engine.activate_round(room, mode),
    ).room

    def submit(action_type: str) -> Exception | None:
        try:
            store.mutate_room(
                room_code,
                lambda room: engine.submit_action(
                    room,
                    mode,
                    player.id,
                    action_type,
                    "Answer 1",
                ),
            )
        except InvalidPlayerAction as error:
            return error
        return None

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, ["answer", "invalid"]))

    final_room = store.get_room(room_code)
    assert sum(result is None for result in results) == 1
    assert final_room.game.current_round is not None
    assert len(final_room.game.current_round.accepted_actions) == 1
    assert final_room.version == active.version + 1
    assert joined.version < final_room.version
