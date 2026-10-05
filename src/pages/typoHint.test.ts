import { it, expect } from 'vitest'
import { typoHint } from './MainApp'

it('avisa de dos signos seguidos en vez de adivinar', () => {
  expect(typoHint('1/2+1/4+*10')).toContain('"+*"')
  expect(typoHint('3 × ÷ 2')).toContain('"×÷"')
  // un signo menos despues de otro signo es un numero negativo, no un error
  expect(typoHint('3 × -2')).toBeNull()
  expect(typoHint('2x + 3 = 7')).toBeNull()
  expect(typoHint('1/2 + 1/4')).toBeNull()
})
