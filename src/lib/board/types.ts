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

/** Una pizza cortada en `slices` rebanadas iguales */
export interface Pizza {
  slices: number
  /** Rebanadas tomadas (color 1) */
  filled: number
  /** Rebanadas tomadas de la segunda fraccion, despues de las primeras (color 2) */
  second?: number
  /** De las tomadas, cuantas se quitan (resta): se dibujan tachadas */
  removed?: number
}

export interface PizzaTerm {
  /** Fraccion escrita debajo, p. ej. "1/2" */
  label: string
  pizzas: Pizza[]
}

/** Dibujo que acompana a la pizarra en un paso */
export type Visual =
  | { kind: 'balance'; left: PanItem[]; right: PanItem[]; groups?: number }
  /** Pizzas separadas por signos: [1/2] + [1/4] = [3/4] */
  | { kind: 'pizzas'; terms: PizzaTerm[]; ops: string[] }
  /** Rectangulo para multiplicar fracciones: filas de la primera, columnas de la segunda */
  | { kind: 'grid'; rows: number; cols: number; rowsFilled: number; colsFilled: number }

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
