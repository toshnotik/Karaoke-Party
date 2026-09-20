import type { RoomSnapshot } from '../api/types'

export function roomSnapshot(
  version = 1,
  players: RoomSnapshot['players'] = [],
): RoomSnapshot {
  return {
    roomCode: 'K7PM',
    status: 'lobby',
    version,
    players,
    game: {
      mode: null,
      status: 'lobby',
      roundNumber: 0,
      totalRounds: 0,
      currentRound: null,
      scores: [],
    },
  }
}
