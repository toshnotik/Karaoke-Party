import secrets
from collections.abc import Callable, Container
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import RLock
from typing import Generic, TypeVar
from uuid import uuid4

from app.rooms.models import ParticipationType, Player, Room


ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOM_CODE_LENGTH = 4
MutationResult = TypeVar("MutationResult")


@dataclass(frozen=True)
class RoomMutation(Generic[MutationResult]):
    room: Room
    value: MutationResult
    changed: bool


class RoomNotFoundError(Exception):
    pass


class InvalidPlayerTokenError(Exception):
    pass


class InMemoryRoomStore:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}
        self._host_tokens: set[str] = set()
        self._players_by_token: dict[str, tuple[str, str]] = {}
        self._lock = RLock()

    def create_room(self) -> Room:
        with self._lock:
            room_code = self._generate_room_code()
            host_token = self._generate_unique_token(self._host_tokens)
            room = Room(
                room_code=room_code,
                host_token=host_token,
                version=1,
                created_at=datetime.now(UTC),
            )
            self._rooms[room_code] = room
            self._host_tokens.add(host_token)
            return deepcopy(room)

    def mutate_room(
        self,
        room_code: str,
        mutation: Callable[[Room], MutationResult],
    ) -> RoomMutation[MutationResult]:
        with self._lock:
            room = self._rooms.get(room_code.upper())
            if room is None:
                raise RoomNotFoundError
            previous_version = room.version
            result = mutation(room)
            return RoomMutation(
                room=deepcopy(room),
                value=deepcopy(result),
                changed=room.version != previous_version,
            )

    def get_room(self, room_code: str) -> Room:
        with self._lock:
            room = self._rooms.get(room_code.upper())
            if room is None:
                raise RoomNotFoundError
            return deepcopy(room)

    def add_or_reconnect_player(
        self,
        room_code: str,
        name: str,
        player_token: str | None = None,
    ) -> RoomMutation[tuple[Player, bool]]:
        with self._lock:
            normalized_code = room_code.upper()
            room = self._rooms.get(normalized_code)
            if room is None:
                raise RoomNotFoundError
            previous_version = room.version

            if player_token is not None:
                player_location = self._players_by_token.get(player_token)
                if player_location is None or player_location[0] != normalized_code:
                    raise InvalidPlayerTokenError

                player = self._find_player(room, player_location[1])
                if player.name != name:
                    player.name = name
                    room.mark_public_state_changed()
                return RoomMutation(
                    room=deepcopy(room),
                    value=(deepcopy(player), False),
                    changed=room.version != previous_version,
                )

            new_token = self._generate_unique_token(self._players_by_token)
            player = Player(
                id=str(uuid4()),
                name=name,
                participation_type=ParticipationType.REMOTE,
                player_token=new_token,
                joined_at=datetime.now(UTC),
            )
            room.players.append(player)
            self._players_by_token[new_token] = (normalized_code, player.id)
            room.mark_public_state_changed()
            return RoomMutation(
                room=deepcopy(room),
                value=(deepcopy(player), True),
                changed=True,
            )

    def clear(self) -> None:
        with self._lock:
            self._rooms.clear()
            self._host_tokens.clear()
            self._players_by_token.clear()

    def _generate_room_code(self) -> str:
        while True:
            room_code = "".join(
                secrets.choice(ROOM_CODE_ALPHABET) for _ in range(ROOM_CODE_LENGTH)
            )
            if room_code not in self._rooms:
                return room_code

    @staticmethod
    def _generate_unique_token(existing_tokens: Container[str]) -> str:
        while True:
            token = secrets.token_urlsafe(32)
            if token not in existing_tokens:
                return token

    @staticmethod
    def _find_player(room: Room, player_id: str) -> Player:
        return next(player for player in room.players if player.id == player_id)


room_store = InMemoryRoomStore()
