// Comparación entre la situación real y un escenario hipotético: deltas por predicción, materias que
// se desbloquean y resumen «antes → después».

import type { Prediccion } from '../../types'

export interface DeltaPrediccion {
  materia: string
  /** Nota esperada sin el escenario; `null` si la materia no estaba disponible. */
  antes: number | null
  despues: number
  /** Cambio en puntos de nota; `null` si es una materia nueva. */
  delta: number | null
  nueva: boolean
}

/** Un cambio menor a esto (en puntos de nota) se considera ruido de redondeo. */
const UMBRAL_DELTA = 0.05

/** Predicciones del escenario que cambiaron o son nuevas, ordenadas por el tamaño del cambio. */
export function deltasPredicciones(base: Prediccion[], escenario: Prediccion[]): DeltaPrediccion[] {
  const previas = new Map(base.map((p) => [p.materia, p]))
  const resultado: DeltaPrediccion[] = []
  for (const p of escenario) {
    if (!Number.isFinite(p.nota)) continue
    const antes = previas.get(p.materia)
    if (!antes) {
      resultado.push({ materia: p.materia, antes: null, despues: p.nota, delta: null, nueva: true })
      continue
    }
    const delta = p.nota - antes.nota
    if (Math.abs(delta) >= UMBRAL_DELTA) resultado.push({ materia: p.materia, antes: antes.nota, despues: p.nota, delta, nueva: false })
  }
  return resultado.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0) || a.materia.localeCompare(b.materia))
}

/** Materias que pasan a estar disponibles (o dejan de estarlo) por el escenario. */
export function cambiosDisponibilidad(base: Prediccion[], escenario: Prediccion[]): { nuevas: string[]; perdidas: string[] } {
  const antes = new Set(base.map((p) => p.materia))
  const despues = new Set(escenario.map((p) => p.materia))
  return {
    nuevas: [...despues].filter((m) => !antes.has(m)).sort(),
    perdidas: [...antes].filter((m) => !despues.has(m)).sort(),
  }
}

export interface ResumenEscenario {
  promedio: { antes: number | null; despues: number | null }
  rojo: { antes: number; despues: number }
  disponibles: { antes: number; despues: number }
}

export function resumirEscenario(
  base: { promedio: number | null; predicciones: Prediccion[] },
  escenario: { promedio: number | null; predicciones: Prediccion[] },
): ResumenEscenario {
  const rojas = (ps: Prediccion[]) => ps.filter((p) => p.semaforo === 'rojo').length
  return {
    promedio: { antes: base.promedio, despues: escenario.promedio },
    rojo: { antes: rojas(base.predicciones), despues: rojas(escenario.predicciones) },
    disponibles: { antes: base.predicciones.length, despues: escenario.predicciones.length },
  }
}
