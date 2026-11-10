// Resultados de teoría de grafos sobre la malla (la parte fuerte para Discretas).

import { useMemo } from 'react'
import type { Malla } from '../../types'
import { caminoMasLargo, descendientes, intermediacion } from '../../lib/graph/dag'

interface Props {
  malla: Malla
  seleccionada: string | null
}

export function AnalisisMalla({ malla, seleccionada }: Props) {
  const nombre = (id: string) => malla.materias.find((m) => m.id === id)?.nombre ?? id
  const camino = useMemo(() => caminoMasLargo(malla), [malla])
  const cuellos = useMemo(
    () =>
      Object.entries(intermediacion(malla))
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [malla],
  )

  return (
    <section className="tarjeta">
      <h2>La malla como grafo</h2>
      <p>
        <strong>Cadena más larga ({camino.length} semestres):</strong>{' '}
        {camino.map(nombre).join(' → ')}
      </p>
      <p>
        <strong>Cuellos de botella:</strong>{' '}
        {cuellos.map(([id, c]) => `${nombre(id)} (${c.toFixed(1)})`).join(', ')}
      </p>
      {seleccionada && (
        <p>
          <strong>Dependen de {nombre(seleccionada)}:</strong>{' '}
          {descendientes(malla, seleccionada).map(nombre).join(', ') || 'ninguna'}
        </p>
      )}
    </section>
  )
}
