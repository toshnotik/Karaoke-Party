from uuid import uuid4

from app.game.errors import InvalidPlayerAction
from app.game.state import (
    PlayerAction,
    RoundPhase,
    RoundResult,
    RoundState,
    Score,
    ScoreTargetType,
)


class DummyGameMode:
    _questions = (
        ("Question 1", "Answer 1"),
        ("Question 2", "Answer 2"),
        ("Question 3", "Answer 3"),
    )

    @property
    def identifier(self) -> str:
        return "dummy"

    @property
    def total_rounds(self) -> int:
        return len(self._questions)

    def create_round(self, number: int) -> RoundState:
        prompt, _ = self._questions[number - 1]
        return RoundState(
            id=str(uuid4()),
            number=number,
            phase=RoundPhase.INTRO,
            prompt=prompt,
        )

    def validate_action(self, round_state: RoundState, action: PlayerAction) -> None:
        if action.action_type != "answer" or not isinstance(action.value, str):
            raise InvalidPlayerAction("Dummy mode accepts text answers only")
        if any(
            accepted.player_id == action.player_id
            and accepted.action_type == action.action_type
            for accepted in round_state.accepted_actions
        ):
            raise InvalidPlayerAction("Player already answered this round")

    def resolve_round(self, round_state: RoundState) -> RoundResult:
        _, expected_answer = self._questions[round_state.number - 1]
        correct_player_ids = tuple(
            action.player_id
            for action in round_state.accepted_actions
            if action.value.casefold() == expected_answer.casefold()
        )
        return RoundResult(
            answer=expected_answer,
            correct_player_ids=correct_player_ids,
        )

    def score_round(self, result: RoundResult) -> list[Score]:
        return [
            Score(
                target_type=ScoreTargetType.PLAYER,
                target_id=player_id,
                points=1,
            )
            for player_id in result.correct_player_ids
        ]
