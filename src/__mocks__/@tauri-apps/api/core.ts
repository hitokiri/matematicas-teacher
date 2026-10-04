import { vi } from 'vitest'

export const invoke = vi.fn()
export const convertFileSrc = vi.fn((url: string) => url)

export const listen = vi.fn(() => Promise.resolve({ unlisten: vi.fn() }))
export const emit = vi.fn()
