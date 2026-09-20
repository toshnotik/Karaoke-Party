import type { PublicPlayer } from '../../../api/types'
import styles from './PlayerRoster.module.scss'

export function PlayerRoster({
  players,
  large = false,
}: {
  players: PublicPlayer[]
  large?: boolean
}) {
  if (players.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">+</span>
        Первый игрок появится здесь
      </div>
    )
  }

  return (
    <ul className={`${styles.list} ${large ? styles.large : ''}`}>
      {players.map((player, index) => (
        <li key={player.id}>
          <span className={styles.avatar} aria-hidden="true">{index + 1}</span>
          <span>{player.name}</span>
        </li>
      ))}
    </ul>
  )
}
