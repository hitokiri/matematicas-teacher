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

/** Algo que va en un platillo de la balanza */
export interface PanItem {
  /** 'x' = bolsa de peso desconocido; 'unit' = pesa conocida */
  kind: 'x' | 'unit'
  label: string
  /** Se esta quitando en este paso (se dibuja tachado) */
  removed?: boolean
  /** Grupo al repartir (para dibujar los grupos iguales) */
  group?: number
}

/** Dibujo que acompana a la pizarra en un paso */
export type Visual =
  | { kind: 'balance'; left: PanItem[]; right: PanItem[]; groups?: number }

export interface BoardStep {
  /** Lo que dice la maestra en este paso */
  say: string
  /** Dibujo de este paso (si no hay, se mantiene el del paso anterior) */
  visual?: Visual
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
