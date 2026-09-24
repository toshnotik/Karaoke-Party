import { apiBaseUrl } from '../../api/client'
import type { ScreenPlayback } from '../../api/types'

type PlaybackState = {
  roundId: string
  playback: ScreenPlayback | null
  shouldPlay: boolean
}

export class GuessSongAudioController {
  private unlocked = false
  private roundId: string | null = null
  private endAt = 0

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly onBlocked: () => void,
  ) {
    audio.addEventListener('timeupdate', this.stopAtBoundary)
    audio.addEventListener('error', this.onBlocked)
  }

  unlock(): void {
    this.unlocked = true
  }

  async sync({ roundId, playback, shouldPlay }: PlaybackState): Promise<void> {
    if (this.roundId !== roundId) {
      this.audio.pause()
      this.roundId = roundId
      this.audio.removeAttribute('src')
      this.audio.load()
    }
    if (playback === null) {
      this.audio.pause()
      return
    }

    const source = `${apiBaseUrl}${playback.mediaUrl}`
    if (this.audio.src !== source) {
      this.audio.src = source
      this.audio.currentTime = playback.previewStart
    }
    this.endAt = playback.previewStart + playback.previewDuration
    if (!shouldPlay || this.audio.currentTime >= this.endAt) {
      this.audio.pause()
      return
    }
    if (!this.unlocked) return
    try {
      await this.audio.play()
    } catch {
      this.onBlocked()
    }
  }

  destroy(): void {
    this.audio.pause()
    this.audio.removeEventListener('timeupdate', this.stopAtBoundary)
    this.audio.removeEventListener('error', this.onBlocked)
    this.audio.removeAttribute('src')
  }

  private readonly stopAtBoundary = () => {
    if (this.endAt > 0 && this.audio.currentTime >= this.endAt) {
      this.audio.pause()
    }
  }
}
