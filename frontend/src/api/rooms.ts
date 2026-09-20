import { apiRequest } from './client'
import type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomSnapshot,
} from './types'

export function createRoom(): Promise<CreateRoomResponse> {
  return apiRequest('/api/rooms', { method: 'POST' })
}

export function getRoom(roomCode: string): Promise<RoomSnapshot> {
  return apiRequest(`/api/rooms/${encodeURIComponent(roomCode)}`)
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
