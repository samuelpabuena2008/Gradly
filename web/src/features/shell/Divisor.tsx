// Divisor arrastrable entre paneles. Funciona con mouse/touch (pointer events) y con teclado
// (flechas ±16 px, Mayús ±48, Inicio/Fin, doble clic restablece), como pide el patrón «separator» de ARIA.

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

interface Props {
  etiqueta: string
  ancho: number
  min: number
  max: number
  inicial: number
  /** +1 si arrastrar a la derecha agranda el panel (explorador); −1 si lo achica (inspector). */
  direccion: 1 | -1
  claseExtra?: string
  onCambiar: (ancho: number) => void
}

export function Divisor({ etiqueta, ancho, min, max, inicial, direccion, claseExtra = '', onCambiar }: Props) {
  const arrastre = useRef<{ x: number; ancho: number } | null>(null)
  const cuadro = useRef(0)

  function alBajar(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrastre.current = { x: e.clientX, ancho }
    document.body.classList.add('redimensionando')
  }

  function alMover(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current
    if (!a) return
    const x = e.clientX
    cancelAnimationFrame(cuadro.current)
    cuadro.current = requestAnimationFrame(() => onCambiar(a.ancho + (x - a.x) * direccion))
  }

  function alSoltar(e: PointerEvent<HTMLDivElement>) {
    if (!arrastre.current) return
    arrastre.current = null
    document.body.classList.remove('redimensionando')
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    const paso = e.shiftKey ? 48 : 16
    let nuevo: number | null = null
    if (e.key === 'ArrowRight') nuevo = ancho + paso * direccion
    else if (e.key === 'ArrowLeft') nuevo = ancho - paso * direccion
    else if (e.key === 'Home') nuevo = min
    else if (e.key === 'End') nuevo = max
    else if (e.key === 'Enter') nuevo = inicial
    if (nuevo === null) return
    e.preventDefault()
    onCambiar(nuevo)
  }

  return (
    <div
      className={`divisor ${claseExtra}`.trim()}
      role="separator"
      aria-orientation="vertical"
      aria-label={etiqueta}
      aria-valuenow={ancho}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onKeyDown={alTeclear}
      onDoubleClick={() => onCambiar(inicial)}
    />
  )
}
