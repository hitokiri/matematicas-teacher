import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock @tauri-apps/api/core BEFORE any imports
const mockInvoke = vi.fn()
const mockListen = vi.fn(() => ({ unlisten: vi.fn() }))
const mockEmit = vi.fn()
const mockConvertFileSrc = vi.fn((url: string) => url)

vi.mock('@tauri-apps/api/core', async () => {
  return {
    invoke: mockInvoke,
    convertFileSrc: mockConvertFileSrc,
  }
})

vi.mock('@tauri-apps/api/event', async () => {
  return {
    listen: mockListen,
    emit: mockEmit,
  }
})

// Mock localStorage
const localStorageMock = new Map<string, string>()

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => localStorageMock.get(key) || null),
    setItem: vi.fn((key: string, value: string) => localStorageMock.set(key, value)),
    removeItem: vi.fn((key: string) => localStorageMock.delete(key)),
    clear: vi.fn(() => localStorageMock.clear()),
    get length() { return localStorageMock.size },
    key: vi.fn((index: number) => {
      const keys = Array.from(localStorageMock.keys())
      return keys[index] || null
    }),
  } as unknown as Storage,
  writable: true,
  configurable: true,
})

// Mock window.__TAURI_INTERNALS__ - this is what @tauri-apps/api/core actually calls
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {
    invoke: mockInvoke,
    transformCallback: vi.fn((fn: any) => fn),
    unregisterCallback: vi.fn(),
    convertFileSrc: mockConvertFileSrc,
  },
  writable: true,
  configurable: true,
})

Object.defineProperty(window, '__TAURI__', {
  value: {
    core: { invoke: mockInvoke },
    events: { listen: mockListen, emit: mockEmit },
  },
  writable: true,
  configurable: true,
})

// Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Array(1000000) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => []),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineCap: '',
  lineJoin: '',
  font: '',
  textAlign: '',
  textBaseline: '',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createPattern: vi.fn(),
  createConicGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
})) as any

// Export mock functions for use in tests
export { mockInvoke, mockListen, mockEmit, mockConvertFileSrc }
