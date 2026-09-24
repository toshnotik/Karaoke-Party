from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class RoomEvent(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    type: Literal["room.connected", "room.updated"]
    room_code: str
    version: int


class ScreenCommandEvent(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    type: Literal["screen.command"] = "screen.command"
    room_code: str
    command: Literal["continue_audio"]


def room_connected(room_code: str, version: int) -> RoomEvent:
    return RoomEvent(
        type="room.connected",
        room_code=room_code,
        version=version,
    )


def room_updated(room_code: str, version: int) -> RoomEvent:
    return RoomEvent(
        type="room.updated",
        room_code=room_code,
        version=version,
    )


def screen_command(room_code: str, command: Literal["continue_audio"]) -> ScreenCommandEvent:
    return ScreenCommandEvent(room_code=room_code, command=command)
