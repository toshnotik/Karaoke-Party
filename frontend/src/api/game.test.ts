import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configureGame, submitPlayerAction } from './game'

describe('game API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ roomCode: 'K7PM', version: 2 }),
    }))
  })

  it('sends the host token as a bearer header', async () => {
    await configureGame('K7PM', 'host-secret', 'dummy')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/rooms/K7PM/game/configure',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer host-secret',
          'Content-Type': 'application/json',
        },
      }),
    )
  })

  it('sends the player token without a player id', async () => {
    await submitPlayerAction('K7PM', 'player-secret', 'answer', 'Answer 1')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/rooms/K7PM/game/actions',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer player-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actionType: 'answer', value: 'Answer 1' }),
      }),
    )
  })
})
