export function playerJoinUrl(roomCode: string, origin = window.location.origin): string {
  return `${origin}/player/${encodeURIComponent(roomCode)}`
}
