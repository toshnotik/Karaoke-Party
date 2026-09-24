export type RoomConnectedEvent = {
  type: 'room.connected'
  roomCode: string
  version: number
}

export type RoomUpdatedEvent = {
  type: 'room.updated'
  roomCode: string
  version: number
}

export type ScreenCommandEvent = {
  type: 'screen.command'
  roomCode: string
  command: 'continue_audio'
}

export type RoomEvent = RoomConnectedEvent | RoomUpdatedEvent | ScreenCommandEvent

export function parseRoomEvent(data: string): RoomEvent | null {
  let value: unknown
  try {
    value = JSON.parse(data) as unknown
  } catch {
    return null
  }

  if (typeof value !== 'object' || value === null) {
    return null
  }

  const event = value as Record<string, unknown>
  if (event.type === 'screen.command') {
    if (typeof event.roomCode !== 'string' || event.command !== 'continue_audio') {
      return null
    }
    return { type: event.type, roomCode: event.roomCode, command: event.command }
  }

  if ((event.type !== 'room.connected' && event.type !== 'room.updated') ||
      typeof event.roomCode !== 'string' || typeof event.version !== 'number') {
    return null
  }

  return {
    type: event.type,
    roomCode: event.roomCode,
    version: event.version,
  }
}
