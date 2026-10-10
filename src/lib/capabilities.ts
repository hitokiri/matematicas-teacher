// Hasta donde llega la maestra: que temas resuelve la app sola (siempre correctos y sin saltarse
// pasos), cuales le pasa al modelo y cuales vienen despues. Al agregar un tema nuevo a la pizarra,
// se cambia aqui y en el README ("Qué sabe explicar").

export type Support = 'app' | 'model' | 'soon'

export interface Topic {
  title: string
  /** Lo que se puede escribir para probarlo */
  examples: string[]
  /** Como lo explica */
  how: string
  support: Support
}

export const TOPICS: Topic[] = [
  {
    title: 'Cuentas',
    examples: ['47 + 38', '156 entre 12', '34 x 444'],
    how: 'En columna, como en la escuela, con llevadas y préstamos.',
    support: 'app',
  },
  {
    title: 'Operaciones combinadas',
    examples: ['3 + 4 × 2', '(8 − 3)²', '√50'],
    how: 'Orden de operaciones paso a paso; las raíces no exactas se buscan probando números.',
    support: 'app',
  },
  {
    title: 'Fracciones',
    examples: ['1/2 + 1/4', '2/3 × 3/5', '6/8'],
    how: 'Con pizzas: el número de abajo dice en cuántas rebanadas se corta.',
    support: 'app',
  },
  {
    title: 'Ecuaciones con una letra',
    examples: ['2x + 4 = 10', '3x + 2 = x + 10', '2(x + 3) = 14'],
    how: 'Con una balanza: lo que se hace de un lado se hace del otro, y al final se comprueba.',
    support: 'app',
  },
  {
    title: 'Ecuación con dos letras',
    examples: ['2x + 3y = 6', 'y = 2x + 1'],
    how: 'Despeja la y y busca parejas, explicando por qué escoge cada número.',
    support: 'app',
  },
  {
    title: 'Sistemas de dos ecuaciones',
    examples: ['x + y = 5\nx - y = 1', '2x + 3y = 12\n3x + 2y = 13'],
    how: 'Sustitución si alguna letra está sola; si no, reducción. Comprueba en las dos ecuaciones.',
    support: 'app',
  },
  {
    title: 'Ecuaciones de segundo grado',
    examples: ['x² = 9', 'x² + 5x + 6 = 0'],
    how: 'Las resuelve el modelo: puede saltarse pasos. Es lo siguiente que aprenderá la pizarra.',
    support: 'model',
  },
  {
    title: 'Desigualdades y letra en el denominador',
    examples: ['2x + 1 < 7', '6/x = 2'],
    how: 'Las resuelve el modelo: revisa los pasos.',
    support: 'model',
  },
  {
    title: 'Problemas con palabras',
    examples: ['Ana tiene 3 dulces y le dan 6 más'],
    how: 'El modelo lee el problema y lo explica.',
    support: 'model',
  },
  {
    title: 'Historial de problemas',
    examples: [],
    how: 'Guardar los problemas resueltos como fixtures para volver a verlos (y usarlos en las pruebas).',
    support: 'soon',
  },
]

export const SUPPORT_LABEL: Record<Support, string> = {
  app: '✔ La app lo explica sola',
  model: '🤖 Con el modelo',
  soon: '🔜 Próximamente',
}
