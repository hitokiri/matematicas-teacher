// Divide el guion en pizarras: cuando una pizarra se llena de renglones, la maestra
// sigue escribiendo en la siguiente (la otra parte de la pizarra).

import type { BoardItem, BoardScript } from './types'

/** Renglones que caben en una pizarra antes de pasar a la siguiente */
export const MAX_ROWS_PER_PAGE = 8

/** Pizarra (0-based) donde se escribe el renglon `row` */
export function pageOf(row: number, maxRows = MAX_ROWS_PER_PAGE): number {
  return Math.floor(row / maxRows)
}

/** Renglón dentro de su pizarra (0-based) */
export function rowOnPage(row: number, maxRows = MAX_ROWS_PER_PAGE): number {
  return row % maxRows
}

/** Cuántas pizarras hacen falta para el guion */
export function pageCount(script: BoardScript, maxRows = MAX_ROWS_PER_PAGE): number {
  return Math.max(1, Math.ceil(script.rows / maxRows))
}

/** Los trazos de cada pizarra, en el orden en que se escribieron */
export function pagesOf(script: BoardScript, maxRows = MAX_ROWS_PER_PAGE): BoardItem[][] {
  const pages = Array.from({ length: pageCount(script, maxRows) }, () => [] as BoardItem[])
  for (const s of script.steps) {
    for (const item of s.add) pages[pageOf(item.row, maxRows)].push(item)
  }
  return pages
}
