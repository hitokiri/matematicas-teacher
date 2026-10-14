import type { Lang } from '../i18n'

/** Elige el texto segun el idioma de la interfaz: `const T = pick(lang)` y luego `T('hola', 'hello')` */
export const pick = (lang: Lang) => (es: string, en: string): string => (lang === 'en' ? en : es)

export type { Lang }
