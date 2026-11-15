// Encabezados «Semestre N» fijos arriba que acompañan el desplazamiento y el zoom horizontal.

import { memo } from 'react'
import { useStore } from '@xyflow/react'
import type { ColumnaSemestre } from '../../lib/ui/layoutMalla'

const selector = (s: { transform: [number, number, number] }) => `${s.transform[0]}|${s.transform[2]}`

function EncabezadosBase({ columnas }: { columnas: ColumnaSemestre[] }) {
  // Solo importa el desplazamiento horizontal y el zoom: el vertical no re-renderiza.
  const clave = useStore(selector)
  const [tx, zoom] = clave.split('|').map(Number)
  return (
    <div className="malla-semestres" aria-hidden="true">
      {columnas.map((c) => (
        <span key={c.semestre} className="malla-semestre" style={{ transform: `translateX(${c.x * zoom + tx}px) translateX(-50%)` }}>
          {zoom < 0.55 ? `S${c.semestre}` : `Semestre ${c.semestre}`}
        </span>
      ))}
    </div>
  )
}

export const EncabezadosSemestre = memo(EncabezadosBase)
