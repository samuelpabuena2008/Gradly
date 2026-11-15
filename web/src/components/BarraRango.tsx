// Barra de rango en la escala 0–5: banda ŷ ± σ, marcador de la nota esperada y línea de aprobación.
// El significado no depende solo del color: la banda y el marcador tienen forma y posición propias,
// y todo el conjunto se describe con texto para lectores de pantalla.

import type { CSSProperties } from 'react'
import type { Semaforo } from '../types'
import { fmtNota } from '../lib/ui/formato'
import './rango.css'

interface Props {
  nota: number
  rango: [number, number]
  /** Nota mínima para aprobar (línea de referencia). */
  aprobacion?: number
  semaforo?: Semaforo
  /** Versión baja para tarjetas densas: sin marcas de escala. */
  compacto?: boolean
}

const MAX = 5
const pct = (n: number) => `${(Math.min(MAX, Math.max(0, n)) / MAX) * 100}%`

export function BarraRango({ nota, rango, aprobacion = 3, semaforo, compacto = false }: Props) {
  const valida = [nota, rango[0], rango[1]].every(Number.isFinite)
  if (!valida) return <span className="rango-vacio">Sin estimación</span>

  const descripcion = `Nota esperada ${fmtNota(nota)}, rango probable entre ${fmtNota(rango[0])} y ${fmtNota(rango[1])}. Se aprueba con ${fmtNota(aprobacion)}.`
  const estilo = {
    '--rango-ini': pct(rango[0]),
    '--rango-ancho': `${((Math.min(MAX, rango[1]) - Math.max(0, rango[0])) / MAX) * 100}%`,
    '--rango-nota': pct(nota),
    '--rango-apro': pct(aprobacion),
  } as CSSProperties

  return (
    <div className={`rango${compacto ? ' rango-compacto' : ''}${semaforo ? ` rango-${semaforo}` : ''}`} style={estilo}>
      <div className="rango-escala" role="img" aria-label={descripcion}>
        <span className="rango-pista" />
        <span className="rango-banda" />
        <span className="rango-apro" />
        <span className="rango-marca" />
      </div>
      {!compacto && (
        <div className="rango-ticks" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <span key={t} className="mono" style={{ left: pct(t) }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
