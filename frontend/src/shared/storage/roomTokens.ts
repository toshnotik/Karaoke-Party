export type PlayerCredentials = {
  token: string
  name: string
  playerId: string
}

const normalizedCode = (roomCode: string) => roomCode.trim().toUpperCase()
const hostKey = (roomCode: string) =>
  `karaoke-party:host:${normalizedCode(roomCode)}`
const playerKey = (roomCode: string) =>
  `karaoke-party:player:${normalizedCode(roomCode)}`

export function saveHostToken(roomCode: string, token: string): void {
  localStorage.setItem(hostKey(roomCode), token)
}

export function getHostToken(roomCode: string): string | null {
  return localStorage.getItem(hostKey(roomCode))
}

export function savePlayerCredentials(
  roomCode: string,
  credentials: PlayerCredentials,
): void {
  localStorage.setItem(playerKey(roomCode), JSON.stringify(credentials))
}

export function getPlayerCredentials(
  roomCode: string,
): PlayerCredentials | null {
  const stored = localStorage.getItem(playerKey(roomCode))
  if (stored === null) {
    return null
  }
  try {
    const value = JSON.parse(stored) as Partial<PlayerCredentials>
    if (
      typeof value.token === 'string' &&
      typeof value.name === 'string' &&
      typeof value.playerId === 'string'
    ) {
      return {
        token: value.token,
        name: value.name,
        playerId: value.playerId,
      }
    }
  } catch {
    // Invalid local data is treated like a missing token.
  }
  localStorage.removeItem(playerKey(roomCode))
  return null
}

export function clearPlayerCredentials(roomCode: string): void {
  localStorage.removeItem(playerKey(roomCode))
}
