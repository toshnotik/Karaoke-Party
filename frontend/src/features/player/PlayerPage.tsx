import { Alert, Button, Form, Input } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { joinRoom } from '../../api/rooms'
import type { JoinRoomResponse } from '../../api/types'
import { useRoomSynchronization } from '../../realtime/useRoomSynchronization'
import { Brand } from '../../shared/components/Brand/Brand'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus/ConnectionStatus'
import { PlayerRoster } from '../../shared/components/PlayerRoster/PlayerRoster'
import { RoomPageState } from '../../shared/components/RoomPageState/RoomPageState'
import {
  clearPlayerCredentials,
  getPlayerCredentials,
  savePlayerCredentials,
  type PlayerCredentials,
} from '../../shared/storage/roomTokens'
import { useRoomStore } from '../../stores/roomStore'
import styles from './PlayerPage.module.scss'
import { PlayerGamePanel } from './PlayerGamePanel'

export function PlayerPage() {
  const roomCode = useParams().roomCode?.toUpperCase() ?? ''
  const { room, loading, error, realtimeStatus, setRoom } = useRoomStore()
  const [credentials, setCredentials] = useState<PlayerCredentials | null>(() =>
    getPlayerCredentials(roomCode),
  )
  const [checkingToken, setCheckingToken] = useState(credentials !== null)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const reconnectRequest = useRef<Promise<JoinRoomResponse> | null>(null)
  useRoomSynchronization(roomCode, roomCode.length > 0)

  useEffect(() => {
    if (credentials === null) {
      return
    }

    reconnectRequest.current ??= joinRoom(
      roomCode,
      credentials.name,
      credentials.token,
    )
    let active = true
    void reconnectRequest.current
      .then((response) => {
        if (active) {
          const refreshed = {
            token: response.playerToken,
            name: response.player.name,
            playerId: response.player.id,
          }
          if (
            credentials.playerId !== refreshed.playerId ||
            credentials.name !== refreshed.name ||
            credentials.token !== refreshed.token
          ) {
            savePlayerCredentials(roomCode, refreshed)
            setCredentials(refreshed)
          }
          setRoom(response.room)
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearPlayerCredentials(roomCode)
          setCredentials(null)
          setJoinError('Сохранённый вход устарел. Введите имя ещё раз.')
        } else {
          setJoinError('Не удалось восстановить подключение к комнате.')
        }
      })
      .finally(() => {
        if (active) setCheckingToken(false)
      })

    return () => {
      active = false
    }
  }, [credentials, roomCode, setRoom])

  const handleJoin = async () => {
    const normalizedName = name.trim()
    if (normalizedName.length < 1 || normalizedName.length > 40) {
      setJoinError('Имя должно содержать от 1 до 40 символов.')
      return
    }
    setJoining(true)
    setJoinError(null)
    try {
      const response = await joinRoom(roomCode, normalizedName)
      const nextCredentials = {
        token: response.playerToken,
        name: response.player.name,
        playerId: response.player.id,
      }
      reconnectRequest.current = Promise.resolve(response)
      savePlayerCredentials(roomCode, nextCredentials)
      setCredentials(nextCredentials)
      setRoom(response.room)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 422) {
        setJoinError('Проверьте имя: допустимо от 1 до 40 символов.')
      } else if (requestError instanceof ApiError && requestError.status === 409) {
        setJoinError('Игра уже началась. Новые игроки смогут войти в следующую игру.')
      } else {
        setJoinError('Не удалось присоединиться. Проверьте комнату и соединение.')
      }
    } finally {
      setJoining(false)
    }
  }

  if ((loading && room === null) || checkingToken) {
    return <RoomPageState loading />
  }
  if (error && room === null) return <RoomPageState message={error.message} />

  if (credentials === null) {
    return (
      <main className={styles.joinPage}>
        <div className={styles.joinShell}>
          <Brand />
          <section className={styles.joinPanel}>
            <p className={styles.kicker}>Комната {roomCode}</p>
            <h1>Как вас зовут?</h1>
            <p>Это имя увидят ведущий и другие игроки.</p>
            <Form layout="vertical" onFinish={() => void handleJoin()}>
              <Form.Item label="Имя игрока" htmlFor="player-name">
                <Input id="player-name" value={name} maxLength={40} autoFocus size="large" placeholder="Например, Маша"
                  onChange={(event) => setName(event.target.value)} />
              </Form.Item>
              <Button type="primary" size="large" block htmlType="submit" loading={joining}>
                Присоединиться
              </Button>
            </Form>
            {joinError && <Alert type="error" showIcon title={joinError} />}
            <Link to="/">Ввести другой код</Link>
          </section>
        </div>
      </main>
    )
  }

  const currentPlayer = room?.players.find(
    (player) => player.id === credentials.playerId,
  )

  if (room?.game.mode === 'guess_song' && room.game.status !== 'lobby') {
    return (
      <main className={styles.lobbyPage}>
        <header className={styles.header}>
          <Brand compact />
          <ConnectionStatus status={realtimeStatus} />
        </header>
        <PlayerGamePanel
          room={room}
          playerId={credentials.playerId}
          playerToken={credentials.token}
          realtimeStatus={realtimeStatus}
        />
      </main>
    )
  }

  return (
    <main className={styles.lobbyPage}>
      <header className={styles.header}>
        <Brand compact />
        <ConnectionStatus status={realtimeStatus} />
      </header>
      <section className={styles.welcome}>
        <p className={styles.kicker}>Вы в комнате {roomCode}</p>
        <h1>Привет, {currentPlayer?.name ?? credentials.name}</h1>
        <p>Ожидаем начала игры</p>
        <div className={styles.waiting} aria-hidden="true"><span /><span /><span /></div>
      </section>
      <section className={styles.participants}>
        <h2>Участники · {room?.players.length ?? 0}</h2>
        <PlayerRoster players={room?.players ?? []} />
      </section>
    </main>
  )
}
