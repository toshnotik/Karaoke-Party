import { QRCodeSVG } from 'qrcode.react'
import { useParams } from 'react-router-dom'

import { useRoomSynchronization } from '../../realtime/useRoomSynchronization'
import { Brand } from '../../shared/components/Brand/Brand'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus/ConnectionStatus'
import { PlayerRoster } from '../../shared/components/PlayerRoster/PlayerRoster'
import { RoomPageState } from '../../shared/components/RoomPageState/RoomPageState'
import { playerJoinUrl } from '../../shared/urls'
import { useRoomStore } from '../../stores/roomStore'
import styles from './ScreenPage.module.scss'

export function ScreenPage() {
  const roomCode = useParams().roomCode?.toUpperCase() ?? ''
  const { room, loading, error, realtimeStatus } = useRoomStore()
  useRoomSynchronization(roomCode, roomCode.length > 0)

  if (loading && room === null) return <RoomPageState loading screen />
  if (error || room === null) {
    return <RoomPageState screen message={error?.message} />
  }

  const joinUrl = playerJoinUrl(room.roomCode)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <ConnectionStatus status={realtimeStatus} />
      </header>

      <section className={styles.joinArea}>
        <div className={styles.codeBlock}>
          <p>Код комнаты</p>
          <h1>{room.roomCode}</h1>
          <span>Сканируйте QR-код, чтобы присоединиться</span>
        </div>
        <div className={styles.qr} aria-label={`QR-код для ${joinUrl}`}>
          <QRCodeSVG value={joinUrl} size={240} level="M" marginSize={2} />
        </div>
      </section>

      <section className={styles.players}>
        <div className={styles.playersHeading}>
          <h2>В игре</h2>
          <span>{room.players.length} игроков</span>
        </div>
        <PlayerRoster players={room.players} large />
      </section>

      <footer>Ожидаем игроков</footer>
    </main>
  )
}
