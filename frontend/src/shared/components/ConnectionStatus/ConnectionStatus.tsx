import type { RealtimeStatus } from '../../../stores/roomStore'
import styles from './ConnectionStatus.module.scss'

const labels: Record<RealtimeStatus, string> = {
  connected: 'Синхронизация активна',
  connecting: 'Подключение...',
  reconnecting: 'Восстанавливаем связь...',
  disconnected: 'Нет соединения',
}

export function ConnectionStatus({ status }: { status: RealtimeStatus }) {
  return (
    <div className={styles.status} data-status={status} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {labels[status]}
    </div>
  )
}
