from collections.abc import Callable
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.api.auth import require_host, require_player
from app.game.engine import GameEngine
from app.game.errors import (
    InvalidGameConfiguration,
    InvalidGameState,
    InvalidPlayerAction,
    InvalidRoundPhase,
    PlayerNotFound,
)
from app.game.modes.base import GameMode
from app.game.modes.dummy import DummyGameMode
from app.game.modes.guess_song import GuessSongMode
from app.game.state import ActionValue
from app.realtime.manager import connection_manager
from app.rooms.models import Player, Room
from app.rooms.store import RoomNotFoundError, room_store
from app.settings import settings
from app.songs import load_songs


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra='forbid',
    )


class ConfigureGameRequest(ApiModel):
    mode: str


class PlayerActionRequest(ApiModel):
    action_type: str
    value: ActionValue = None


class JudgeRoundRequest(ApiModel):
    correct: bool


class CommandResponse(ApiModel):
    room_code: str
    version: int


engine = GameEngine()
modes: dict[str, GameMode] = {'dummy': DummyGameMode()}
router = APIRouter(prefix='/rooms/{room_code}/game', tags=['game'])


def _configured_mode(room: Room) -> GameMode:
    if room.game.mode_instance is None:
        raise InvalidGameState('Game mode is not configured')
    return cast(GameMode, room.game.mode_instance)


def _mode_for_configuration(identifier: str) -> GameMode | None:
    if identifier == 'guess_song':
        return GuessSongMode(load_songs(settings.song_manifest_path))
    return modes.get(identifier)


async def _mutate(
    room_code: str,
    command: Callable[[Room], object],
) -> CommandResponse:
    try:
        mutation = room_store.mutate_room(room_code, command)
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail='Room not found') from error
    except PlayerNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (InvalidGameState, InvalidRoundPhase, InvalidPlayerAction) as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except InvalidGameConfiguration as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    room = mutation.room
    if mutation.changed:
        await connection_manager.broadcast_room_updated(room.room_code, room.version)
    return CommandResponse(room_code=room.room_code, version=room.version)


@router.post('/configure', response_model=CommandResponse)
async def configure_game(
    room_code: str,
    request: ConfigureGameRequest,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    try:
        mode = _mode_for_configuration(request.mode)
    except InvalidGameConfiguration as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if mode is None:
        raise HTTPException(status_code=400, detail='Unknown game mode')
    return await _mutate(room_code, lambda room: engine.configure_game(room, mode))


@router.post('/start', response_model=CommandResponse)
async def start_game(
    room_code: str,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.start_game(room, _configured_mode(room)),
    )


@router.post('/round/activate', response_model=CommandResponse)
async def activate_round(
    room_code: str,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.activate_round(room, _configured_mode(room)),
    )


@router.post('/round/reveal', response_model=CommandResponse)
async def reveal_round(
    room_code: str,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.reveal_round(room, _configured_mode(room)),
    )


@router.post('/round/judge', response_model=CommandResponse)
async def judge_round(
    room_code: str,
    request: JudgeRoundRequest,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.judge_round(
            room,
            _configured_mode(room),
            request.correct,
        ),
    )


@router.post('/round/scoreboard', response_model=CommandResponse)
async def show_scoreboard(
    room_code: str,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.show_scoreboard(room, _configured_mode(room)),
    )


@router.post('/round/finish', response_model=CommandResponse)
async def finish_round(
    room_code: str,
    _: Annotated[None, Depends(require_host)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.finish_round(room, _configured_mode(room)),
    )


@router.post('/actions', response_model=CommandResponse)
async def submit_player_action(
    room_code: str,
    request: PlayerActionRequest,
    player: Annotated[Player, Depends(require_player)],
) -> CommandResponse:
    return await _mutate(
        room_code,
        lambda room: engine.submit_action(
            room,
            _configured_mode(room),
            player.id,
            request.action_type,
            request.value,
        ),
    )
