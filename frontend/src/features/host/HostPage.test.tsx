import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { HostPage } from './HostPage'

vi.mock('../../realtime/useRoomSynchronization', () => ({
  useRoomSynchronization: vi.fn(),
}))

it('shows an access state when the host token is missing', () => {
  render(
    <MemoryRouter initialEntries={['/host/K7PM']}>
      <Routes><Route path="/host/:roomCode" element={<HostPage />} /></Routes>
    </MemoryRouter>,
  )

  expect(screen.getByText('Нет доступа ведущего')).toBeInTheDocument()
  expect(screen.queryByText('Начать игру')).not.toBeInTheDocument()
})
