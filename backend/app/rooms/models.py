from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum

from app.game.state import GameState


class ParticipationType(StrEnum):
    REMOTE = "remote"


@dataclass
class Player:
    id: str
    name: str
    participation_type: ParticipationType
    player_token: str
    joined_at: datetime


@dataclass
class Room:
    room_code: str
    host_token: str
    version: int
    created_at: datetime
    players: list[Player] = field(default_factory=list)
    game: GameState = field(default_factory=GameState)

    def mark_public_state_changed(self) -> None:
        self.version += 1
