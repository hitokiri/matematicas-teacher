import { describe, it, expect } from 'vitest'
import { MAX_ROWS_PER_PAGE, pageOf, pageCount, pagesOf, rowOnPage } from './paginate'
import { solutionScript } from './fromSolution'

const long = solutionScript({
  problem: '2x + 3 = 7',
  steps: Array.from({ length: 12 }, (_, i) => ({
    step: i + 1,
    title: `paso ${i + 1}`,
    explanation: `explicacion ${i + 1}`,
    calculation: `linea ${i + 1}`,
  })),
  final_answer: 'x = 1',
})

describe('pizarras', () => {
  it('cabe un proceso corto en una sola pizarra', () => {
    const s = solutionScript({ problem: '2 + 3', steps: [], final_answer: '5' })
    expect(pageCount(s)).toBe(1)
  })

  it('divide los procesos largos en varias pizarras', () => {
    expect(MAX_ROWS_PER_PAGE).toBe(8)
    expect(long.rows).toBe(14)
    expect(pageCount(long)).toBe(2)
    expect(pageOf(7)).toBe(0)
    expect(pageOf(8)).toBe(1)
    expect(rowOnPage(10)).toBe(2)
  })

  it('los renglones se reparten entre las pizarras en el orden en que se escriben', () => {
    const pages = pagesOf(long)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toHaveLength(8)
    expect(pages[1]).toHaveLength(6)
    expect(pages[1][0].kind === 'text' ? pages[1][0].text : '').toBe('linea 8')
    const lastItem = pages[1][pages[1].length - 1]
    expect(lastItem.kind === 'text' ? lastItem.text : '').toBe('✔ x = 1')
  })
})
