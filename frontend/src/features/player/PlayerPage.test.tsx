import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/client'
import { joinRoom } from '../../api/rooms'
import { useRoomStore } from '../../stores/roomStore'
import { roomSnapshot } from '../../test/fixtures'
import { PlayerPage } from './PlayerPage'

vi.mock('../../api/rooms', () => ({ joinRoom: vi.fn() }))
vi.mock('../../realtime/useRoomSynchronization', () => ({
  useRoomSynchronization: vi.fn(),
}))

const mockedJoinRoom = vi.mocked(joinRoom)
const player = { id: 'player-1', name: 'Маша', participationType: 'remote' as const }

function renderPlayer() {
  render(
    <MemoryRouter initialEntries={['/player/K7PM']}>
      <Routes><Route path="/player/:roomCode" element={<PlayerPage />} /></Routes>
    </MemoryRouter>,
  )
}

describe('PlayerPage', () => {
  beforeEach(() => {
    mockedJoinRoom.mockReset()
    useRoomStore.getState().clearRoom()
    useRoomStore.getState().setRoom(roomSnapshot())
  })

  it('joins and stores player credentials', async () => {
    mockedJoinRoom.mockResolvedValue({
      player,
      playerToken: 'player-secret',
      room: roomSnapshot(2, [player]),
    })
    renderPlayer()

    await userEvent.type(screen.getByLabelText('Имя игрока'), 'Маша')
    await userEvent.click(screen.getByRole('button', { name: 'Присоединиться' }))

    expect(await screen.findByText('Привет, Маша')).toBeInTheDocument()
    expect(localStorage.getItem('karaoke-party:player:K7PM')).toContain('player-secret')
    expect(mockedJoinRoom).toHaveBeenCalledTimes(1)
  })

  it('reconnects with stored credentials without creating another player', async () => {
    localStorage.setItem(
      'karaoke-party:player:K7PM',
      JSON.stringify({ token: 'saved-token', name: 'Маша', playerId: 'player-1' }),
    )
    mockedJoinRoom.mockResolvedValue({
      player,
      playerToken: 'saved-token',
      room: roomSnapshot(2, [player]),
    })

    renderPlayer()

    expect(await screen.findByText('Привет, Маша')).toBeInTheDocument()
    expect(mockedJoinRoom).toHaveBeenCalledWith('K7PM', 'Маша', 'saved-token')
    expect(mockedJoinRoom).toHaveBeenCalledTimes(1)
  })

  it('removes an invalid token and returns to the join form', async () => {
    localStorage.setItem(
      'karaoke-party:player:K7PM',
      JSON.stringify({ token: 'invalid', name: 'Маша', playerId: 'player-1' }),
    )
    mockedJoinRoom.mockRejectedValue(new ApiError(401, 'Invalid player token'))

    renderPlayer()

    expect(await screen.findByLabelText('Имя игрока')).toBeInTheDocument()
    expect(localStorage.getItem('karaoke-party:player:K7PM')).toBeNull()
  })

  it('migrates legacy credentials through reconnect', async () => {
    localStorage.setItem(
      'karaoke-party:player:K7PM',
      JSON.stringify({ token: 'saved-token', name: 'Маша' }),
    )
    mockedJoinRoom.mockResolvedValue({
      player,
      playerToken: 'saved-token',
      room: roomSnapshot(2, [player]),
    })

    renderPlayer()

    expect(await screen.findByText('Привет, Маша')).toBeInTheDocument()
    expect(localStorage.getItem('karaoke-party:player:K7PM')).toContain('player-1')
  })
})
