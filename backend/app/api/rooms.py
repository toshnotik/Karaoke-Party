from typing import Annotated

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from pydantic.alias_generators import to_camel

from app.game.state import GameStatus, RoundPhase, ScoreTargetType
from app.game.modes.guess_song import GuessSongRoundState
from app.realtime.manager import connection_manager
from app.rooms.models import ParticipationType, Player, Room
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


class PublicRoundResult(ApiModel):
    answer: str | None = None
    correct_player_ids: list[str]
    song: "PublicSong | None" = None
    winner_player_id: str | None = None


class PublicSong(ApiModel):
    title: str
    artist: str
    year: int | None


class PublicModeState(ApiModel):
    current_responder_id: str | None
    excluded_player_ids: list[str]


class PublicRound(ApiModel):
    id: str
    number: int
    phase: RoundPhase
    prompt: str
    result: PublicRoundResult | None
    mode_state: PublicModeState | None = None


class PublicScore(ApiModel):
    target_type: ScoreTargetType
    target_id: str
    points: int


class PublicGame(ApiModel):
    mode: str | None
    status: GameStatus
    round_number: int
    total_rounds: int
    current_round: PublicRound | None
    scores: list[PublicScore]


class RoomSnapshot(ApiModel):
    room_code: str
    status: GameStatus
    version: int
    players: list[PublicPlayer]
    game: PublicGame


class CreateRoomResponse(ApiModel):
    room_code: str
    host_token: str
    status: GameStatus
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
        status=room.game.status,
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
async def join_room(
    room_code: str,
    request: JoinRoomRequest,
    response: Response,
) -> JoinRoomResponse:
    try:
        mutation = room_store.add_or_reconnect_player(
            room_code=room_code,
            name=request.name,
            player_token=request.player_token,
        )
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail="Room not found") from error
    except InvalidPlayerTokenError as error:
        raise HTTPException(status_code=401, detail="Invalid player token") from error

    room = mutation.room
    player, created = mutation.value
    if mutation.changed:
        await connection_manager.broadcast_room_updated(
            room.room_code,
            room.version,
        )

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
        status=room.game.status,
        version=room.version,
        players=[_public_player(player) for player in room.players],
        game=_public_game(room),
    )


def _public_game(room: Room) -> PublicGame:
    round_state = room.game.current_round
    public_round = None
    if round_state is not None:
        result = None
        if round_state.result is not None:
            if isinstance(round_state.mode_state, GuessSongRoundState):
                song = round_state.mode_state.song
                result = PublicRoundResult(
                    correct_player_ids=list(round_state.result.correct_player_ids),
                    song=PublicSong(title=song.title, artist=song.artist, year=song.year),
                    winner_player_id=round_state.mode_state.winner_player_id,
                )
            else:
                result = PublicRoundResult(
                    answer=round_state.result.answer,
                    correct_player_ids=list(round_state.result.correct_player_ids),
                )
        mode_state = None
        if isinstance(round_state.mode_state, GuessSongRoundState):
            mode_state = PublicModeState(
                current_responder_id=round_state.mode_state.current_responder_id,
                excluded_player_ids=list(round_state.mode_state.excluded_player_ids),
            )
        public_round = PublicRound(
            id=round_state.id,
            number=round_state.number,
            phase=round_state.phase,
            prompt=round_state.prompt,
            result=result,
            mode_state=mode_state,
        )

    return PublicGame(
        mode=room.game.mode,
        status=room.game.status,
        round_number=room.game.round_number,
        total_rounds=room.game.total_rounds,
        current_round=public_round,
        scores=[
            PublicScore(
                target_type=score.target_type,
                target_id=score.target_id,
                points=score.points,
            )
            for score in room.game.scores
        ],
    )


def _public_player(player: Player) -> PublicPlayer:
    return PublicPlayer(
        id=player.id,
        name=player.name,
        participation_type=player.participation_type,
    )
