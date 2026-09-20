export type GameStatus = 'lobby' | 'ready' | 'playing' | 'finished'
export type RoundPhase = 'intro' | 'active' | 'reveal' | 'scoreboard' | 'finished'

export type PublicPlayer = {
  id: string
  name: string
  participationType: 'remote' | 'local'
}

export type PublicRoundResult = {
  answer: string
  correctPlayerIds: string[]
}

export type PublicRound = {
  id: string
  number: number
  phase: RoundPhase
  prompt: string
  result: PublicRoundResult | null
}

export type PublicScore = {
  targetType: 'player' | 'team'
  targetId: string
  points: number
}

export type PublicGame = {
  mode: string | null
  status: GameStatus
  roundNumber: number
  totalRounds: number
  currentRound: PublicRound | null
  scores: PublicScore[]
}

export type RoomSnapshot = {
  roomCode: string
  status: GameStatus
  version: number
  players: PublicPlayer[]
  game: PublicGame
}

export type CreateRoomResponse = {
  roomCode: string
  hostToken: string
  status: GameStatus
  version: number
}

export type JoinRoomResponse = {
  player: PublicPlayer
  playerToken: string
  room: RoomSnapshot
}
