import { Alert, Button, Form, Input } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createRoom, getRoom } from '../../api/rooms'
import { Brand } from '../../shared/components/Brand/Brand'
import { saveHostToken } from '../../shared/storage/roomTokens'
import styles from './HomePage.module.scss'

export function HomePage() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const room = await createRoom()
      saveHostToken(room.roomCode, room.hostToken)
      navigate(`/host/${room.roomCode}`)
    } catch {
      setError('Не удалось создать игру. Проверьте подключение к серверу.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    const normalized = roomCode.trim().toUpperCase()
    if (normalized.length !== 4) {
      setError('Введите код комнаты из четырёх символов.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      await getRoom(normalized)
      navigate(`/player/${normalized}`)
    } catch {
      setError('Комната не найдена или сервер сейчас недоступен.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}><Brand /></header>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Музыка объединяет</p>
          <h1>Karaoke Party</h1>
          <p className={styles.subtitle}>
            Соберите близких, подключите большой экран и устройте музыкальный вечер.
          </p>
          <Button type="primary" size="large" loading={creating} onClick={() => void handleCreate()}>
            Создать игру
          </Button>
        </div>
        <div className={styles.joinPanel}>
          <div className={styles.equalizer} aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <div><p className={styles.panelLabel}>Уже есть код?</p><h2>Присоединиться</h2></div>
          <Form onFinish={() => void handleJoin()} layout="vertical">
            <Form.Item label="Код комнаты" htmlFor="room-code">
              <Input id="room-code" value={roomCode} maxLength={4} autoComplete="off" placeholder="K7PM" size="large"
                onChange={(event) => setRoomCode(event.target.value.replace(/\s/g, '').toUpperCase())} />
            </Form.Item>
            <Button htmlType="submit" size="large" block loading={joining}>Войти в комнату</Button>
          </Form>
          {error && <Alert type="error" showIcon title={error} />}
        </div>
      </section>
    </main>
  )
}
