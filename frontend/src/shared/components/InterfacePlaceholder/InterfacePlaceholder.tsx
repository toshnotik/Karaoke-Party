import styles from './InterfacePlaceholder.module.scss'

type InterfacePlaceholderProps = {
  title: string
}

export function InterfacePlaceholder({ title }: InterfacePlaceholderProps) {
  return (
    <main className={styles.page}>
      <h1>{title}</h1>
      <p>Karaoke Party</p>
    </main>
  )
}

