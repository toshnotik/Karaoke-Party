import { Alert } from 'antd'
import { useState } from 'react'

import { ApiError } from '../../api/client'
import { submitPlayerAction } from '../../api/game'
import type { RoomSnapshot } from '../../api/types'
import { GameScoreboard } from '../../shared/components/GameScoreboard/GameScoreboard'
import styles from './PlayerGamePanel.module.scss'

type PlayerGamePanelProps = {
  room: RoomSnapshot
  playerId: string
  playerToken: string
}

export function PlayerGamePanel({ room, playerId, playerToken }: PlayerGamePanelProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const round = room.game.currentRound
  const responderId = round?.modeState?.currentResponderId
  const responder = room.players.find((player) => player.id === responderId)
  const excluded = round?.modeState?.excludedPlayerIds.includes(playerId) ?? false
  const ownScore = room.game.scores.find(
    (score) => score.targetType === 'player' && score.targetId === playerId,
  )?.points ?? 0

  const buzz = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await submitPlayerAction(room.roomCode, playerToken, 'buzz')
    } catch (requestError) {
      if (!(requestError instanceof ApiError && requestError.status === 409)) {
        setError('Не удалось отправить сигнал. Проверьте соединение.')
      }
    } finally {
      setPending(false)
    }
  }

  if (room.game.status === 'finished') {
    return <GameState title="Игра окончена" score={ownScore}><GameScoreboard players={room.players} scores={room.game.scores} /></GameState>
  }
  if (round?.phase === 'scoreboard') {
    return <GameState title="Результаты" score={ownScore}><GameScoreboard players={room.players} scores={room.game.scores} /></GameState>
  }
  if (round?.phase === 'reveal' && round.result?.song) {
    return (
      <GameState title={round.result.song.title} score={ownScore}>
        <p className={styles.artist}>{round.result.song.artist}</p>
        {round.result.song.year && <p>{round.result.song.year}</p>}
        <p>{round.result.winnerPlayerId === playerId ? 'Вы угадали!' : 'Раунд завершён'}</p>
      </GameState>
    )
  }
  if (round?.phase === 'active') {
    if (responderId === playerId) {
      return <GameState title="Вы отвечаете" score={ownScore}><p>Назовите песню вслух</p></GameState>
    }
    if (responder) {
      return <GameState title={`Отвечает ${responder.name}`} score={ownScore}><p>Ждём решение ведущего</p></GameState>
    }
    if (excluded) {
      return <GameState title="Вы уже отвечали" score={ownScore}><p>Ждём остальных игроков</p></GameState>
    }
    return (
      <GameState title={`Раунд ${round.number}`} score={ownScore}>
        <button className={styles.buzz} disabled={pending} onClick={() => void buzz()}>
          {pending ? 'ПРОВЕРЯЕМ...' : 'ЗНАЮ!'}
        </button>
        {error && <Alert type="error" showIcon title={error} />}
      </GameState>
    )
  }
  return <GameState title={`Раунд ${round?.number ?? room.game.roundNumber}`} score={ownScore}><p>Приготовьтесь</p></GameState>
}

function GameState({ title, score, children }: { title: string; score: number; children: React.ReactNode }) {
  return (
    <section className={styles.game}>
      <span className={styles.score}>Ваш счёт · {score}</span>
      <h1>{title}</h1>
      {children}
    </section>
  )
}
