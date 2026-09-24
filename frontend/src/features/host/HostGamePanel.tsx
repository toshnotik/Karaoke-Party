import { Alert, Button } from 'antd'
import { useState } from 'react'

import {
  activateRound,
  continueScreenAudio,
  configureGame,
  finishRound,
  judgeRound,
  revealRound,
  showScoreboard,
  startGame,
} from '../../api/game'
import { ApiError } from '../../api/client'
import type { RoomSnapshot } from '../../api/types'
import type { RealtimeStatus } from '../../stores/roomStore'
import { GameScoreboard } from '../../shared/components/GameScoreboard/GameScoreboard'
import styles from './HostGamePanel.module.scss'

type HostGamePanelProps = {
  room: RoomSnapshot
  hostToken: string
  realtimeStatus: RealtimeStatus
}

type CommandName =
  | 'configure-guess-song'
  | 'start'
  | 'activate'
  | 'reveal'
  | 'scoreboard'
  | 'finish'
  | 'judge-correct'
  | 'judge-wrong'
  | 'continue-audio'

function availableCommands(room: RoomSnapshot): CommandName[] {
  if (room.game.status === 'lobby') return ['configure-guess-song']
  if (room.game.status === 'ready') return ['start']
  if (room.game.status !== 'playing') return []
  switch (room.game.currentRound?.phase) {
    case 'intro': return ['activate']
    case 'active':
      return room.game.currentRound.modeState?.currentResponderId
        ? ['judge-correct', 'judge-wrong']
        : ['continue-audio', 'reveal']
    case 'reveal': return ['scoreboard']
    case 'scoreboard': return ['finish']
    default: return []
  }
}

export function HostGamePanel({ room, hostToken, realtimeStatus }: HostGamePanelProps) {
  const [running, setRunning] = useState<CommandName | null>(null)
  const [error, setError] = useState<string | null>(null)
  const available = availableCommands(room)
  const round = room.game.currentRound
  const responder = room.players.find(
    (player) => player.id === round?.modeState?.currentResponderId,
  )
  const winner = room.players.find(
    (player) => player.id === round?.result?.winnerPlayerId,
  )
  const commands: Array<{
    name: CommandName
    label: string
    run: () => Promise<unknown>
  }> = [
    {
      name: 'continue-audio',
      label: 'Продолжить фрагмент',
      run: () => continueScreenAudio(room.roomCode, hostToken),
    },
    {
      name: 'configure-guess-song',
      label: 'Угадай мелодию',
      run: () => configureGame(room.roomCode, hostToken, 'guess_song'),
    },
    {
      name: 'start',
      label: 'Начать игру',
      run: () => startGame(room.roomCode, hostToken),
    },
    {
      name: 'activate',
      label: 'Запустить фрагмент',
      run: () => activateRound(room.roomCode, hostToken),
    },
    {
      name: 'judge-correct',
      label: 'Верно',
      run: () => judgeRound(room.roomCode, hostToken, true),
    },
    {
      name: 'judge-wrong',
      label: 'Неверно',
      run: () => judgeRound(room.roomCode, hostToken, false),
    },
    {
      name: 'reveal',
      label: 'Показать ответ',
      run: () => revealRound(room.roomCode, hostToken),
    },
    {
      name: 'scoreboard',
      label: 'Показать результаты',
      run: () => showScoreboard(room.roomCode, hostToken),
    },
    {
      name: 'finish',
      label: room.game.roundNumber === room.game.totalRounds ? 'Завершить игру' : 'Следующий раунд',
      run: () => finishRound(room.roomCode, hostToken),
    },
  ]

  const execute = async (command: (typeof commands)[number]) => {
    setRunning(command.name)
    setError(null)
    try {
      await command.run()
    } catch (commandError) {
      setError(commandErrorMessage(command.name, commandError))
    } finally {
      setRunning(null)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="game-panel-title">
      <div>
        <p>Угадай мелодию · Раунд {room.game.roundNumber || '—'}</p>
        <h2 id="game-panel-title">
          {responder ? `Отвечает ${responder.name}` : panelTitle(room)}
        </h2>
      </div>
      <div className={styles.commands}>
        {commands.filter((command) => available.includes(command.name)).map((command) => (
          <Button
            key={command.name}
            disabled={running !== null || realtimeStatus !== 'connected' || (command.name === 'start' && room.players.length === 0)}
            loading={running === command.name}
            onClick={() => void execute(command)}
          >
            {command.label}
          </Button>
        ))}
      </div>
      {room.game.status === 'ready' && room.players.length === 0 && (
        <Alert type="warning" showIcon title="Для начала игры нужен хотя бы один игрок" />
      )}
      {round?.phase === 'reveal' && round.result?.song && (
        <div className={styles.reveal}>
          <strong>{round.result.song.title}</strong>
          <span>{round.result.song.artist}{round.result.song.year ? ` · ${round.result.song.year}` : ''}</span>
          <span>{winner ? `Угадал: ${winner.name}` : 'Никто не угадал'}</span>
        </div>
      )}
      {room.game.status !== 'lobby' && (
        <GameScoreboard players={room.players} scores={room.game.scores} compact />
      )}
      {error && <Alert type="error" showIcon title={error} />}
    </section>
  )
}

function commandErrorMessage(command: CommandName, error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Нет доступа к управлению этой комнатой.'
  }
  if (command === 'start') {
    return 'Не удалось начать игру. Проверьте, что подключён хотя бы один игрок.'
  }
  if (command === 'continue-audio') {
    return 'Сначала дождитесь активного раунда или оцените ответ игрока.'
  }
  return 'Не удалось выполнить действие. Проверьте соединение и текущее состояние игры.'
}

function panelTitle(room: RoomSnapshot): string {
  if (room.game.status === 'lobby') return 'Выберите игру'
  if (room.game.status === 'ready') return 'Комната готова'
  if (room.game.status === 'finished') return 'Игра окончена'
  switch (room.game.currentRound?.phase) {
    case 'intro': return 'Раунд готов'
    case 'active': return 'Игроки слушают...'
    case 'reveal': return room.game.currentRound.result?.song?.title ?? 'Ответ открыт'
    case 'scoreboard': return 'Текущие результаты'
    default: return 'Управление игрой'
  }
}
