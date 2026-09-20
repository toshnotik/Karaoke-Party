import { describe, expect, it } from 'vitest'

import { playerJoinUrl } from './urls'

describe('playerJoinUrl', () => {
  it('uses the current public origin, including a LAN hostname', () => {
    expect(playerJoinUrl('K7PM', 'http://192.168.1.42:5173')).toBe(
      'http://192.168.1.42:5173/player/K7PM',
    )
  })
})
