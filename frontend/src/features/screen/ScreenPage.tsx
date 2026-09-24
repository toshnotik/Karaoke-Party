import { Button } from 'antd'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import type { ScreenSnapshot } from '../../api/types'
import { useScreenSynchronization } from '../../realtime/useScreenSynchronization'
import { Brand } from '../../shared/components/Brand/Brand'
import { ConnectionStatus } from '../../shared/components/ConnectionStatus/ConnectionStatus'
import { GameScoreboard } from '../../shared/components/GameScoreboard/GameScoreboard'
import { PlayerRoster } from '../../shared/components/PlayerRoster/PlayerRoster'
import { RoomPageState } from '../../shared/components/RoomPageState/RoomPageState'
import { playerJoinUrl } from '../../shared/urls'
import { GuessSongAudioController } from './audioController'
import styles from './ScreenPage.module.scss'

export function ScreenPage() {
  const roomCode = useParams().roomCode?.toUpperCase() ?? ''
  const { screen, loading, error, realtimeStatus } = useScreenSynchronization(roomCode)
  const [unlocked, setUnlocked] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const controllerRef = useRef<GuessSongAudioController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = new GuessSongAudioController(new Audio(), () => {
      setAudioBlocked(true)
      setUnlocked(false)
    })
  }

  const round = screen?.game.currentRound
  const responderId = round?.modeState?.currentResponderId
  useEffect(() => {
    if (!screen || !round) return
    void controllerRef.current?.sync({
      roundId: round.id,
      playback: screen.playback,
      shouldPlay: round.phase === 'active' && responderId === null,
    })
  }, [responderId, round, screen])
  useEffect(() => () => controllerRef.current?.destroy(), [])

  if (loading && screen === null) return <RoomPageState loading screen />
  if (error || screen === null) return <RoomPageState screen message={error ?? undefined} />

  const unlock = () => {
    controllerRef.current?.unlock()
    setUnlocked(true)
    setAudioBlocked(false)
    if (round) {
      void controllerRef.current?.sync({
        roundId: round.id,
        playback: screen.playback,
        shouldPlay: round.phase === 'active' && responderId === null,
      })
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}><Brand /><ConnectionStatus status={realtimeStatus} /></header>
      {!unlocked && <AudioUnlock blocked={audioBlocked} onUnlock={unlock} />}
      {unlocked && <ScreenGameView screen={screen} />}
    </main>
  )
}

function AudioUnlock({ blocked, onUnlock }: { blocked: boolean; onUnlock: () => void }) {
  return (
    <section className={styles.center}>
      <p className={styles.kicker}>Игровой экран</p>
      <h1>{blocked ? 'Не удалось включить звук' : 'Включить игровой экран'}</h1>
      <p>Звук будет воспроизводиться только здесь.</p>
      <Button type="primary" size="large" onClick={onUnlock}>Готов к игре</Button>
    </section>
  )
}

function ScreenGameView({ screen }: { screen: ScreenSnapshot }) {
  const round = screen.game.currentRound
  if (screen.game.status === 'lobby' || screen.game.status === 'ready') return <Lobby screen={screen} />
  if (screen.game.status === 'finished') return <ScoreView title="Игра окончена" screen={screen} />
  if (round?.phase === 'scoreboard') return <ScoreView title="Результаты" screen={screen} />
  if (round?.phase === 'reveal' && round.result?.song) {
    const winner = screen.players.find((player) => player.id === round.result?.winnerPlayerId)
    return (
      <section className={styles.center}>
        <p className={styles.kicker}>Правильный ответ</p>
        <h1 className={styles.songTitle}>{round.result.song.title}</h1>
        <h2>{round.result.song.artist}</h2>
        {round.result.song.year && <p>{round.result.song.year}</p>}
        <strong className={styles.winner}>{winner ? `Угадал: ${winner.name}` : 'Никто не угадал'}</strong>
      </section>
    )
  }
  if (round?.phase === 'active') {
    const responder = screen.players.find((player) => player.id === round.modeState?.currentResponderId)
    if (responder) {
      return <section className={styles.center}><p className={styles.kicker}>Отвечает</p><h1 className={styles.responder}>{responder.name}</h1><p>Назови песню!</p></section>
    }
    return <section className={styles.center}><p className={styles.kicker}>Раунд {round.number} из {screen.game.totalRounds}</p><div className={styles.music} aria-hidden="true"><span /><span /><span /><span /></div><h1>Слушаем...</h1></section>
  }
  return <section className={styles.center}><p className={styles.kicker}>Раунд {round?.number} из {screen.game.totalRounds}</p><h1>Угадай мелодию</h1><p>Приготовьтесь</p></section>
}

function Lobby({ screen }: { screen: ScreenSnapshot }) {
  const joinUrl = playerJoinUrl(screen.roomCode)
  return <><section className={styles.joinArea}><div className={styles.codeBlock}><p>Код комнаты</p><h1>{screen.roomCode}</h1><span>Сканируйте QR-код, чтобы присоединиться</span></div><div className={styles.qr} aria-label={`QR-код для ${joinUrl}`}><QRCodeSVG value={joinUrl} size={240} level="M" marginSize={2} /></div></section><section className={styles.players}><h2>В игре · {screen.players.length}</h2><PlayerRoster players={screen.players} large /></section></>
}

function ScoreView({ title, screen }: { title: string; screen: ScreenSnapshot }) {
  return <section className={styles.center}><p className={styles.kicker}>Угадай мелодию</p><h1>{title}</h1><GameScoreboard players={screen.players} scores={screen.game.scores} /></section>
}
