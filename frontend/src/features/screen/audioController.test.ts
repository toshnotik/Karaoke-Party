import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GuessSongAudioController, type AudioStatus } from './audioController'

describe('GuessSongAudioController', () => {
  let audio: HTMLAudioElement
  let controller: GuessSongAudioController
  let statusChanged: Mock<(status: AudioStatus) => void>

  beforeEach(() => {
    audio = document.createElement('audio')
    vi.spyOn(audio, 'play').mockResolvedValue()
    vi.spyOn(audio, 'pause').mockImplementation(() => {})
    vi.spyOn(audio, 'load').mockImplementation(() => {})
    statusChanged = vi.fn<(status: AudioStatus) => void>()
    controller = new GuessSongAudioController(audio, statusChanged)
    controller.unlock()
  })

  it('starts at preview, pauses for buzz, and waits for explicit continue after wrong', async () => {
    const playback = { mediaUrl: '/api/media/songs/song-1', previewStart: 31, previewDuration: 8 }
    await controller.sync({ roundId: 'round-1', playback, responderPending: false })
    expect(audio.currentTime).toBe(31)
    expect(audio.play).toHaveBeenCalledTimes(1)

    audio.currentTime = 34
    await controller.sync({ roundId: 'round-1', playback, responderPending: true })
    expect(audio.pause).toHaveBeenCalled()
    expect(statusChanged).toHaveBeenLastCalledWith('fragment-ended')
    await controller.sync({ roundId: 'round-1', playback, responderPending: false })
    expect(audio.currentTime).toBe(34)
    expect(audio.play).toHaveBeenCalledTimes(1)
    await controller.continueSegment()
    expect(audio.play).toHaveBeenCalledTimes(2)
  })

  it('stops at duration, reveal, and resets on round change', async () => {
    const playback = { mediaUrl: '/api/media/songs/song-1', previewStart: 10, previewDuration: 5 }
    await controller.sync({ roundId: 'round-1', playback, responderPending: false })
    audio.currentTime = 15
    audio.dispatchEvent(new Event('timeupdate'))
    expect(audio.pause).toHaveBeenCalled()

    await controller.sync({ roundId: 'round-1', playback: null, responderPending: false })
    await controller.sync({
      roundId: 'round-2',
      playback: { ...playback, mediaUrl: '/api/media/songs/song-2', previewStart: 20 },
      responderPending: false,
    })
    expect(audio.currentTime).toBe(20)
  })

  it('continues from the current position for one more preview duration', async () => {
    const playback = { mediaUrl: '/api/media/songs/song-1', previewStart: 31, previewDuration: 8 }
    await controller.sync({ roundId: 'round-1', playback, responderPending: false })
    audio.currentTime = 39
    audio.dispatchEvent(new Event('timeupdate'))
    expect(statusChanged).toHaveBeenLastCalledWith('fragment-ended')

    await controller.continueSegment()
    audio.currentTime = 46
    audio.dispatchEvent(new Event('timeupdate'))
    expect(audio.play).toHaveBeenCalledTimes(2)
    audio.currentTime = 47
    audio.dispatchEvent(new Event('timeupdate'))
    expect(statusChanged).toHaveBeenLastCalledWith('fragment-ended')
  })

  it('reports missing media without exposing a path', async () => {
    Object.defineProperty(audio, 'error', { value: { code: 4 }, configurable: true })
    audio.dispatchEvent(new Event('error'))
    expect(statusChanged).toHaveBeenLastCalledWith('missing')
  })
})
