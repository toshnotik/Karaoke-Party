import { Button, Tooltip } from 'antd'
import { Link, useParams } from 'react-router-dom'

import { useRoomSynchronization } from '../../realtime/useRoomSynchronization'
import { Brand } from '../../shared/components/Brand/Brand'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus/ConnectionStatus'
import { PlayerRoster } from '../../shared/components/PlayerRoster/PlayerRoster'
import { RoomPageState } from '../../shared/components/RoomPageState/RoomPageState'
import { getHostToken } from '../../shared/storage/roomTokens'
import { useRoomStore } from '../../stores/roomStore'
import styles from './HostPage.module.scss'

export function HostPage() {
  const roomCode = useParams().roomCode?.toUpperCase() ?? ''
  const hasHostAccess = getHostToken(roomCode) !== null
  const { room, loading, error, realtimeStatus } = useRoomStore()
  useRoomSynchronization(roomCode, hasHostAccess && roomCode.length > 0)

  if (!hasHostAccess) {
    return (
      <RoomPageState
        title="Нет доступа ведущего"
        message="Создайте новую игру на главной странице этого браузера."
      />
    )
  }
  if (loading && room === null) return <RoomPageState loading />
  if (error || room === null) {
    return <RoomPageState message={error?.message} />
  }

  const openScreen = () => {
    window.open(`/screen/${roomCode}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand compact />
        <ConnectionStatus status={realtimeStatus} />
      </header>

      <section className={styles.roomHeader}>
        <div>
          <p className={styles.kicker}>Панель ведущего</p>
          <h1>Комната <span>{room.roomCode}</span></h1>
          <p>Игроков: {room.players.length}</p>
        </div>
        <Button size="large" onClick={openScreen}>Открыть экран</Button>
      </section>

      <section className={styles.lobby}>
        <div className={styles.sectionHeading}>
          <div><p>Лобби</p><h2>Участники</h2></div>
          <span>{room.players.length}</span>
        </div>
        <PlayerRoster players={room.players} />
      </section>

      <footer className={styles.actions}>
        <Link to="/">На главную</Link>
        <Tooltip title="Будет доступно после выбора игрового режима">
          <span><Button type="primary" size="large" disabled>Начать игру</Button></span>
        </Tooltip>
      </footer>
    </main>
  )
}
