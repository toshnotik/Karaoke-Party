import { apiBaseUrl } from '../../api/client'
import type { ScreenPlayback } from '../../api/types'

type PlaybackState = {
  roundId: string
  playback: ScreenPlayback | null
  responderPending: boolean
}

export type AudioStatus = 'idle' | 'playing' | 'fragment-ended' | 'exhausted' | 'missing' | 'error'

export class GuessSongAudioController {
  private unlocked = false
  private roundId: string | null = null
  private playback: ScreenPlayback | null = null
  private endAt = 0
  private started = false

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly onStatusChange: (status: AudioStatus) => void,
  ) {
    audio.addEventListener('timeupdate', this.stopAtBoundary)
    audio.addEventListener('ended', this.handleMediaEnded)
    audio.addEventListener('error', this.handleError)
  }

  unlock(): void {
    this.unlocked = true
  }

  async sync({ roundId, playback, responderPending }: PlaybackState): Promise<void> {
    if (this.roundId !== roundId) {
      this.resetRound(roundId)
    }
    this.playback = playback
    if (playback === null) {
      this.audio.pause()
      this.onStatusChange('idle')
      return
    }

    const source = `${apiBaseUrl}${playback.mediaUrl}`
    if (this.audio.src !== source) {
      this.audio.src = source
      this.audio.currentTime = playback.previewStart
    }
    if (responderPending) {
      this.audio.pause()
      this.onStatusChange('fragment-ended')
      return
    }
    if (!this.started && this.unlocked) {
      this.started = true
      this.endAt = playback.previewStart + playback.previewDuration
      await this.playCurrentSegment()
    }
  }

  async continueSegment(): Promise<void> {
    if (!this.playback || !this.started) return
    const duration = this.audio.duration
    if (Number.isFinite(duration) && this.audio.currentTime >= duration) {
      this.handleMediaEnded()
      return
    }
    this.endAt = this.audio.currentTime + this.playback.previewDuration
    if (Number.isFinite(duration)) {
      this.endAt = Math.min(this.endAt, duration)
    }
    await this.playCurrentSegment()
  }

  async retry(): Promise<void> {
    if (!this.playback) return
    await this.playCurrentSegment()
  }

  destroy(): void {
    this.audio.pause()
    this.audio.removeEventListener('timeupdate', this.stopAtBoundary)
    this.audio.removeEventListener('ended', this.handleMediaEnded)
    this.audio.removeEventListener('error', this.handleError)
    this.audio.removeAttribute('src')
  }

  private resetRound(roundId: string): void {
    this.audio.pause()
    this.roundId = roundId
    this.playback = null
    this.started = false
    this.endAt = 0
    this.audio.removeAttribute('src')
    this.audio.load()
    this.onStatusChange('idle')
  }

  private async playCurrentSegment(): Promise<void> {
    if (!this.unlocked) return
    try {
      await this.audio.play()
      this.onStatusChange('playing')
    } catch {
      this.onStatusChange('error')
    }
  }

  private readonly stopAtBoundary = () => {
    if (this.endAt > 0 && this.audio.currentTime >= this.endAt) {
      this.audio.pause()
      const duration = this.audio.duration
      this.onStatusChange(
        Number.isFinite(duration) && this.audio.currentTime >= duration
          ? 'exhausted'
          : 'fragment-ended',
      )
    }
  }

  private readonly handleMediaEnded = () => {
    this.audio.pause()
    this.onStatusChange('exhausted')
  }

  private readonly handleError = () => {
    this.audio.pause()
    this.onStatusChange(this.audio.error?.code === 4 ? 'missing' : 'error')
  }
}
