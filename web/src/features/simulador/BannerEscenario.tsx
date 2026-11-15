// Banner persistente mientras haya un escenario hipotético: avisa que lo que se ve no es lo real,
// resume «antes → después» y permite restaurar con un clic.

import { FlaskConical, RotateCcw } from 'lucide-react'
import { fmtNota } from '../../lib/ui/formato'
import { resumirEscenario } from '../../lib/ui/proyeccion'
import { useApp } from '../../store/app'
import { useEscenario } from '../../store/escenario'
import './simulador.css'

export function BannerEscenario() {
  const escenario = useEscenario()
  const restaurar = useApp((s) => s.restaurarAjustes)
  if (!escenario.hipotetico) return null

  const r = resumirEscenario(
    { promedio: escenario.promedioBase, predicciones: escenario.prediccionesBase },
    { promedio: escenario.promedio, predicciones: escenario.predicciones },
  )

  return (
    <section className="banner-escenario" aria-label="Escenario hipotético">
      <span className="banner-titulo">
        <FlaskConical size={16} strokeWidth={1.5} aria-hidden="true" />
        Estás viendo un escenario hipotético
      </span>
      <ul className="banner-deltas">
        <li>
          Promedio{' '}
          <span className="mono">
            {fmtNota(r.promedio.antes, 2)} → {fmtNota(r.promedio.despues, 2)}
          </span>
        </li>
        <li>
          Dale prioridad{' '}
          <span className="mono">
            {r.rojo.antes} → {r.rojo.despues}
          </span>
        </li>
        <li>
          Materias disponibles{' '}
          <span className="mono">
            {r.disponibles.antes} → {r.disponibles.despues}
          </span>
        </li>
      </ul>
      <button type="button" className="btn banner-restaurar" onClick={restaurar}>
        <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
        Restaurar
      </button>
    </section>
  )
}
