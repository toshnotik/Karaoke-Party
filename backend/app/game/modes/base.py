from typing import Protocol

from app.game.state import PlayerAction, RoundResult, RoundState, Score


class GameMode(Protocol):
    @property
    def identifier(self) -> str: ...

    @property
    def total_rounds(self) -> int: ...

    def create_round(self, number: int) -> RoundState: ...

    def validate_action(
        self,
        round_state: RoundState,
        action: PlayerAction,
    ) -> None: ...

    def resolve_round(self, round_state: RoundState) -> RoundResult: ...

    def score_round(self, result: RoundResult) -> list[Score]: ...
