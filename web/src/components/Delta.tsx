// Cambio de una predicción frente a la situación real: «▲ +0.3» / «▼ −0.2». Lleva flecha y signo,
// no solo color, y un texto para lectores de pantalla.

import { fmtDelta } from '../lib/ui/formato'
import './delta.css'

export function Delta({ valor }: { valor: number | null }) {
  if (valor === null || !Number.isFinite(valor)) return null
  const redondeado = Number(valor.toFixed(1))
  if (redondeado === 0) return null
  const sube = redondeado > 0
  return (
    <span className={`delta ${sube ? 'delta-sube' : 'delta-baja'} mono`}>
      <span aria-hidden="true">{sube ? '▲' : '▼'}</span> {fmtDelta(valor)}
      <span className="solo-lectores">{sube ? ' sube' : ' baja'} {Math.abs(redondeado).toFixed(1)} puntos</span>
    </span>
  )
}
