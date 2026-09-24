import { describe, expect, it, vi } from 'vitest'

import type { RoomEvent } from './events'
import { RoomSynchronizer } from './roomSynchronizer'
import { roomSnapshot } from '../test/fixtures'

describe('RoomSynchronizer', () => {
  it('delivers an ephemeral screen command without loading a snapshot', async () => {
    const currentRoom = roomSnapshot(4)
    let onEvent: ((event: RoomEvent) => void) | undefined
    const loadRoom = vi.fn(async () => currentRoom)
    const onScreenCommand = vi.fn()
    const synchronizer = new RoomSynchronizer({
      roomCode: 'K7PM',
      getRoom: () => currentRoom,
      loadRoom,
      setRealtimeStatus: vi.fn(),
      onScreenCommand,
      createSocket: (eventHandler) => {
        onEvent = eventHandler
        return { connect: vi.fn(), close: vi.fn() }
      },
    })
    await synchronizer.start()
    loadRoom.mockClear()

    onEvent?.({ type: 'screen.command', roomCode: 'K7PM', command: 'continue_audio' })

    expect(onScreenCommand).toHaveBeenCalledWith('continue_audio')
    expect(loadRoom).not.toHaveBeenCalled()
  })

  it('refreshes only when an event announces a newer version', async () => {
    let currentRoom = roomSnapshot(1)
    let serverRoom = roomSnapshot(1)
    let onEvent: ((event: RoomEvent) => void) | undefined
    const loadRoom = vi.fn(async () => {
      currentRoom = serverRoom
      return currentRoom
    })
    const synchronizer = new RoomSynchronizer({
      roomCode: 'K7PM',
      getRoom: () => currentRoom,
      loadRoom,
      setRealtimeStatus: vi.fn(),
      createSocket: (eventHandler) => {
        onEvent = eventHandler
        return { connect: vi.fn(), close: vi.fn() }
      },
    })
    await synchronizer.start()
    loadRoom.mockClear()

    onEvent?.({ type: 'room.updated', roomCode: 'K7PM', version: 1 })
    expect(loadRoom).not.toHaveBeenCalled()

    serverRoom = roomSnapshot(2)
    onEvent?.({ type: 'room.updated', roomCode: 'K7PM', version: 2 })
    await vi.waitFor(() => expect(loadRoom).toHaveBeenCalledOnce())

    onEvent?.({ type: 'room.updated', roomCode: 'K7PM', version: 2 })
    expect(loadRoom).toHaveBeenCalledOnce()
    synchronizer.stop()
  })
})
