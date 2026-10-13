// Registro de la app: lo que ve el usuario en Configuración › Registro. El backend lo guarda en
// memoria y en un archivo; aquí se le mandan los errores que ocurren en la pantalla.

import { invoke } from '@tauri-apps/api/core'

export type LogLevel = 'error' | 'warn' | 'info'

export interface LogEntry {
  time: string
  /** "ERROR", "WARN", "INFO"... */
  level: string
  source: string
  message: string
}

export interface LogSnapshot {
  header: string
  file: string
  entries: LogEntry[]
}

/** Apunta algo en el registro. Nunca lanza: registrar no debe causar otro problema. */
export function logUi(level: LogLevel, source: string, message: unknown): void {
  const text = typeof message === 'string' ? message : message instanceof Error ? message.message : JSON.stringify(message)
  try {
    void Promise.resolve(invoke('log_from_ui', { level, source, message: text ?? '' })).catch(() => {})
  } catch {
    /* sin backend (pruebas, navegador) */
  }
}

/** Errores de la interfaz que nadie atrapó */
export function installGlobalLogging(): void {
  window.addEventListener('error', e => logUi('error', 'pantalla', e.message || 'Error de la interfaz'))
  window.addEventListener('unhandledrejection', e => logUi('error', 'pantalla', `Promesa rechazada: ${String(e.reason)}`))
}

/** Texto para copiar y pegar en un reporte */
export function logToText(snap: LogSnapshot): string {
  const lines = snap.entries.map(e => `${e.time} [${e.level}] ${e.source}: ${e.message}`)
  const head = [snap.header, ...(snap.file ? [`Archivo: ${snap.file}`] : []), '']
  return [...head, ...lines].join('\n')
}

const LEVEL_RANK: Record<string, number> = { ERROR: 3, WARN: 2, INFO: 1, DEBUG: 0, TRACE: 0 }

export type LogFilter = 'all' | 'warn' | 'error'

export function filterEntries(entries: LogEntry[], filter: LogFilter): LogEntry[] {
  const min = filter === 'error' ? 3 : filter === 'warn' ? 2 : 0
  return entries.filter(e => (LEVEL_RANK[e.level] ?? 1) >= min)
}
