from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class RoomStatus(StrEnum):
    LOBBY = "lobby"


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
    status: RoomStatus
    version: int
    created_at: datetime
    players: list[Player] = field(default_factory=list)

    def mark_public_state_changed(self) -> None:
        self.version += 1
