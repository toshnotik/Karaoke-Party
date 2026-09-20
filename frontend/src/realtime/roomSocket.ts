import { apiBaseUrl } from '../api/client'
import { parseRoomEvent, type RoomEvent } from './events'

export type SocketStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

const reconnectDelayMs = 1_000

export function roomWebSocketUrl(roomCode: string): string {
  const apiUrl = new URL(apiBaseUrl, window.location.origin)
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${apiUrl.host}/ws/rooms/${encodeURIComponent(roomCode)}`
}

export class RoomSocket {
  private socket: WebSocket | null = null
  private reconnectTimer: number | null = null
  private manuallyClosed = false

  constructor(
    private readonly roomCode: string,
    private readonly onEvent: (event: RoomEvent) => void,
    private readonly onStatusChange: (status: SocketStatus) => void = () => {},
  ) {}

  connect(): void {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return
    }

    this.manuallyClosed = false
    this.onStatusChange(
      this.reconnectTimer === null ? 'connecting' : 'reconnecting',
    )
    const socket = new WebSocket(roomWebSocketUrl(this.roomCode))
    this.socket = socket

    socket.onopen = () => {
      this.onStatusChange('connected')
    }

    socket.onmessage = (message) => {
      if (typeof message.data !== 'string') {
        return
      }
      const event = parseRoomEvent(message.data)
      if (event !== null) {
        this.onEvent(event)
      }
    }

    socket.onclose = () => {
      if (this.socket !== socket) {
        return
      }
      this.socket = null
      if (!this.manuallyClosed && this.reconnectTimer === null) {
        this.onStatusChange('reconnecting')
        this.reconnectTimer = window.setTimeout(
          () => {
            this.reconnectTimer = null
            this.connect()
          },
          reconnectDelayMs,
        )
      }
    }
  }

  close(): void {
    this.manuallyClosed = true
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    this.onStatusChange('disconnected')
  }
}
