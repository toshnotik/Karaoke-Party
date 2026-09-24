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
import { GuessSongAudioController, type AudioStatus } from './audioController'
import styles from './ScreenPage.module.scss'

export function ScreenPage() {
  const roomCode = useParams().roomCode?.toUpperCase() ?? ''
  const { screen, loading, error, realtimeStatus, continueAudioRequest } = useScreenSynchronization(roomCode)
  const [unlocked, setUnlocked] = useState(false)
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle')
  const controllerRef = useRef<GuessSongAudioController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = new GuessSongAudioController(new Audio(), setAudioStatus)
  }

  const round = screen?.game.currentRound
  const responderId = round?.modeState?.currentResponderId
  useEffect(() => {
    if (!screen || !round) return
    void controllerRef.current?.sync({
      roundId: round.id,
      playback: screen.playback,
      responderPending: responderId !== null,
    })
  }, [responderId, round, screen])
  useEffect(() => {
    if (continueAudioRequest > 0) {
      void controllerRef.current?.continueSegment()
    }
  }, [continueAudioRequest])
  useEffect(() => () => controllerRef.current?.destroy(), [])

  if (loading && screen === null) return <RoomPageState loading screen />
  if (error || screen === null) return <RoomPageState screen message={error ?? undefined} />

  const unlock = () => {
    controllerRef.current?.unlock()
    setUnlocked(true)
    setAudioStatus('idle')
    if (round) {
      void controllerRef.current?.sync({
        roundId: round.id,
        playback: screen.playback,
        responderPending: responderId !== null,
      })
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}><Brand /><ConnectionStatus status={realtimeStatus} /></header>
      {!unlocked && <AudioUnlock onUnlock={unlock} />}
      {unlocked && <ScreenGameView screen={screen} audioStatus={audioStatus} onRetry={() => void controllerRef.current?.retry()} />}
    </main>
  )
}

function AudioUnlock({ onUnlock }: { onUnlock: () => void }) {
  return (
    <section className={styles.center}>
      <p className={styles.kicker}>Игровой экран</p>
      <h1>Включить игровой экран</h1>
      <p>Звук будет воспроизводиться только здесь.</p>
      <Button type="primary" size="large" onClick={onUnlock}>Готов к игре</Button>
    </section>
  )
}

function ScreenGameView({ screen, audioStatus, onRetry }: { screen: ScreenSnapshot; audioStatus: AudioStatus; onRetry: () => void }) {
  const round = screen.game.currentRound
  if (screen.game.status === 'lobby' || screen.game.status === 'ready') return <Lobby screen={screen} />
  if (screen.game.status === 'finished') return <FinalResults screen={screen} />
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
    if (audioStatus === 'error') {
      return <section className={styles.center}><p className={styles.kicker}>Проблема со звуком</p><h1>Не удалось воспроизвести аудио</h1><Button type="primary" size="large" onClick={onRetry}>Повторить</Button></section>
    }
    if (audioStatus === 'missing') {
      return <section className={styles.center}><p className={styles.kicker}>Проблема со звуком</p><h1>Не найден аудиофайл для этой песни</h1><p>Ведущий может показать ответ и продолжить игру</p></section>
    }
    if (audioStatus === 'exhausted') {
      return <section className={styles.center}><p className={styles.kicker}>Раунд продолжается</p><h1>Аудиозапись закончилась</h1><p>Игроки всё ещё могут отвечать</p></section>
    }
    if (audioStatus === 'fragment-ended') {
      return <section className={styles.center}><p className={styles.kicker}>Раунд продолжается</p><h1>Фрагмент закончился</h1><p>Игроки всё ещё могут нажать «ЗНАЮ!»</p></section>
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

function FinalResults({ screen }: { screen: ScreenSnapshot }) {
  const points = new Map(
    screen.game.scores
      .filter((score) => score.targetType === 'player')
      .map((score) => [score.targetId, score.points]),
  )
  const highestScore = Math.max(0, ...screen.players.map((player) => points.get(player.id) ?? 0))
  const leaders = screen.players.filter((player) => (points.get(player.id) ?? 0) === highestScore)
  return (
    <section className={styles.center}>
      <p className={styles.kicker}>Финальные результаты</p>
      <h1>Игра окончена</h1>
      {leaders.length === 1 ? (
        <p className={styles.winner}>Победитель: {leaders[0].name} · {highestScore}</p>
      ) : (
        <p className={styles.winner}>Лидеры: {leaders.map((leader) => leader.name).join(', ')} · {highestScore}</p>
      )}
      <GameScoreboard players={screen.players} scores={screen.game.scores} />
    </section>
  )
}
