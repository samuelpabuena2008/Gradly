// Grafo dibujado a mano en SVG para espacios pequeños: el mini-grafo local de la página de materia y
// los grafos del Laboratorio. No usa React Flow (no hace falta pan/zoom) y es navegable con teclado.

import { memo, useId } from 'react'
import './grafo-svg.css'

export type TonoNodo = 'normal' | 'actual' | 'resaltado' | 'hecho' | 'cola' | 'atenuado'

export interface NodoSvg {
  id: string
  x: number
  y: number
  /** Texto bajo el nodo. Sin etiqueta, solo se dibuja el círculo. */
  etiqueta?: string
  /** Texto secundario (código de la materia, número de orden…) dentro del círculo. */
  interior?: string
  tono?: TonoNodo
  radio?: number
  /** Descripción completa para lectores de pantalla y tooltip nativo. */
  descripcion?: string
}

export interface AristaSvg {
  de: string
  a: string
  resaltada?: boolean
  atenuada?: boolean
}

interface Props {
  nodos: NodoSvg[]
  aristas: AristaSvg[]
  ancho: number
  alto: number
  /** Describe el dibujo completo para lectores de pantalla. */
  etiqueta: string
  radio?: number
  /** Tamaño del texto de las etiquetas en unidades del dibujo. */
  tamanoEtiqueta?: number
  onElegir?: (id: string) => void
  /** Encabezados de columna (por ejemplo, «Semestre 3»), con su posición x. */
  columnas?: { x: number; texto: string }[]
}

function GrafoSvgBase({ nodos, aristas, ancho, alto, etiqueta, radio = 9, tamanoEtiqueta, onElegir, columnas }: Props) {
  const porId = new Map(nodos.map((n) => [n.id, n]))
  const idMarca = 'flecha' + useId().replace(/:/g, '')

  return (
    <svg className="grafo-svg" viewBox={`0 0 ${ancho} ${alto}`} role="group" aria-label={etiqueta}>
      <defs>
        <marker id={idMarca} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 z" className="grafo-svg-flecha" />
        </marker>
      </defs>
      {columnas?.map((c) => (
        <text key={c.texto} className="grafo-svg-columna" x={c.x} y={12} textAnchor="middle">
          {c.texto}
        </text>
      ))}
      <g aria-hidden="true">
        {aristas.map((e) => {
          const origen = porId.get(e.de)
          const destino = porId.get(e.a)
          if (!origen || !destino) return null
          const ro = origen.radio ?? radio
          const rd = destino.radio ?? radio
          const dx = destino.x - origen.x
          const dy = destino.y - origen.y
          const largo = Math.hypot(dx, dy) || 1
          const x1 = origen.x + (dx / largo) * ro
          const y1 = origen.y + (dy / largo) * ro
          const x2 = destino.x - (dx / largo) * (rd + 3)
          const y2 = destino.y - (dy / largo) * (rd + 3)
          const medio = (x1 + x2) / 2
          return (
            <path
              key={`${e.de}->${e.a}`}
              className={`grafo-svg-arista${e.resaltada ? ' grafo-svg-arista-res' : ''}${e.atenuada ? ' grafo-svg-arista-aten' : ''}`}
              d={`M${x1} ${y1} C${medio} ${y1} ${medio} ${y2} ${x2} ${y2}`}
              markerEnd={`url(#${idMarca})`}
            />
          )
        })}
      </g>
      {nodos.map((n) => {
        const r = n.radio ?? radio
        const interactivo = Boolean(onElegir)
        return (
          <g
            key={n.id}
            className={`grafo-svg-nodo grafo-svg-${n.tono ?? 'normal'}${interactivo ? ' grafo-svg-clicable' : ''}`}
            transform={`translate(${n.x} ${n.y})`}
            role={interactivo ? 'button' : 'img'}
            aria-label={n.descripcion ?? n.etiqueta ?? n.id}
            tabIndex={interactivo ? 0 : undefined}
            onClick={interactivo ? () => onElegir?.(n.id) : undefined}
            onKeyDown={
              interactivo
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onElegir?.(n.id)
                    }
                  }
                : undefined
            }
          >
            <title>{n.descripcion ?? n.etiqueta ?? n.id}</title>
            <circle r={r} className="grafo-svg-circulo" />
            {n.interior && (
              <text className="grafo-svg-interior" textAnchor="middle" dy="0.35em">
                {n.interior}
              </text>
            )}
            {n.etiqueta && (
              <text className="grafo-svg-etiqueta" textAnchor="middle" y={r + (tamanoEtiqueta ?? 11) + 1} style={tamanoEtiqueta ? { fontSize: tamanoEtiqueta } : undefined}>
                {n.etiqueta}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export const GrafoSvg = memo(GrafoSvgBase)
