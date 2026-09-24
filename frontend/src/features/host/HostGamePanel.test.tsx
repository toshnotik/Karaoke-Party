import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { startGame } from '../../api/game'
import { useRoomStore } from '../../stores/roomStore'
import { roomSnapshot } from '../../test/fixtures'
import { HostGamePanel } from './HostGamePanel'

vi.mock('../../api/game', () => ({
  activateRound: vi.fn(),
  configureGame: vi.fn(),
  finishRound: vi.fn(),
  revealRound: vi.fn(),
  showScoreboard: vi.fn(),
  startGame: vi.fn(),
}))

const mockedStartGame = vi.mocked(startGame)

beforeEach(() => {
  mockedStartGame.mockReset()
  useRoomStore.getState().clearRoom()
})

it.each([
  ['lobby', null, 'Configure Dummy Game'],
  ['ready', null, 'Start Game'],
  ['playing', 'intro', 'Activate Round'],
  ['playing', 'active', 'Reveal'],
  ['playing', 'reveal', 'Show Scoreboard'],
  ['playing', 'scoreboard', 'Finish Round'],
] as const)(
  'enables the correct command for %s / %s',
  (status, phase, enabledLabel) => {
    const room = roomSnapshot()
    room.status = status
    room.game.status = status
    room.game.mode = status === 'lobby' ? null : 'dummy'
    room.game.currentRound = phase === null ? null : {
      id: 'round-1',
      number: 1,
      phase,
      prompt: 'Question 1',
      result: null,
    }

    render(<HostGamePanel room={room} hostToken="host-secret" />)

    const buttons = screen.getAllByRole('button')
    expect(screen.getByRole('button', { name: enabledLabel })).toBeEnabled()
    expect(
      buttons.filter((button) => !button.hasAttribute('disabled')),
    ).toHaveLength(1)
  },
)

it('does not replace authoritative room state when a command fails', async () => {
  const room = roomSnapshot()
  room.status = 'ready'
  room.game.status = 'ready'
  room.game.mode = 'dummy'
  useRoomStore.getState().setRoom(room)
  mockedStartGame.mockRejectedValue(new Error('Game can only start when ready'))

  render(<HostGamePanel room={room} hostToken="host-secret" />)
  await userEvent.click(screen.getByRole('button', { name: 'Start Game' }))

  expect(await screen.findByText('Game can only start when ready')).toBeInTheDocument()
  expect(useRoomStore.getState().room).toBe(room)
})
