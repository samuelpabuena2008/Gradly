// Historial de intentos de una materia (de las notas reales, nunca de las hipotéticas).

import type { Nota } from '../../types'

export interface Intento {
  periodo: string
  nota: number
  aprobado: boolean
  /** El intento que cuenta para el modelo: el más reciente. */
  vigente: boolean
}

/** Intentos de una materia en orden cronológico. Vacío si nunca la cursó. */
export function historialIntentos(notas: Nota[], materia: string, notaAprobacion: number): Intento[] {
  const propios = notas
    .filter((n) => n.materia === materia)
    .map((n, i) => ({ n, i }))
    // Estable: con el mismo periodo manda el orden de llegada (la última gana, como en notasVigentes).
    .sort((a, b) => (a.n.periodo < b.n.periodo ? -1 : a.n.periodo > b.n.periodo ? 1 : a.i - b.i))
    .map(({ n }) => n)
  return propios.map((n, i) => ({
    periodo: n.periodo,
    nota: n.nota,
    aprobado: n.nota >= notaAprobacion,
    vigente: i === propios.length - 1,
  }))
}
