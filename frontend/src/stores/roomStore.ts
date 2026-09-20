import { create } from 'zustand'

import { ApiError } from '../api/client'
import { getRoom } from '../api/rooms'
import type { RoomSnapshot } from '../api/types'

export type RealtimeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

type RoomError = {
  message: string
  status?: number
}

type RoomStore = {
  room: RoomSnapshot | null
  loading: boolean
  error: RoomError | null
  realtimeStatus: RealtimeStatus
  loadRoom: (roomCode: string) => Promise<RoomSnapshot>
  setRoom: (room: RoomSnapshot) => void
  setRealtimeStatus: (status: RealtimeStatus) => void
  clearRoom: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  loading: false,
  error: null,
  realtimeStatus: 'disconnected',
  loadRoom: async (roomCode) => {
    set({ loading: true, error: null })
    try {
      const room = await getRoom(roomCode)
      set({ room, loading: false })
      return room
    } catch (error) {
      const roomError = {
        message: error instanceof Error ? error.message : 'Не удалось загрузить комнату',
        status: error instanceof ApiError ? error.status : undefined,
      }
      set({ room: null, loading: false, error: roomError })
      throw error
    }
  },
  setRoom: (room) => set({ room, loading: false, error: null }),
  setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),
  clearRoom: () =>
    set({
      room: null,
      loading: false,
      error: null,
      realtimeStatus: 'disconnected',
    }),
}))
