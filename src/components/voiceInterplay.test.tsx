import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Chalkboard from './Chalkboard'
import StepChat from './StepChat'
import { mockInvoke } from '../test-setup'
import { multiplicationScript } from '../lib/board/arithmetic'

// Aqui NO se simula voice.ts: se usa el canal de audio real (un solo audio a la vez) para probar que
// la pizarra y el chat no se estorban.
class SilentAudio extends EventTarget {
  constructor(public src: string) { super() }
  play() { return new Promise<void>(() => {}) } // suena "para siempre"
  pause() {}
}

beforeEach(() => {
  mockInvoke.mockReset()
  mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'synthesize_speech' ? new ArrayBuffer(8) : undefined))
  vi.stubGlobal('Audio', SilentAudio)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('la pizarra y el chat juntos', () => {
  it('al resolver, el chat que aparece junto a la pizarra NO la pausa (regresion: no arrancaba hasta pulsar Reproducir)', async () => {
    const script = multiplicationScript('10', '20')
    // Con y sin StrictMode (el modo desarrollo de React ejecuta cada efecto dos veces)
    for (const [readAloud, strict] of [[true, false], [false, false], [true, true], [false, true]] as const) {
      const Wrap = strict ? StrictMode : ({ children }: { children: React.ReactNode }) => <>{children}</>
      const { unmount } = render(
        <Wrap>
          <Chalkboard script={script} readAloud={readAloud} voiceId="piper-claude" />
          <StepChat script={script} currentStep={0} readAloud={readAloud} voiceId="piper-claude" />
        </Wrap>,
      )
      await waitFor(() => expect(mockInvoke.mock.calls.length >= 0).toBe(true))
      await new Promise(r => setTimeout(r, 50))
      expect(screen.getByRole('button', { name: /pausa/i })).toBeInTheDocument()
      unmount()
    }
  })
})
