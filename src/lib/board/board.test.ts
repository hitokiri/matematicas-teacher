import { describe, it, expect } from 'vitest'
import { parseArithmetic } from './parse'
import { buildArithmetic, additionScript, subtractionScript, multiplicationScript, divisionScript } from './arithmetic'
import { solutionScript } from './fromSolution'
import type { BoardItem, BoardScript } from './types'

/** Aplica todos los pasos y devuelve los trazos que quedan en la pizarra */
function finalItems(script: BoardScript, upTo = script.steps.length - 1): BoardItem[] {
  const items = new Map<string, BoardItem>()
  script.steps.slice(0, upTo + 1).forEach(s => {
    s.remove?.forEach(id => items.delete(id))
    s.add.forEach(i => items.set(i.id, i))
  })
  return [...items.values()]
}

/** Texto de una fila (digitos normales, sin llevadas), con espacios donde no hay nada */
function row(script: BoardScript, r: number, small = false): string {
  const cells = Array(script.cols).fill(' ')
  finalItems(script).forEach(i => {
    if (i.kind === 'text' && i.row === r && !!i.small === small && i.align !== 'start') cells[i.col] = i.text
  })
  return cells.join('').trimEnd()
}

describe('parseArithmetic', () => {
  it('reconoce cuentas en distintas formas', () => {
    expect(parseArithmetic('10x20')).toEqual({ op: '*', a: '10', b: '20' })
    expect(parseArithmetic('10 × 20 = ?')).toEqual({ op: '*', a: '10', b: '20' })
    expect(parseArithmetic('cuánto es 7 por 8')).toEqual({ op: '*', a: '7', b: '8' })
    expect(parseArithmetic('47 + 38 + 5')).toEqual({ op: '+', numbers: ['47', '38', '5'] })
    expect(parseArithmetic('52 menos 27')).toEqual({ op: '-', a: '52', b: '27' })
    expect(parseArithmetic('156 ÷ 12')).toEqual({ op: '/', a: '156', b: '12' })
    expect(parseArithmetic('156 entre 12')).toEqual({ op: '/', a: '156', b: '12' })
  })

  it('deja al modelo lo que no es una cuenta simple', () => {
    expect(parseArithmetic('2x + 3 = 7')).toBeNull()
    expect(parseArithmetic('x + 5 = 12')).toBeNull()
    expect(parseArithmetic('1/2 + 1/4')).toBeNull()
    expect(parseArithmetic('√13')).toBeNull()
    expect(parseArithmetic('3.5 * 2')).toBeNull()
  })
})

describe('suma en columna', () => {
  it('lleva las decenas', () => {
    const s = additionScript(['47', '38'])
    expect(s.answer).toBe('85')
    expect(row(s, 1)).toBe(' 47')
    expect(row(s, 2)).toBe('+38')
    expect(row(s, 3)).toBe(' 85')
    expect(row(s, 0, true)).toBe(' 1') // llevamos 1 a las decenas
    expect(s.steps[1].say).toContain('7 + 8 = 15')
  })

  it('la ultima columna puede dar dos digitos', () => {
    const s = additionScript(['95', '17'])
    expect(row(s, 3)).toBe(' 112')
  })
})

describe('resta con prestamos', () => {
  it('pide prestado a las decenas', () => {
    const s = subtractionScript('52', '27')
    expect(s.answer).toBe('25')
    expect(row(s, 3)).toBe(' 25')
    expect(s.steps.some(st => /pedimos prestado/i.test(st.say))).toBe(true)
    expect(row(s, 0, true)).toBe(' 412') // el 5 se vuelve 4 y el 2 se vuelve 12
  })

  it('pide prestado a traves de ceros', () => {
    const s = subtractionScript('1000', '1')
    expect(s.answer).toBe('999')
    expect(row(s, 3)).toBe('  999')
  })

  it('resultado negativo', () => {
    expect(subtractionScript('3', '8').answer).toBe('-5')
  })
})

describe('multiplicacion en columna', () => {
  it('10 × 20 muestra filas parciales y la suma', () => {
    const s = multiplicationScript('10', '20')
    expect(s.answer).toBe('200')
    expect(row(s, 1)).toBe('  10')
    expect(row(s, 2)).toBe('× 20')
    expect(row(s, 4)).toBe('  00')  // por el 0 de las unidades
    expect(row(s, 5)).toBe('+20')   // por el 2 de las decenas, un lugar a la izquierda
    expect(row(s, 6)).toBe(' 200')
  })

  it('lleva en los productos', () => {
    const s = multiplicationScript('47', '6')
    expect(row(s, 3)).toBe(' 282')
    expect(s.steps.some(st => st.say.includes('6 × 7 = 42') && st.say.includes('llevamos 4'))).toBe(true)
  })

  it('pone arriba el numero mas largo', () => {
    const s = multiplicationScript('3', '125')
    expect(s.answer).toBe('375')
    expect(row(s, 1)).toBe(' 125')
  })

  it('resultados correctos con varias cifras', () => {
    for (const [a, b] of [['123', '45'], ['999', '999'], ['305', '207'], ['12', '12']]) {
      expect(multiplicationScript(a, b).answer).toBe((BigInt(a) * BigInt(b)).toString())
    }
  })
})

describe('division en casita', () => {
  it('156 ÷ 12 = 13', () => {
    const s = divisionScript('156', '12')
    expect(s.answer).toBe('13')
    expect(row(s, 0)).toBe('    13')   // cociente arriba del 5 y el 6
    expect(row(s, 1)).toBe('12 156')
    expect(finalItems(s).some(i => i.kind === 'bracket')).toBe(true)
  })

  it('con residuo', () => {
    expect(divisionScript('17', '5').answer).toBe('3 y sobran 2')
    expect(divisionScript('3', '5').answer).toBe('0 y sobran 3')
  })

  it('no divide entre cero', () => {
    expect(divisionScript('8', '0').answer).toMatch(/no se puede/i)
  })
})

describe('guion desde la explicacion del modelo', () => {
  it('escribe una operacion por paso y la respuesta al final', () => {
    const s = solutionScript({
      problem: '2x + 3 = 7',
      steps: [
        { step: 1, title: 'Quitamos el 3', explanation: 'Restamos 3 a los dos lados.', calculation: '2x = 7 − 3 = 4' },
        { step: 2, title: 'Dividimos entre 2', explanation: 'Así x queda sola.', calculation: 'x = 4 ÷ 2 = 2' },
      ],
      final_answer: 'Respuesta final: x = 2',
    })
    expect(s.answer).toBe('x = 2')
    expect(s.steps).toHaveLength(4)
    const texts = finalItems(s).map(i => (i.kind === 'text' ? i.text : ''))
    expect(texts).toEqual(['2x + 3 = 7', '2x = 7 − 3 = 4', 'x = 4 ÷ 2 = 2', '✔ x = 2'])
  })
})

it('buildArithmetic elige el algoritmo', () => {
  expect(buildArithmetic({ op: '*', a: '10', b: '20' }).answer).toBe('200')
  expect(buildArithmetic({ op: '+', numbers: ['1', '2'] }).answer).toBe('3')
})
