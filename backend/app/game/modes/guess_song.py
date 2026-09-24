from dataclasses import dataclass, field
from uuid import uuid4

from app.game.errors import InvalidGameConfiguration, InvalidPlayerAction, InvalidRoundPhase
from app.game.state import (
    PlayerAction,
    RoundPhase,
    RoundResult,
    RoundState,
    Score,
    ScoreTargetType,
)
from app.songs import Song


@dataclass
class GuessSongRoundState:
    song: Song
    current_responder_id: str | None = None
    excluded_player_ids: list[str] = field(default_factory=list)
    winner_player_id: str | None = None
    judged: bool = False


class GuessSongMode:
    def __init__(self, songs: tuple[Song, ...]) -> None:
        if not songs:
            raise InvalidGameConfiguration("Guess Song requires at least one song")
        self._songs = songs

    @property
    def identifier(self) -> str:
        return "guess_song"

    @property
    def total_rounds(self) -> int:
        return len(self._songs)

    def create_round(self, number: int) -> RoundState:
        song = self._songs[number - 1]
        return RoundState(
            id=str(uuid4()),
            number=number,
            phase=RoundPhase.INTRO,
            prompt="Guess the song",
            mode_state=GuessSongRoundState(song=song),
        )

    def accept_action(self, round_state: RoundState, action: PlayerAction) -> None:
        state = self._state(round_state)
        if action.action_type != "buzz" or action.value is not None:
            raise InvalidPlayerAction("Guess Song accepts buzz actions only")
        if state.current_responder_id is not None:
            raise InvalidPlayerAction("Another player is awaiting judgement")
        if action.player_id in state.excluded_player_ids:
            raise InvalidPlayerAction("Player cannot buzz again this round")
        if state.judged:
            raise InvalidPlayerAction("This round has already been judged")
        state.current_responder_id = action.player_id
        round_state.accepted_actions.append(action)

    def judge_round(self, round_state: RoundState, correct: bool) -> bool:
        state = self._state(round_state)
        responder_id = state.current_responder_id
        if responder_id is None:
            raise InvalidRoundPhase("No player is awaiting judgement")
        if state.judged:
            raise InvalidRoundPhase("This round has already been judged")

        state.current_responder_id = None
        if correct:
            state.winner_player_id = responder_id
            state.judged = True
            return True

        state.excluded_player_ids.append(responder_id)
        return False

    def resolve_round(self, round_state: RoundState) -> RoundResult:
        state = self._state(round_state)
        if state.current_responder_id is not None:
            raise InvalidRoundPhase("Pending response must be judged before reveal")
        state.judged = True
        return RoundResult(
            answer=state.song.title,
            correct_player_ids=(state.winner_player_id,) if state.winner_player_id else (),
        )

    def score_round(self, result: RoundResult) -> list[Score]:
        return [
            Score(
                target_type=ScoreTargetType.PLAYER,
                target_id=player_id,
                points=100,
            )
            for player_id in result.correct_player_ids
        ]

    @staticmethod
    def _state(round_state: RoundState) -> GuessSongRoundState:
        if not isinstance(round_state.mode_state, GuessSongRoundState):
            raise InvalidGameConfiguration("Guess Song round state is missing")
        return round_state.mode_state
