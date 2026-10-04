import { useRef, useState, useEffect, useCallback } from 'react'

interface DrawingCanvasProps {
  onDraw: (text: string) => void
}

function DrawingCanvas({ onDraw }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPos, setLastPos] = useState<{x: number, y: number} | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const resize = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.clientWidth
        canvas.height = 200
      }
    }
    
    resize()
    window.addEventListener('resize', resize)
    
    // Fill with white
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    
    return () => window.removeEventListener('resize', resize)
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    setLastPos(getPos(e))
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos) return
    
    const pos = getPos(e)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.beginPath()
    ctx.moveTo(lastPos.x, lastPos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()
    
    setLastPos(pos)
  }

  const stopDrawing = () => {
    if (isDrawing) {
      // Avisar al padre con la imagen actual del lienzo (data URL png)
      const canvas = canvasRef.current
      if (canvas) onDraw(canvas.toDataURL('image/png'))
    }
    setIsDrawing(false)
    setLastPos(null)
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
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="canvas-toolbar">
        <button className="btn btn-secondary" onClick={clearCanvas}>
          🗑️ Limpiar
        </button>
        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
          Dibuja tu problema aqui
        </span>
      </div>
    </div>
  )
}

export default DrawingCanvas
