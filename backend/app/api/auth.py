from typing import Annotated

from fastapi import Header, HTTPException

from app.rooms.models import Player
from app.rooms.store import (
    InvalidHostTokenError,
    InvalidPlayerTokenError,
    RoomNotFoundError,
    room_store,
)


def _bearer_token(authorization: str | None) -> str:
    if authorization is None:
        raise HTTPException(status_code=401, detail='Missing bearer token')
    scheme, separator, token = authorization.partition(' ')
    if separator == '' or scheme.casefold() != 'bearer' or not token or ' ' in token:
        raise HTTPException(status_code=401, detail='Invalid bearer token')
    return token


def require_host(
    room_code: str,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    try:
        room_store.get_room(room_code)
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail='Room not found') from error

    try:
        room_store.authenticate_host(room_code, _bearer_token(authorization))
    except InvalidHostTokenError as error:
        raise HTTPException(status_code=401, detail='Invalid host token') from error


def require_player(
    room_code: str,
    authorization: Annotated[str | None, Header()] = None,
) -> Player:
    try:
        room_store.get_room(room_code)
    except RoomNotFoundError as error:
        raise HTTPException(status_code=404, detail='Room not found') from error

    try:
        return room_store.authenticate_player(room_code, _bearer_token(authorization))
    except InvalidPlayerTokenError as error:
        raise HTTPException(status_code=401, detail='Invalid player token') from error
