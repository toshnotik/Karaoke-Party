import type { PublicPlayer, PublicScore } from '../../../api/types'
import styles from './GameScoreboard.module.scss'

type GameScoreboardProps = {
  players: PublicPlayer[]
  scores: PublicScore[]
  compact?: boolean
}

export function GameScoreboard({ players, scores, compact = false }: GameScoreboardProps) {
  const points = new Map(
    scores
      .filter((score) => score.targetType === 'player')
      .map((score) => [score.targetId, score.points]),
  )
  const ranked = players
    .map((player, rosterIndex) => ({ player, rosterIndex, points: points.get(player.id) ?? 0 }))
    .sort((left, right) => right.points - left.points || left.rosterIndex - right.rosterIndex)

  return (
    <ol className={`${styles.scoreboard} ${compact ? styles.compact : ''}`}>
      {ranked.map(({ player, points: playerPoints }, index) => (
        <li key={player.id}>
          <span className={styles.rank}>{index + 1}</span>
          <strong>{player.name}</strong>
          <span>{playerPoints}</span>
        </li>
      ))}
    </ol>
  )
}
