import { useEffect, useRef, useState } from 'react'

import { getScreenRoom } from '../api/rooms'
import type { ScreenSnapshot } from '../api/types'
import type { RealtimeStatus } from '../stores/roomStore'
import { RoomSynchronizer } from './roomSynchronizer'

type ScreenSynchronization = {
  screen: ScreenSnapshot | null
  loading: boolean
  error: string | null
  realtimeStatus: RealtimeStatus
  continueAudioRequest: number
}

export function useScreenSynchronization(roomCode: string): ScreenSynchronization {
  const screenRef = useRef<ScreenSnapshot | null>(null)
  const [state, setState] = useState<ScreenSynchronization>({
    screen: null,
    loading: true,
    error: null,
    realtimeStatus: 'disconnected',
    continueAudioRequest: 0,
  })

  useEffect(() => {
    screenRef.current = null
    setState({ screen: null, loading: true, error: null, realtimeStatus: 'disconnected', continueAudioRequest: 0 })
    const synchronizer = new RoomSynchronizer<ScreenSnapshot>({
      roomCode,
      getRoom: () => screenRef.current,
      loadRoom: async () => {
        try {
          const screen = await getScreenRoom(roomCode)
          screenRef.current = screen
          setState((current) => ({ ...current, screen, loading: false, error: null }))
          return screen
        } catch (error) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : 'Не удалось загрузить экран',
          }))
          throw error
        }
      },
      setRealtimeStatus: (realtimeStatus) =>
        setState((current) => ({ ...current, realtimeStatus })),
      onScreenCommand: () =>
        setState((current) => ({
          ...current,
          continueAudioRequest: current.continueAudioRequest + 1,
        })),
    })
    void synchronizer.start()
    return () => synchronizer.stop()
  }, [roomCode])

  return state
}
