// Pantalla de carga. Las etapas son el trabajo real del arranque (ver lib/ui/arranque.ts).

import { Logo } from '../../components/brand/Logo'
import { ETAPAS } from '../../lib/ui/arranque'
import './arranque.css'

interface Props {
  /** Índice de la etapa en curso dentro de ETAPAS. */
  etapa: number
  /** true durante la salida (fade + leve zoom hacia la vista principal). */
  saliendo?: boolean
}

export function Splash({ etapa, saliendo = false }: Props) {
  const ultima = ETAPAS.length - 1
  const progreso = Math.min(1, etapa / ultima)
  return (
    <div className={`splash${saliendo ? ' splash-saliendo' : ''}`} role="status" aria-live="polite">
      <div className="splash-centro">
        <Logo variant="mark" size={96} animated decorativo />
        <p className="splash-marca">gradly</p>
        <div
          className="splash-barra"
          role="progressbar"
          aria-label="Progreso de carga"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progreso * 100)}
        >
          <div className="splash-barra-relleno" style={{ transform: `scaleX(${progreso})` }} />
        </div>
        <p className="splash-etapa">{ETAPAS[Math.min(etapa, ultima)]}</p>
      </div>
    </div>
  )
}
