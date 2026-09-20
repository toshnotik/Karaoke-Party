import styles from './Brand.module.scss'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.brand} ${compact ? styles.compact : ''}`}>
      <span className={styles.mark} aria-hidden="true">KP</span>
      <span>Karaoke Party</span>
    </div>
  )
}
