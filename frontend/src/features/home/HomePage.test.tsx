import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoom, getRoom } from '../../api/rooms'
import { HomePage } from './HomePage'

vi.mock('../../api/rooms', () => ({
  createRoom: vi.fn(),
  getRoom: vi.fn(),
}))

const mockedCreateRoom = vi.mocked(createRoom)
const mockedGetRoom = vi.mocked(getRoom)

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/host/:roomCode" element={<div>Host destination</div>} />
        <Route path="/player/:roomCode" element={<div>Player destination</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    mockedCreateRoom.mockReset()
    mockedGetRoom.mockReset()
  })

  it('creates a room, stores the host token, and navigates to Host', async () => {
    mockedCreateRoom.mockResolvedValue({
      roomCode: 'K7PM',
      hostToken: 'host-secret',
      status: 'lobby',
      version: 1,
    })
    renderHome()

    await userEvent.click(screen.getByRole('button', { name: 'Создать игру' }))

    expect(await screen.findByText('Host destination')).toBeInTheDocument()
    expect(localStorage.getItem('karaoke-party:host:K7PM')).toBe('host-secret')
  })

  it('normalizes and verifies a room code before player navigation', async () => {
    mockedGetRoom.mockResolvedValue({} as never)
    renderHome()

    await userEvent.type(screen.getByLabelText('Код комнаты'), 'k7pm')
    await userEvent.click(screen.getByRole('button', { name: 'Войти в комнату' }))

    expect(mockedGetRoom).toHaveBeenCalledWith('K7PM')
    expect(await screen.findByText('Player destination')).toBeInTheDocument()
  })
})
