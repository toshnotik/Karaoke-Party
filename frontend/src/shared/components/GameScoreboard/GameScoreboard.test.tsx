import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { GameScoreboard } from './GameScoreboard'

it('sorts by points and preserves roster order for ties', () => {
  render(<GameScoreboard players={[
    { id: 'a', name: 'Аня', participationType: 'remote' },
    { id: 'b', name: 'Борис', participationType: 'remote' },
    { id: 'c', name: 'Саша', participationType: 'remote' },
  ]} scores={[
    { targetType: 'player', targetId: 'c', points: 100 },
    { targetType: 'player', targetId: 'a', points: 100 },
  ]} />)
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    '1Аня100', '2Саша100', '3Борис0',
  ])
})
