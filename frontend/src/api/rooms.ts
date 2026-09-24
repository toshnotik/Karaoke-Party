import { apiRequest } from './client'
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomSnapshot,
  ScreenSnapshot,
} from './types'

export function createRoom(): Promise<CreateRoomResponse> {
  return apiRequest('/api/rooms', { method: 'POST' })
}

export function getRoom(roomCode: string): Promise<RoomSnapshot> {
  return apiRequest(`/api/rooms/${encodeURIComponent(roomCode)}`)
}

export function getScreenRoom(roomCode: string): Promise<ScreenSnapshot> {
  return apiRequest(`/api/rooms/${encodeURIComponent(roomCode)}/screen`)
}

export function joinRoom(
  roomCode: string,
  name: string,
  playerToken?: string,
): Promise<JoinRoomResponse> {
  return apiRequest(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, playerToken }),
  })
}
