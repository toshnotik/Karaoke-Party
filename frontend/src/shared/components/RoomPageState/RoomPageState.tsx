import { Alert, Button, Spin } from 'antd'
import { Link } from 'react-router-dom'

import styles from './RoomPageState.module.scss'

export function RoomPageState({
  loading = false,
  title = 'Не удалось открыть комнату',
  message = 'Проверьте код комнаты и доступность сервера.',
  screen = false,
}: {
  loading?: boolean
  title?: string
  message?: string
  screen?: boolean
}) {
  return (
    <main className={`${styles.page} ${screen ? styles.screen : ''}`}>
      {loading ? (
        <><Spin size="large" /><p>Загружаем комнату...</p></>
      ) : (
        <div className={styles.content}>
          <Alert type="error" showIcon title={title} description={message} />
          <Link to="/"><Button size="large">Вернуться на главную</Button></Link>
        </div>
      )}
    </main>
  )
}
