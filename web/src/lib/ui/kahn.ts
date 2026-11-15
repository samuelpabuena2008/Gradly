// Algoritmo de Kahn paso a paso, para el Laboratorio de grafos. Sigue exactamente el orden de
// ordenTopologico (misma cola, mismo recorrido de sucesores), así que el resultado final coincide.

import type { Malla } from '../../types'
import { construirGrafo } from '../graph/dag'

export interface PasoKahn {
  /** 0 = estado inicial (antes de sacar nada). */
  indice: number
  /** Materia que sale de la cola en este paso; `null` en el estado inicial. */
  sale: string | null
  /** Materias cuyo grado de entrada llegó a 0 por la salida de `sale`. */
  liberadas: string[]
  /** Cola después del paso. */
  cola: string[]
  /** Grado de entrada de cada materia después del paso. */
  entrada: Record<string, number>
  /** Orden topológico construido hasta ahora. */
  orden: string[]
}

export function pasosKahn(malla: Malla): PasoKahn[] {
  const adj = construirGrafo(malla)
  const entrada = new Map<string, number>([...adj.keys()].map((id) => [id, 0]))
  for (const sucesores of adj.values()) for (const v of sucesores) entrada.set(v, entrada.get(v)! + 1)

  const cola = [...adj.keys()].filter((id) => entrada.get(id) === 0)
  const orden: string[] = []
  const pasos: PasoKahn[] = [
    { indice: 0, sale: null, liberadas: [], cola: [...cola], entrada: Object.fromEntries(entrada), orden: [] },
  ]

  while (cola.length > 0) {
    const u = cola.shift()!
    orden.push(u)
    const liberadas: string[] = []
    for (const v of adj.get(u)!) {
      entrada.set(v, entrada.get(v)! - 1)
      if (entrada.get(v) === 0) {
        cola.push(v)
        liberadas.push(v)
      }
    }
    pasos.push({
      indice: pasos.length,
      sale: u,
      liberadas,
      cola: [...cola],
      entrada: Object.fromEntries(entrada),
      orden: [...orden],
    })
  }
  return pasos
}
