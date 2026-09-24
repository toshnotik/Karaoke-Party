import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { submitPlayerAction } from '../../api/game'
import { roomSnapshot } from '../../test/fixtures'
import { PlayerGamePanel } from './PlayerGamePanel'

vi.mock('../../api/game', () => ({ submitPlayerAction: vi.fn() }))
const mockedBuzz = vi.mocked(submitPlayerAction)
const players = [
  { id: 'player-1', name: 'Маша', participationType: 'remote' as const },
  { id: 'player-2', name: 'Костя', participationType: 'remote' as const },
]

function activeRoom() {
  const room = roomSnapshot(6, players)
  room.status = 'playing'
  room.game = {
    mode: 'guess_song', status: 'playing', roundNumber: 1, totalRounds: 2, scores: [],
    currentRound: { id: 'round-1', number: 1, phase: 'active', prompt: 'Guess', result: null,
      modeState: { currentResponderId: null, excludedPlayerIds: [] } },
  }
  return room
}

describe('PlayerGamePanel', () => {
  beforeEach(() => mockedBuzz.mockReset())

  it('sends one buzz while pending', async () => {
    let resolve!: () => void
    mockedBuzz.mockReturnValue(new Promise((done) => { resolve = () => done({ roomCode: 'K7PM', version: 7 }) }))
    render(<PlayerGamePanel room={activeRoom()} playerId="player-1" playerToken="token" realtimeStatus="connected" />)
    const button = screen.getByRole('button', { name: 'ЗНАЮ!' })
    await userEvent.click(button)
    await userEvent.click(button)
    expect(mockedBuzz).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    resolve()
  })

  it('keeps the snapshot visible but disables buzz while reconnecting', () => {
    render(<PlayerGamePanel room={activeRoom()} playerId="player-1" playerToken="token" realtimeStatus="reconnecting" />)
    expect(screen.getByRole('button', { name: 'ВОССТАНАВЛИВАЕМ СВЯЗЬ' })).toBeDisabled()
    expect(screen.getByText('Раунд 1')).toBeInTheDocument()
  })

  it.each([
    ['player-1', [], 'Вы отвечаете'],
    ['player-2', [], 'Отвечает Костя'],
    [null, ['player-1'], 'Вы уже отвечали'],
  ] as const)('renders authoritative active state', (responder, excluded, text) => {
    const room = activeRoom()
    room.game.currentRound!.modeState = { currentResponderId: responder, excludedPlayerIds: [...excluded] }
    render(<PlayerGamePanel room={room} playerId="player-1" playerToken="token" realtimeStatus="connected" />)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ЗНАЮ!' })).not.toBeInTheDocument()
  })

  it('shows reveal, scoreboard, and final scoreboard', () => {
    const room = activeRoom()
    room.game.currentRound!.phase = 'reveal'
    room.game.currentRound!.result = {
      answer: null, correctPlayerIds: ['player-1'], winnerPlayerId: 'player-1',
      song: { title: 'Песня', artist: 'Артист', year: 2001 },
    }
    const { rerender } = render(<PlayerGamePanel room={room} playerId="player-1" playerToken="token" realtimeStatus="connected" />)
    expect(screen.getByText('Песня')).toBeInTheDocument()
    room.game.currentRound!.phase = 'scoreboard'
    room.game.scores = [{ targetType: 'player', targetId: 'player-1', points: 100 }]
    rerender(<PlayerGamePanel room={room} playerId="player-1" playerToken="token" realtimeStatus="connected" />)
    expect(screen.getByText('Результаты')).toBeInTheDocument()
    room.game.status = 'finished'; room.status = 'finished'
    rerender(<PlayerGamePanel room={room} playerId="player-1" playerToken="token" realtimeStatus="connected" />)
    expect(screen.getByText('Игра окончена')).toBeInTheDocument()
  })
})
