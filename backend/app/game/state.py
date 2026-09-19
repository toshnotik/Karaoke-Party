from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import TypeAlias


ActionValue: TypeAlias = str | int | bool | None


class GameStatus(StrEnum):
    LOBBY = "lobby"
    READY = "ready"
    PLAYING = "playing"
    FINISHED = "finished"


class RoundPhase(StrEnum):
    INTRO = "intro"
    ACTIVE = "active"
    REVEAL = "reveal"
    SCOREBOARD = "scoreboard"
    FINISHED = "finished"


class ScoreTargetType(StrEnum):
    PLAYER = "player"
    TEAM = "team"


@dataclass(frozen=True)
class PlayerAction:
    player_id: str
    action_type: str
    value: ActionValue
    submitted_at: datetime


@dataclass(frozen=True)
class RoundResult:
    answer: str
    correct_player_ids: tuple[str, ...]


@dataclass
class RoundState:
    id: str
    number: int
    phase: RoundPhase
    prompt: str
    accepted_actions: list[PlayerAction] = field(default_factory=list)
    result: RoundResult | None = None


@dataclass
class Score:
    target_type: ScoreTargetType
    target_id: str
    points: int = 0


@dataclass
class GameState:
    status: GameStatus = GameStatus.LOBBY
    mode: str | None = None
    round_number: int = 0
    total_rounds: int = 0
    current_round: RoundState | None = None
    scores: list[Score] = field(default_factory=list)
