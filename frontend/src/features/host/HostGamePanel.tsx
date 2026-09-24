import { Alert, Button } from 'antd'
import { useState } from 'react'

import {
  activateRound,
  configureGame,
  finishRound,
  judgeRound,
  revealRound,
  showScoreboard,
  startGame,
} from '../../api/game'
import type { RoomSnapshot } from '../../api/types'
import { GameScoreboard } from '../../shared/components/GameScoreboard/GameScoreboard'
import styles from './HostGamePanel.module.scss'

type HostGamePanelProps = {
  room: RoomSnapshot
  hostToken: string
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

function availableCommands(room: RoomSnapshot): CommandName[] {
  if (room.game.status === 'lobby') return ['configure-guess-song']
  if (room.game.status === 'ready') return ['start']
  if (room.game.status !== 'playing') return []
  switch (room.game.currentRound?.phase) {
    case 'intro': return ['activate']
    case 'active':
      return room.game.currentRound.modeState?.currentResponderId
        ? ['judge-correct', 'judge-wrong']
        : ['reveal']
    case 'reveal': return ['scoreboard']
    case 'scoreboard': return ['finish']
    default: return []
  }
}

export function HostGamePanel({ room, hostToken }: HostGamePanelProps) {
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
      setError(
        commandError instanceof Error ? commandError.message : 'Command failed',
      )
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
            disabled={running !== null}
            loading={running === command.name}
            onClick={() => void execute(command)}
          >
            {command.label}
          </Button>
        ))}
      </div>
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
