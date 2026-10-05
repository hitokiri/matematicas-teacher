// Guion de la pizarra: una cuadricula donde cada paso escribe (o borra) trazos de tiza.

export type Tone = 'normal' | 'op' | 'carry' | 'result' | 'muted' | 'line-text'

export type BoardItem =
  | {
      id: string
      kind: 'text'
      row: number
      col: number
      text: string
      tone?: Tone
      /** Numeros chicos (llevadas, prestamos) */
      small?: boolean
      /** 'center' para digitos en su celda; 'start' para renglones de texto */
      align?: 'center' | 'start'
      /** Partes del renglon con su propio color (p. ej. el numero recien calculado) */
      parts?: Array<{ text: string; tone?: Tone }>
    }
  /** Raya horizontal bajo la fila `row`, de la columna `from` a la `to` (incluidas) */
  | { id: string; kind: 'line'; row: number; from: number; to: number }
  /** Tacha un digito (al pedir prestado) */
  | { id: string; kind: 'strike'; row: number; col: number }
  /** "Casita" de la division: raya vertical a la izquierda de `col` y raya arriba de `row` */
  | { id: string; kind: 'bracket'; row: number; col: number; width: number }

export interface BoardStep {
  /** Lo que dice la maestra en este paso */
  say: string
  add: BoardItem[]
  /** Ids de trazos que se borran (p. ej. llevadas de la fila anterior) */
  remove?: string[]
  /** Celdas [fila, columna] que se resaltan en este paso */
  focus?: Array<[number, number]>
}

export interface BoardScript {
  title: string
  cols: number
  rows: number
  steps: BoardStep[]
  answer: string
}
