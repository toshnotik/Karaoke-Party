from datetime import UTC, datetime

from app.game.errors import (
    InvalidGameState,
    InvalidRoundPhase,
    PlayerNotFound,
)
from app.game.modes.base import GameMode
from app.game.state import (
    ActionValue,
    GameStatus,
    PlayerAction,
    RoundPhase,
    RoundState,
    Score,
)
from app.rooms.models import Room


class GameEngine:
    def configure_game(self, room: Room, mode: GameMode) -> None:
        if room.game.status is not GameStatus.LOBBY:
            raise InvalidGameState("Game can only be configured from the lobby")

        mode_identifier = mode.identifier
        total_rounds = mode.total_rounds
        room.game.status = GameStatus.READY
        room.game.mode = mode_identifier
        room.game.total_rounds = total_rounds
        room.mark_public_state_changed()

    def start_game(self, room: Room, mode: GameMode) -> None:
        if room.game.status is not GameStatus.READY:
            raise InvalidGameState("Game can only start when ready")
        self._require_configured_mode(room, mode)

        first_round = mode.create_round(1)
        room.game.status = GameStatus.PLAYING
        room.game.round_number = 1
        room.game.current_round = first_round
        room.mark_public_state_changed()

    def activate_round(self, room: Room, mode: GameMode) -> None:
        round_state = self._require_round(room, mode, RoundPhase.INTRO)
        round_state.phase = RoundPhase.ACTIVE
        room.mark_public_state_changed()

    def submit_action(
        self,
        room: Room,
        mode: GameMode,
        player_id: str,
        action_type: str,
        value: ActionValue,
        submitted_at: datetime | None = None,
    ) -> PlayerAction:
        round_state = self._require_round(room, mode, RoundPhase.ACTIVE)
        if not any(player.id == player_id for player in room.players):
            raise PlayerNotFound(player_id)

        action = PlayerAction(
            player_id=player_id,
            action_type=action_type,
            value=value,
            submitted_at=submitted_at or datetime.now(UTC),
        )
        mode.validate_action(round_state, action)
        round_state.accepted_actions.append(action)
        room.mark_public_state_changed()
        return action

    def reveal_round(self, room: Room, mode: GameMode) -> None:
        round_state = self._require_round(room, mode, RoundPhase.ACTIVE)
        round_state.result = mode.resolve_round(round_state)
        round_state.phase = RoundPhase.REVEAL
        room.mark_public_state_changed()

    def show_scoreboard(self, room: Room, mode: GameMode) -> None:
        round_state = self._require_round(room, mode, RoundPhase.REVEAL)
        if round_state.result is None:
            raise InvalidRoundPhase("Round result is not available")

        self._apply_score_changes(room.game.scores, mode.score_round(round_state.result))
        round_state.phase = RoundPhase.SCOREBOARD
        room.mark_public_state_changed()

    def finish_round(self, room: Room, mode: GameMode) -> None:
        round_state = self._require_round(room, mode, RoundPhase.SCOREBOARD)
        if room.game.round_number == room.game.total_rounds:
            round_state.phase = RoundPhase.FINISHED
            room.game.status = GameStatus.FINISHED
        else:
            next_round_number = room.game.round_number + 1
            next_round = mode.create_round(next_round_number)
            round_state.phase = RoundPhase.FINISHED
            room.game.round_number = next_round_number
            room.game.current_round = next_round
        room.mark_public_state_changed()

    @staticmethod
    def _apply_score_changes(scores: list[Score], changes: list[Score]) -> None:
        for change in changes:
            score = next(
                (
                    existing
                    for existing in scores
                    if existing.target_type is change.target_type
                    and existing.target_id == change.target_id
                ),
                None,
            )
            if score is None:
                scores.append(change)
            else:
                score.points += change.points

    @staticmethod
    def _require_configured_mode(room: Room, mode: GameMode) -> None:
        if room.game.mode != mode.identifier:
            raise InvalidGameState("Configured game mode does not match")

    def _require_round(
        self,
        room: Room,
        mode: GameMode,
        phase: RoundPhase,
    ) -> RoundState:
        if room.game.status is not GameStatus.PLAYING:
            raise InvalidGameState("Game is not playing")
        self._require_configured_mode(room, mode)
        round_state = room.game.current_round
        if round_state is None or round_state.phase is not phase:
            raise InvalidRoundPhase(f"Round must be in {phase.value} phase")
        return round_state
