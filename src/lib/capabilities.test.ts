import { describe, it, expect } from 'vitest'
import { TOPICS } from './capabilities'
import { boardFor } from '../pages/MainApp'

describe('hasta donde llega la maestra', () => {
  it('los ejemplos de los temas que explica la app los resuelve la app (sin modelo)', () => {
    for (const t of TOPICS.filter(t => t.support === 'app')) {
      for (const ex of t.examples) expect(boardFor(ex), `${t.title}: ${ex}`).not.toBeNull()
    }
  })

  it('los temas del modelo de verdad van al modelo', () => {
    for (const t of TOPICS.filter(t => t.support === 'model')) {
      for (const ex of t.examples) expect(boardFor(ex), `${t.title}: ${ex}`).toBeNull()
    }
  })
})
