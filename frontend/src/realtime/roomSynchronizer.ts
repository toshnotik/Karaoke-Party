import type { RoomSnapshot } from '../api/types'
import type { RealtimeStatus } from '../stores/roomStore'
import type { RoomEvent } from './events'
import { RoomSocket } from './roomSocket'

type RoomSynchronizerOptions = {
  roomCode: string
  getRoom: () => RoomSnapshot | null
  loadRoom: () => Promise<RoomSnapshot>
  setRealtimeStatus: (status: RealtimeStatus) => void
  createSocket?: (
    onEvent: (event: RoomEvent) => void,
    onStatusChange: (status: RealtimeStatus) => void,
  ) => Pick<RoomSocket, 'connect' | 'close'>
}

export class RoomSynchronizer {
  private active = false
  private socket: Pick<RoomSocket, 'connect' | 'close'> | null = null
  private targetVersion = 0
  private refreshing = false

  constructor(private readonly options: RoomSynchronizerOptions) {}

  async start(): Promise<void> {
    this.active = true
    try {
      await this.options.loadRoom()
    } catch {
      return
    }
    if (!this.active) {
      return
    }

    const createSocket =
      this.options.createSocket ??
      ((onEvent, onStatusChange) =>
        new RoomSocket(this.options.roomCode, onEvent, onStatusChange))
    this.socket = createSocket(
      (event) => this.handleEvent(event),
      this.options.setRealtimeStatus,
    )
    this.socket.connect()
  }

  stop(): void {
    this.active = false
    this.socket?.close()
    this.socket = null
  }

  private handleEvent(event: RoomEvent): void {
    const localVersion = this.options.getRoom()?.version ?? 0
    if (event.version <= localVersion) {
      return
    }
    this.targetVersion = Math.max(this.targetVersion, event.version)
    void this.refreshToTargetVersion()
  }

  private async refreshToTargetVersion(): Promise<void> {
    if (this.refreshing) {
      return
    }
    this.refreshing = true
    try {
      while (this.active) {
        const currentVersion = this.options.getRoom()?.version ?? 0
        if (currentVersion >= this.targetVersion) {
          break
        }
        const requestedVersion = this.targetVersion
        const room = await this.options.loadRoom()
        if (room.version < requestedVersion) {
          break
        }
      }
    } catch {
      // The store exposes the REST error; a reconnect event can retry later.
    } finally {
      this.refreshing = false
    }
  }
}
