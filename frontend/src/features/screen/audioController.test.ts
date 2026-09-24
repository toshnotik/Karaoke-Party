import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GuessSongAudioController } from './audioController'

describe('GuessSongAudioController', () => {
  let audio: HTMLAudioElement
  let controller: GuessSongAudioController

  beforeEach(() => {
    audio = document.createElement('audio')
    vi.spyOn(audio, 'play').mockResolvedValue()
    vi.spyOn(audio, 'pause').mockImplementation(() => {})
    vi.spyOn(audio, 'load').mockImplementation(() => {})
    controller = new GuessSongAudioController(audio, vi.fn())
    controller.unlock()
  })

  it('starts at preview, pauses for buzz, and resumes after wrong', async () => {
    const playback = { mediaUrl: '/api/media/songs/song-1', previewStart: 31, previewDuration: 8 }
    await controller.sync({ roundId: 'round-1', playback, shouldPlay: true })
    expect(audio.currentTime).toBe(31)
    expect(audio.play).toHaveBeenCalledTimes(1)

    audio.currentTime = 34
    await controller.sync({ roundId: 'round-1', playback, shouldPlay: false })
    expect(audio.pause).toHaveBeenCalled()
    await controller.sync({ roundId: 'round-1', playback, shouldPlay: true })
    expect(audio.currentTime).toBe(34)
    expect(audio.play).toHaveBeenCalledTimes(2)
  })

  it('stops at duration, reveal, and resets on round change', async () => {
    const playback = { mediaUrl: '/api/media/songs/song-1', previewStart: 10, previewDuration: 5 }
    await controller.sync({ roundId: 'round-1', playback, shouldPlay: true })
    audio.currentTime = 15
    audio.dispatchEvent(new Event('timeupdate'))
    expect(audio.pause).toHaveBeenCalled()

    await controller.sync({ roundId: 'round-1', playback: null, shouldPlay: false })
    await controller.sync({
      roundId: 'round-2',
      playback: { ...playback, mediaUrl: '/api/media/songs/song-2', previewStart: 20 },
      shouldPlay: true,
    })
    expect(audio.currentTime).toBe(20)
  })
})
