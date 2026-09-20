import { useEffect } from 'react'

import { useRoomStore } from '../stores/roomStore'
import { RoomSynchronizer } from './roomSynchronizer'

export function useRoomSynchronization(
  roomCode: string,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const store = useRoomStore.getState()
    store.clearRoom()
    const synchronizer = new RoomSynchronizer({
      roomCode,
      getRoom: () => useRoomStore.getState().room,
      loadRoom: () => useRoomStore.getState().loadRoom(roomCode),
      setRealtimeStatus: (status) =>
        useRoomStore.getState().setRealtimeStatus(status),
    })
    void synchronizer.start()

    return () => synchronizer.stop()
  }, [enabled, roomCode])
}
