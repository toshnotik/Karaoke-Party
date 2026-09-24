import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { continueScreenAudio, startGame } from '../../api/game'
import { useRoomStore } from '../../stores/roomStore'
import { roomSnapshot } from '../../test/fixtures'
import { HostGamePanel } from './HostGamePanel'

vi.mock('../../api/game', () => ({
  activateRound: vi.fn(),
  configureGame: vi.fn(),
  continueScreenAudio: vi.fn(),
  finishRound: vi.fn(),
  judgeRound: vi.fn(),
  revealRound: vi.fn(),
  showScoreboard: vi.fn(),
  startGame: vi.fn(),
}))

const mockedStartGame = vi.mocked(startGame)
const mockedContinueAudio = vi.mocked(continueScreenAudio)

beforeEach(() => {
  mockedStartGame.mockReset()
  mockedContinueAudio.mockReset()
  useRoomStore.getState().clearRoom()
})

it.each([
  ['lobby', null, 'Угадай мелодию', 1],
  ['ready', null, 'Начать игру', 1],
  ['playing', 'intro', 'Запустить фрагмент', 1],
  ['playing', 'active', 'Показать ответ', 2],
  ['playing', 'reveal', 'Показать результаты', 1],
  ['playing', 'scoreboard', 'Следующий раунд', 1],
] as const)(
  'enables the correct command for %s / %s',
  (status, phase, enabledLabel, enabledCount) => {
    const room = roomSnapshot()
    room.status = status
    room.game.status = status
    room.game.mode = status === 'lobby' ? null : 'dummy'
    room.game.roundNumber = phase === null ? 0 : 1
    room.game.totalRounds = phase === null ? 0 : 2
    if (status === 'ready') {
      room.players = [{ id: 'player-1', name: 'Маша', participationType: 'remote' }]
    }
    room.game.currentRound = phase === null ? null : {
      id: 'round-1',
      number: 1,
      phase,
      prompt: 'Question 1',
      result: null,
      modeState: null,
    }

    render(<HostGamePanel room={room} hostToken="host-secret" realtimeStatus="connected" />)

    expect(screen.getByRole('button', { name: enabledLabel })).toBeEnabled()
    expect(screen.getAllByRole('button')).toHaveLength(enabledCount)
  },
)

it('does not replace authoritative room state when a command fails', async () => {
  const room = roomSnapshot()
  room.status = 'ready'
  room.game.status = 'ready'
  room.game.mode = 'dummy'
  room.players = [{ id: 'player-1', name: 'Маша', participationType: 'remote' }]
  useRoomStore.getState().setRoom(room)
  mockedStartGame.mockRejectedValue(new Error('Game can only start when ready'))

  render(<HostGamePanel room={room} hostToken="host-secret" realtimeStatus="connected" />)
  await userEvent.click(screen.getByRole('button', { name: 'Начать игру' }))

  expect(await screen.findByText('Не удалось начать игру. Проверьте, что подключён хотя бы один игрок.')).toBeInTheDocument()
  expect(useRoomStore.getState().room).toBe(room)
})

it('offers judging instead of reveal while a responder is pending', () => {
  const room = roomSnapshot()
  room.status = 'playing'
  room.game.status = 'playing'
  room.game.mode = 'guess_song'
  room.players = [{ id: 'player-1', name: 'Маша', participationType: 'remote' }]
  room.game.currentRound = {
    id: 'round-1',
    number: 1,
    phase: 'active',
    prompt: 'Guess the song',
    result: null,
    modeState: {
      currentResponderId: 'player-1',
      excludedPlayerIds: [],
    },
  }

  render(<HostGamePanel room={room} hostToken="host-secret" realtimeStatus="connected" />)

  expect(screen.getByRole('button', { name: 'Верно' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Неверно' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Показать ответ' })).not.toBeInTheDocument()
  expect(screen.getByText('Отвечает Маша')).toBeInTheDocument()
})

it('prevents duplicate host commands while a request is pending', async () => {
  let resolve!: () => void
  mockedStartGame.mockReturnValue(new Promise((done) => {
    resolve = () => done({ roomCode: 'K7PM', version: 3 })
  }))
  const room = roomSnapshot()
  room.status = 'ready'
  room.game.status = 'ready'
  room.game.mode = 'guess_song'
  room.players = [{ id: 'player-1', name: 'Маша', participationType: 'remote' }]
  render(<HostGamePanel room={room} hostToken="host-secret" realtimeStatus="connected" />)

  const button = screen.getByRole('button', { name: 'Начать игру' })
  await userEvent.click(button)
  await userEvent.click(button)
  expect(mockedStartGame).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  resolve()
})

it('sends an ephemeral continue command and disables commands while disconnected', async () => {
  mockedContinueAudio.mockResolvedValue({ command: 'continue_audio' })
  const room = roomSnapshot()
  room.status = 'playing'
  room.game.status = 'playing'
  room.game.mode = 'guess_song'
  room.game.currentRound = {
    id: 'round-1', number: 1, phase: 'active', prompt: 'Guess', result: null,
    modeState: { currentResponderId: null, excludedPlayerIds: [] },
  }
  const view = render(<HostGamePanel room={room} hostToken="host-secret" realtimeStatus="connected" />)
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить фрагмент' }))
  expect(mockedContinueAudio).toHaveBeenCalledWith(room.roomCode, 'host-secret')
  await waitFor(() => expect(screen.getByRole('button', { name: /Продолжить фрагмент/ })).toBeEnabled())

  view.rerender(<HostGamePanel room={room} hostToken="host-secret" realtimeStatus="reconnecting" />)
  expect(screen.getByRole('button', { name: /Продолжить фрагмент/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Показать ответ' })).toBeDisabled()
})
