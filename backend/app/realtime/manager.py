from typing import Literal

from fastapi import WebSocket

from app.realtime.messages import (
    RoomEvent,
    ScreenCommandEvent,
    room_connected,
    room_updated,
    screen_command,
)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(
        self,
        room_code: str,
        websocket: WebSocket,
        version: int,
    ) -> None:
        await websocket.accept()
        normalized_code = room_code.upper()
        self._connections.setdefault(normalized_code, set()).add(websocket)
        try:
            await self._send(
                websocket,
                room_connected(normalized_code, version),
            )
        except Exception:
            self.disconnect(normalized_code, websocket)
            raise

    def disconnect(self, room_code: str, websocket: WebSocket) -> None:
        normalized_code = room_code.upper()
        connections = self._connections.get(normalized_code)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(normalized_code, None)

    async def broadcast_room_updated(self, room_code: str, version: int) -> None:
        normalized_code = room_code.upper()
        event = room_updated(normalized_code, version)
        for websocket in tuple(self._connections.get(normalized_code, ())):
            try:
                await self._send(websocket, event)
            except Exception:
                self.disconnect(normalized_code, websocket)

    async def broadcast_screen_command(
        self,
        room_code: str,
        command: Literal["continue_audio"],
    ) -> None:
        normalized_code = room_code.upper()
        event = screen_command(normalized_code, command)
        for websocket in tuple(self._connections.get(normalized_code, ())):
            try:
                await self._send(websocket, event)
            except Exception:
                self.disconnect(normalized_code, websocket)

    def connection_count(self, room_code: str) -> int:
        return len(self._connections.get(room_code.upper(), ()))

    def clear(self) -> None:
        self._connections.clear()

    @staticmethod
    async def _send(
        websocket: WebSocket,
        event: RoomEvent | ScreenCommandEvent,
    ) -> None:
        await websocket.send_json(event.model_dump(by_alias=True))


connection_manager = ConnectionManager()
