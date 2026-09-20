import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getRoom } from '../api/rooms'
import { roomSnapshot } from '../test/fixtures'
import { useRoomStore } from './roomStore'

vi.mock('../api/rooms', () => ({ getRoom: vi.fn() }))

describe('roomStore', () => {
  beforeEach(() => useRoomStore.getState().clearRoom())

  it('loads and replaces the authoritative room snapshot', async () => {
    vi.mocked(getRoom).mockResolvedValue(roomSnapshot(4))

    await useRoomStore.getState().loadRoom('K7PM')

    expect(useRoomStore.getState().room?.version).toBe(4)
    expect(useRoomStore.getState().loading).toBe(false)
  })
})
