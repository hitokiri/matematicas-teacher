// Idioma de la interfaz (español / inglés). El usuario lo escoge en Configuración o con el botón
// del encabezado; si nunca lo ha escogido se usa el idioma del sistema.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { es, type MessageKey } from './es'
import { en } from './en'

export type Lang = 'es' | 'en'
export type { MessageKey }
export const LANGS: Lang[] = ['es', 'en']

const KEY = 'lang'
const DICTS: Record<Lang, Record<MessageKey, string>> = { es, en }

/** Idioma guardado, o el del sistema (español si empieza con "es"; si no, inglés) */
export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch { /* sin almacenamiento */ }
  const system = typeof navigator !== 'undefined' ? navigator.language ?? '' : ''
  return system.toLowerCase().startsWith('es') || system === '' ? 'es' : 'en'
}

export type Params = Record<string, string | number>

/** Texto traducido; {nombre} se reemplaza por su valor */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const text = DICTS[lang][key] ?? DICTS.es[key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
}

export type TFunction = (key: MessageKey, params?: Params) => string

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFunction
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try { localStorage.setItem(KEY, next) } catch { /* sin almacenamiento */ }
  }, [])

  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }), [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Sin proveedor (pruebas de un componente suelto) se usa el idioma detectado */
export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  return useMemo(() => {
    if (ctx) return ctx
    const lang = detectLang()
    return { lang, setLang: () => {}, t: (key, params) => translate(lang, key, params) }
  }, [ctx])
}

export const useT = (): TFunction => useI18n().t

/** **negrita** dentro de un texto traducido, sin interpretar HTML */
export function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}
