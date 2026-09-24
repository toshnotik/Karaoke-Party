import type { RealtimeStatus } from '../stores/roomStore'
import type { RoomEvent } from './events'
import { RoomSocket } from './roomSocket'

type VersionedSnapshot = { version: number }

type RoomSynchronizerOptions<Snapshot extends VersionedSnapshot> = {
  roomCode: string
  getRoom: () => Snapshot | null
  loadRoom: () => Promise<Snapshot>
  setRealtimeStatus: (status: RealtimeStatus) => void
  onScreenCommand?: (command: 'continue_audio') => void
  createSocket?: (
    onEvent: (event: RoomEvent) => void,
    onStatusChange: (status: RealtimeStatus) => void,
  ) => Pick<RoomSocket, 'connect' | 'close'>
}

export class RoomSynchronizer<Snapshot extends VersionedSnapshot> {
  private active = false
  private socket: Pick<RoomSocket, 'connect' | 'close'> | null = null
  private targetVersion = 0
  private refreshing = false

  constructor(private readonly options: RoomSynchronizerOptions<Snapshot>) {}

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
    if (event.type === 'screen.command') {
      this.options.onScreenCommand?.(event.command)
      return
    }
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
