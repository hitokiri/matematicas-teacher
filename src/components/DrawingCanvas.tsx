import { useRef, useEffect } from 'react'

interface DrawingCanvasProps {
  onDraw: (text: string) => void
}

const HEIGHT = 300

function DrawingCanvas({ onDraw }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Ajustar el tamano real del lienzo a su tamano en pantalla sin perder lo dibujado
    const resize = () => {
      const width = Math.round(canvas.getBoundingClientRect().width)
      if (!width || !ctx || width === canvas.width) return
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      copy.getContext('2d')?.drawImage(canvas, 0, 0)
      canvas.width = width
      canvas.height = HEIGHT
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (copy.width && copy.height) ctx.drawImage(copy, 0, 0)
    }

    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)
    window.addEventListener('resize', resize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Coordenadas en pixeles del lienzo (el tamano en pantalla puede ser distinto)
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    // Seguir el trazo aunque el puntero salga del lienzo
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drawing.current = true
    lastPos.current = getPos(e)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPos.current) return
    const pos = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current) {
      // Avisar al padre con la imagen actual del lienzo (data URL png)
      const canvas = canvasRef.current
      if (canvas) onDraw(canvas.toDataURL('image/png'))
    }
    drawing.current = false
    lastPos.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    onDraw('')
  }

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        style={{ height: HEIGHT }}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      <div className="canvas-toolbar">
        <button className="btn btn-secondary" onClick={clearCanvas}>
          🗑️ Limpiar
        </button>
        <span className="canvas-hint">Dibuja tu problema aquí</span>
      </div>
    </div>
  )
}

export default DrawingCanvas
