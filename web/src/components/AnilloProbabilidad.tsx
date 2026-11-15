// Anillo con la probabilidad de no aprobar, en el color del semáforo. Un arco es la medida; el
// número y el texto dicen lo mismo, así que no depende del color.

import type { Semaforo } from '../types'
import { fmtPct } from '../lib/ui/formato'
import './rango.css'

interface Props {
  probabilidad: number
  semaforo: Semaforo
  /** Diámetro en px. */
  tamano?: number
}

export function AnilloProbabilidad({ probabilidad, semaforo, tamano = 84 }: Props) {
  const valida = Number.isFinite(probabilidad)
  const p = valida ? Math.min(1, Math.max(0, probabilidad)) : 0
  const trazo = 7
  const r = (tamano - trazo) / 2
  const circunferencia = 2 * Math.PI * r

  return (
    <div
      className={`anillo anillo-${semaforo}`}
      style={{ width: tamano, height: tamano }}
      role="img"
      aria-label={valida ? `Probabilidad de no aprobar: ${fmtPct(p)}` : 'Probabilidad de no aprobar sin estimar'}
    >
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} aria-hidden="true">
        <circle className="anillo-pista" cx={tamano / 2} cy={tamano / 2} r={r} strokeWidth={trazo} />
        <circle
          className="anillo-arco"
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          strokeWidth={trazo}
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - p)}
        />
      </svg>
      <span className="anillo-texto" aria-hidden="true">
        <span className="anillo-valor mono">{fmtPct(valida ? p : null)}</span>
        <span className="anillo-pie">no aprobar</span>
      </span>
    </div>
  )
}
