from typing import Annotated

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from pydantic.alias_generators import to_camel

from app.rooms.models import ParticipationType, Player, Room, RoomStatus
from app.rooms.store import (
    InvalidPlayerTokenError,
    RoomNotFoundError,
    room_store,
)


PlayerName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=40),
]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PublicPlayer(ApiModel):
    id: str
    name: str
    participation_type: ParticipationType


class RoomSnapshot(ApiModel):
    room_code: str
    status: RoomStatus
    version: int
    players: list[PublicPlayer]


class CreateRoomResponse(ApiModel):
    room_code: str
    host_token: str
    status: RoomStatus
    version: int


class JoinRoomRequest(ApiModel):
    name: PlayerName
    player_token: str | None = None


class JoinRoomResponse(ApiModel):
    player: PublicPlayer
    player_token: str
    room: RoomSnapshot


router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse, status_code=status.HTTP_201_CREATED)
def create_room() -> CreateRoomResponse:
    room = room_store.create_room()
    return CreateRoomResponse(
        room_code=room.room_code,
        host_token=room.host_token,
        status=room.status,
        version=room.version,
    )


@router.get("/{room_code}", response_model=RoomSnapshot)
def get_room(room_code: str) -> RoomSnapshot:
    try:
        return _room_snapshot(room_store.get_room(room_code))
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail="Room not found") from error


@router.post(
    "/{room_code}/join",
    response_model=JoinRoomResponse,
    status_code=status.HTTP_201_CREATED,
)
def join_room(
    room_code: str,
    request: JoinRoomRequest,
    response: Response,
) -> JoinRoomResponse:
    try:
        room, player, created = room_store.add_or_reconnect_player(
            room_code=room_code,
            name=request.name,
            player_token=request.player_token,
        )
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail="Room not found") from error
    except InvalidPlayerTokenError as error:
        raise HTTPException(status_code=401, detail="Invalid player token") from error

    if not created:
        response.status_code = status.HTTP_200_OK

    return JoinRoomResponse(
        player=_public_player(player),
        player_token=player.player_token,
        room=_room_snapshot(room),
    )


def _room_snapshot(room: Room) -> RoomSnapshot:
    return RoomSnapshot(
        room_code=room.room_code,
        status=room.status,
        version=room.version,
        players=[_public_player(player) for player in room.players],
    )


def _public_player(player: Player) -> PublicPlayer:
    return PublicPlayer(
        id=player.id,
        name=player.name,
        participation_type=player.participation_type,
    )
