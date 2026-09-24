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
import styles from './HostGamePanel.module.scss'

type HostGamePanelProps = {
  room: RoomSnapshot
  hostToken: string
}

type CommandName =
  | 'configure-dummy'
  | 'configure-guess-song'
  | 'start'
  | 'activate'
  | 'reveal'
  | 'scoreboard'
  | 'finish'
  | 'judge-correct'
  | 'judge-wrong'

function availableCommands(room: RoomSnapshot): CommandName[] {
  if (room.game.status === 'lobby') {
    return ['configure-dummy', 'configure-guess-song']
  }
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
  const commands: Array<{
    name: CommandName
    label: string
    run: () => Promise<unknown>
  }> = [
    {
      name: 'configure-dummy',
      label: 'Configure Dummy Game',
      run: () => configureGame(room.roomCode, hostToken, 'dummy'),
    },
    {
      name: 'configure-guess-song',
      label: 'Configure Guess Song',
      run: () => configureGame(room.roomCode, hostToken, 'guess_song'),
    },
    {
      name: 'start',
      label: 'Start Game',
      run: () => startGame(room.roomCode, hostToken),
    },
    {
      name: 'activate',
      label: 'Activate Round',
      run: () => activateRound(room.roomCode, hostToken),
    },
    {
      name: 'judge-correct',
      label: 'Judge Correct',
      run: () => judgeRound(room.roomCode, hostToken, true),
    },
    {
      name: 'judge-wrong',
      label: 'Judge Wrong',
      run: () => judgeRound(room.roomCode, hostToken, false),
    },
    {
      name: 'reveal',
      label: 'Reveal',
      run: () => revealRound(room.roomCode, hostToken),
    },
    {
      name: 'scoreboard',
      label: 'Show Scoreboard',
      run: () => showScoreboard(room.roomCode, hostToken),
    },
    {
      name: 'finish',
      label: 'Finish Round',
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
        <p>Development integration</p>
        <h2 id="game-panel-title">Game Controls</h2>
      </div>
      <div className={styles.commands}>
        {commands.map((command) => (
          <Button
            key={command.name}
            disabled={!available.includes(command.name) || running !== null}
            loading={running === command.name}
            onClick={() => void execute(command)}
          >
            {command.label}
          </Button>
        ))}
      </div>
      {error && <Alert type="error" showIcon title={error} />}
    </section>
  )
}
