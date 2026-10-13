import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockInvoke } from './../test-setup'
import { getSystemVoice, prefetch, speak, stopSpeaking, SYSTEM_VOICE } from './voice'

class FakeAudio extends EventTarget {
  static last: FakeAudio | null = null
  constructor(public src: string) { super(); FakeAudio.last = this }
  play() { queueMicrotask(() => this.dispatchEvent(new Event('ended'))); return Promise.resolve() }
  pause() {}
}

beforeEach(() => {
  mockInvoke.mockReset()
  FakeAudio.last = null
  vi.stubGlobal('Audio', FakeAudio)
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('voz neuronal', () => {
  it('pide el audio con las matematicas ya en palabras y espera a que termine', async () => {
    mockInvoke.mockResolvedValue(new ArrayBuffer(8))
    await expect(speak('2x + 3y = 6', 'piper-claude')).resolves.toBe('done')
    expect(mockInvoke).toHaveBeenCalledWith('synthesize_speech', {
      voiceId: 'piper-claude', text: 'dos equis más tres ye igual a seis',
    })
  })

  it('prefetch deja el audio listo y speak lo reutiliza', async () => {
    mockInvoke.mockResolvedValue(new ArrayBuffer(8))
    prefetch('Hola maestra', 'kokoro-dora')
    await speak('Hola maestra', 'kokoro-dora')
    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })

  it('un error del backend se devuelve como failed, sin lanzar', async () => {
    mockInvoke.mockRejectedValue('La voz no esta descargada')
    await expect(speak('Hola', 'kokoro-alex')).resolves.toBe('failed')
  })

  it('stopSpeaking corta la lectura en curso', async () => {
    let release!: (b: ArrayBuffer) => void
    mockInvoke.mockReturnValue(new Promise<ArrayBuffer>(r => { release = r }))
    const p = speak('Texto largo', 'piper-claude')
    stopSpeaking()
    release(new ArrayBuffer(8))
    await expect(p).resolves.toBe('stopped')
  })
})

describe('voz del sistema', () => {
  it('falla sin speechSynthesis', async () => {
    delete (window as any).speechSynthesis
    await expect(speak('Hola', SYSTEM_VOICE)).resolves.toBe('failed')
  })

  it('con espeak-ng en el sistema la voz del sistema se pide al backend (no al navegador)', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => (cmd === 'get_system_voice'
      ? { available: true, engine: 'espeak-ng', os: 'Ubuntu', install_command: null }
      : new ArrayBuffer(8)))
    await getSystemVoice(true)
    await expect(speak('Hola', SYSTEM_VOICE)).resolves.toBe('done')
    expect(mockInvoke).toHaveBeenCalledWith('synthesize_speech', { voiceId: 'system', text: 'Hola' })
  })

  it('sin espeak-ng ni navegador con voz falla sin lanzar', async () => {
    mockInvoke.mockImplementation(async () => ({ available: false, engine: null, os: '', install_command: null }))
    await getSystemVoice(true)
    delete (window as any).speechSynthesis
    await expect(speak('Hola', SYSTEM_VOICE)).resolves.toBe('failed')
  })
})
