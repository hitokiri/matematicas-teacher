import type { PanItem, Visual } from '../lib/board/types'

/** Dibujo que acompana a la pizarra (balanza, pizzas...) con estilo de tiza */
export default function BoardVisual({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case 'balance':
      return <Balance left={visual.left} right={visual.right} />
  }
}

const W = 640
const H = 300
const BEAM_Y = 70
const PAN_Y = 230
const PAN_W = 250
const LEFT_X = 165
const RIGHT_X = W - 165

function Balance({ left, right }: { left: PanItem[]; right: PanItem[] }) {
  return (
    <svg className="board-visual" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Balanza">
      {/* Soporte y brazo */}
      <path className="chalk-line" fill="none" d={`M ${W / 2 - 60} ${H - 8} L ${W / 2 + 60} ${H - 8} M ${W / 2} ${H - 8} L ${W / 2} ${BEAM_Y}`} />
      <path className="chalk-line" fill="none" d={`M ${W / 2 - 22} ${H - 8} L ${W / 2} ${H - 40} L ${W / 2 + 22} ${H - 8}`} />
      <line className="chalk-line" x1={LEFT_X} y1={BEAM_Y} x2={RIGHT_X} y2={BEAM_Y} />
      <circle className="balance-pivot" cx={W / 2} cy={BEAM_Y} r={9} />
      <text className="chalk-text balance-equal" x={W / 2} y={BEAM_Y - 18} textAnchor="middle" fontSize={30}>=</text>
      <Pan cx={LEFT_X} items={left} />
      <Pan cx={RIGHT_X} items={right} />
    </svg>
  )
}

function Pan({ cx, items }: { cx: number; items: PanItem[] }) {
  // Cuerdas y platillo
  const strings = `M ${cx} ${BEAM_Y} L ${cx - PAN_W / 2 + 10} ${PAN_Y} M ${cx} ${BEAM_Y} L ${cx + PAN_W / 2 - 10} ${PAN_Y}`
  const plate = `M ${cx - PAN_W / 2} ${PAN_Y} Q ${cx} ${PAN_Y + 34} ${cx + PAN_W / 2} ${PAN_Y}`

  // Acomodar: por grupos (repartir) o en filas de izquierda a derecha, de abajo hacia arriba
  const placed = layout(items, cx)
  const groupBoxes = groupOutlines(placed)

  return (
    <g>
      <path className="chalk-line balance-string" fill="none" d={strings} />
      <path className="chalk-line" fill="none" d={plate} />
      {groupBoxes.map((b, k) => (
        <rect key={`g${k}`} className="balance-group" x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} rx={10} />
      ))}
      {placed.map((p, k) => (
        <g key={k} className={p.item.removed ? 'pan-item removed' : 'pan-item'} style={{ animationDelay: `${k * 0.05}s` }}>
          {p.item.kind === 'x' ? (
            <path
              className="pan-bag"
              d={`M ${p.x + 4} ${p.y + 10} Q ${p.x} ${p.y + p.h} ${p.x + p.w / 2} ${p.y + p.h} Q ${p.x + p.w} ${p.y + p.h} ${p.x + p.w - 4} ${p.y + 10} Z M ${p.x + p.w / 2 - 6} ${p.y + 10} L ${p.x + p.w / 2 + 6} ${p.y + 10} L ${p.x + p.w / 2} ${p.y} Z`}
            />
          ) : (
            <rect className="pan-weight" x={p.x} y={p.y} width={p.w} height={p.h} rx={5} />
          )}
          <text
            className="pan-label"
            x={p.x + p.w / 2}
            y={p.y + p.h / 2 + (p.item.kind === 'x' ? 10 : 7)}
            textAnchor="middle"
            fontSize={p.item.label.length > 2 ? 17 : 20}
          >
            {p.item.label}
          </text>
          {p.item.removed && (
            <path className="pan-cross" d={`M ${p.x - 2} ${p.y - 2} L ${p.x + p.w + 2} ${p.y + p.h + 2} M ${p.x + p.w + 2} ${p.y - 2} L ${p.x - 2} ${p.y + p.h + 2}`} />
          )}
        </g>
      ))}
    </g>
  )
}

interface Placed { item: PanItem; x: number; y: number; w: number; h: number }

function size(item: PanItem) {
  const wide = Math.max(item.label.length - 1, 0) * 11
  return item.kind === 'x' ? { w: 34 + wide, h: 40 } : { w: 26 + wide, h: 26 }
}

function layout(items: PanItem[], cx: number): Placed[] {
  const usable = PAN_W - 30
  const gap = 5
  const hasGroups = items.some(i => i.group !== undefined)
  const clusters: PanItem[][] = hasGroups
    ? [...new Set(items.map(i => i.group ?? 0))].map(g => items.filter(i => (i.group ?? 0) === g))
    : [items]
  const clusterGap = hasGroups ? 14 : 0
  const clusterWidth = (usable - clusterGap * (clusters.length - 1)) / clusters.length

  const out: Placed[] = []
  let left = cx - usable / 2
  for (const cluster of clusters) {
    // filas dentro del grupo, de abajo hacia arriba, cada fila centrada
    let x = left
    let baseline = PAN_Y + 6
    let rowHeight = 0
    let rowStart = out.length
    const centerRow = () => {
      const row = out.slice(rowStart)
      if (!row.length) return
      const width = row[row.length - 1].x + row[row.length - 1].w - left
      row.forEach(p => { p.x += (clusterWidth - width) / 2 })
    }
    for (const item of cluster) {
      const { w, h } = size(item)
      if (x + w > left + clusterWidth && x > left) {
        centerRow()
        rowStart = out.length
        x = left
        baseline -= rowHeight + gap
        rowHeight = 0
      }
      out.push({ item, x, y: baseline - h, w, h })
      x += w + gap
      rowHeight = Math.max(rowHeight, h)
    }
    centerRow()
    left += clusterWidth + clusterGap
  }
  return out
}

function groupOutlines(placed: Placed[]) {
  const groups = new Map<number, Placed[]>()
  placed.forEach(p => {
    if (p.item.group !== undefined) groups.set(p.item.group, [...(groups.get(p.item.group) ?? []), p])
  })
  return [...groups.values()].map(ps => {
    const x = Math.min(...ps.map(p => p.x))
    const y = Math.min(...ps.map(p => p.y))
    const w = Math.max(...ps.map(p => p.x + p.w)) - x
    const h = Math.max(...ps.map(p => p.y + p.h)) - y
    return { x, y, w, h }
  })
}
