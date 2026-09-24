from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.api.auth import require_host
from app.game.errors import InvalidGameState
from app.game.modes.guess_song import GuessSongRoundState
from app.game.state import GameStatus, RoundPhase
from app.realtime.manager import connection_manager
from app.rooms.models import Room
from app.rooms.store import RoomNotFoundError, room_store


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class ScreenCommandRequest(ApiModel):
    command: Literal["continue_audio"]


class ScreenCommandResponse(ApiModel):
    command: Literal["continue_audio"]


router = APIRouter(prefix="/rooms/{room_code}/screen/commands", tags=["screen"])


def _validate_continue_audio(room: Room) -> None:
    round_state = room.game.current_round
    if (
        room.game.status is not GameStatus.PLAYING
        or room.game.mode != "guess_song"
        or round_state is None
        or round_state.phase is not RoundPhase.ACTIVE
        or not isinstance(round_state.mode_state, GuessSongRoundState)
    ):
        raise InvalidGameState("Audio can only continue during an active Guess Song round")
    if round_state.mode_state.current_responder_id is not None:
        raise InvalidGameState("Judge the current responder before continuing audio")


@router.post("", response_model=ScreenCommandResponse, status_code=status.HTTP_202_ACCEPTED)
async def send_screen_command(
    room_code: str,
    request: ScreenCommandRequest,
    _: Annotated[None, Depends(require_host)],
) -> ScreenCommandResponse:
    try:
        room_store.mutate_room(room_code, _validate_continue_audio)
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail="Room not found") from error
    except InvalidGameState as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    await connection_manager.broadcast_screen_command(room_code, request.command)
    return ScreenCommandResponse(command=request.command)
