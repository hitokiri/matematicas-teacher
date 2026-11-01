import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import PracticeBoard from './PracticeBoard'
import { mockInvoke, mockListen } from '../test-setup'
import { parseEquation } from '../lib/board/equation'
import { speak } from '../lib/voice'

vi.mock('../lib/voice', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/voice')>()),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
}))

const eq = parseEquation('2x + 4 = 10')!

const say = (text: string) => {
  const calls = vi.mocked(mockListen).mock.calls as unknown as Array<[string, (e: any) => void]>
  const entry = calls.find(([event]) => event === 'mic-transcript')
  act(() => entry?.[1]({ payload: { text } }))
}

describe('PracticeBoard', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockInvoke.mockResolvedValue([])
    vi.mocked(mockListen).mockClear()
    vi.mocked(speak).mockReset()
    vi.mocked(speak).mockResolvedValue('done')
  })

  it('la operación dictada escribe un paso en la pizarra', () => {
    render(<PracticeBoard equation={eq} readAloud={false} />)
    say('restar 4')
    expect(screen.getByText('2x + 4 − 4 = 10 − 4')).toBeInTheDocument()
  })

  it('si no se entiende, la maestra pregunta y no ejecuta nada', () => {
    render(<PracticeBoard equation={eq} readAloud={false} />)
    say('¿qué hacemos ahora?')
    expect(screen.getByText(/No entendí la operación/)).toBeInTheDocument()
    expect(screen.queryByText('2x + 4 − 4 = 10 − 4')).not.toBeInTheDocument()
  })

  it('no se puede dividir entre 0', () => {
    render(<PracticeBoard equation={eq} readAloud={false} />)
    say('dividir entre 0')
    expect(screen.getByText(/No se puede dividir entre 0/)).toBeInTheDocument()
  })

  it('si el dictado es un problema que la app resuelve sola, va a la pizarra y no pregunta', () => {
    const onUnknown = vi.fn(() => true)
    render(<PracticeBoard equation={eq} readAloud={false} onUnknown={onUnknown} />)
    say('2x + 4 = 10')
    expect(onUnknown).toHaveBeenCalledWith('2x + 4 = 10')
    expect(screen.queryByText(/No entendí la operación/)).not.toBeInTheDocument()
  })

  it('la maestra confirma en voz alta y la pizarra avanza al resultado', async () => {
    render(<PracticeBoard equation={eq} voiceId="piper-es" readAloud />)
    say('restar 4')
    await waitFor(() => expect(screen.getByText('2x = 6')).toBeInTheDocument())
    say('dividir entre 2')
    await waitFor(() => expect(screen.getByText('x = 3')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/Encontramos el peso de la bolsa/)).toBeInTheDocument())
  })
})
