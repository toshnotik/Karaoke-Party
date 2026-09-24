import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import type { ScreenSnapshot } from '../../api/types'
import { roomSnapshot } from '../../test/fixtures'
import { ScreenPage } from './ScreenPage'

let currentScreen: ScreenSnapshot
vi.mock('../../realtime/useScreenSynchronization', () => ({
  useScreenSynchronization: () => ({
    screen: currentScreen, loading: false, error: null, realtimeStatus: 'connected',
  }),
}))
vi.mock('./audioController', () => ({
  GuessSongAudioController: class {
    unlock = vi.fn()
    sync = vi.fn()
    destroy = vi.fn()
  },
}))

const players = [
  { id: 'a', name: 'Аня', participationType: 'remote' as const },
  { id: 'b', name: 'Борис', participationType: 'remote' as const },
]

function makeScreen(): ScreenSnapshot {
  return { ...roomSnapshot(1, players), playback: null }
}

function renderScreen() {
  return render(<MemoryRouter initialEntries={['/screen/K7PM']}><Routes>
    <Route path="/screen/:roomCode" element={<ScreenPage />} />
  </Routes></MemoryRouter>)
}

beforeEach(() => { currentScreen = makeScreen() })

it('keeps lobby behind an explicit audio unlock', async () => {
  renderScreen()
  expect(screen.getByText('Включить игровой экран')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Готов к игре' }))
  expect(screen.getByText('Код комнаты')).toBeInTheDocument()
})

it('shows intro, listening, responder, and reveal states', async () => {
  currentScreen.status = 'playing'
  currentScreen.game = {
    mode: 'guess_song', status: 'playing', roundNumber: 1, totalRounds: 2, scores: [],
    currentRound: { id: 'r1', number: 1, phase: 'intro', prompt: 'Guess', result: null,
      modeState: { currentResponderId: null, excludedPlayerIds: [] } },
  }
  const view = renderScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Готов к игре' }))
  expect(screen.getByText('Угадай мелодию')).toBeInTheDocument()
  expect(screen.queryByText('Песня')).not.toBeInTheDocument()

  currentScreen.game.currentRound!.phase = 'active'
  view.rerender(<MemoryRouter initialEntries={['/screen/K7PM']}><Routes><Route path="/screen/:roomCode" element={<ScreenPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Слушаем...')).toBeInTheDocument()
  currentScreen.game.currentRound!.modeState!.currentResponderId = 'b'
  view.rerender(<MemoryRouter initialEntries={['/screen/K7PM']}><Routes><Route path="/screen/:roomCode" element={<ScreenPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Борис')).toBeInTheDocument()

  currentScreen.game.currentRound!.phase = 'reveal'
  currentScreen.game.currentRound!.result = {
    answer: null, correctPlayerIds: ['b'], winnerPlayerId: 'b',
    song: { title: 'Песня', artist: 'Артист', year: 2001 },
  }
  view.rerender(<MemoryRouter initialEntries={['/screen/K7PM']}><Routes><Route path="/screen/:roomCode" element={<ScreenPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Песня')).toBeInTheDocument()
  expect(screen.getByText('Угадал: Борис')).toBeInTheDocument()
})

it('shows sorted scoreboard and finished state', async () => {
  currentScreen.status = 'playing'
  currentScreen.game = {
    mode: 'guess_song', status: 'playing', roundNumber: 1, totalRounds: 1,
    scores: [{ targetType: 'player', targetId: 'b', points: 100 }],
    currentRound: { id: 'r1', number: 1, phase: 'scoreboard', prompt: 'Guess', result: null, modeState: null },
  }
  const view = renderScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Готов к игре' }))
  expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Борис')
  currentScreen.status = 'finished'; currentScreen.game.status = 'finished'
  view.rerender(<MemoryRouter initialEntries={['/screen/K7PM']}><Routes><Route path="/screen/:roomCode" element={<ScreenPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Игра окончена')).toBeInTheDocument()
})
