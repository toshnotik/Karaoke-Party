from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.realtime.manager import connection_manager
from app.rooms.store import RoomNotFoundError, room_store


router = APIRouter(prefix="/ws/rooms", tags=["realtime"])


@router.websocket("/{room_code}")
async def room_websocket(websocket: WebSocket, room_code: str) -> None:
    try:
        room = room_store.get_room(room_code)
    except RoomNotFoundError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await connection_manager.connect(room.room_code, websocket, room.version)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(room.room_code, websocket)
