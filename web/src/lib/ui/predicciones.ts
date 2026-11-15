// Lógica de la vista Predicciones: orden, filtro, KPIs y carga sugerida.

import type { Malla, Prediccion, Semaforo } from '../../types'

export type OrdenPrediccion = 'riesgo' | 'nota' | 'semestre'
export type FiltroSemaforo = 'todos' | Semaforo

/**
 * Tope orientativo de créditos para la «carga sugerida». Es una heurística de la interfaz, no una
 * regla de la universidad: sirve para dar una idea de cuánto cabe en un semestre.
 */
export const CREDITOS_CARGA_ORIENTATIVA = 18

const ORDEN_SEMAFORO: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 }

export function filtrarPredicciones(preds: Prediccion[], filtro: FiltroSemaforo): Prediccion[] {
  return filtro === 'todos' ? preds : preds.filter((p) => p.semaforo === filtro)
}

export function ordenarPredicciones(
  preds: Prediccion[],
  orden: OrdenPrediccion,
  semestreDe: (id: string) => number,
): Prediccion[] {
  const copia = [...preds]
  const porId = (a: Prediccion, b: Prediccion) => a.materia.localeCompare(b.materia)
  switch (orden) {
    case 'riesgo':
      return copia.sort((a, b) => b.probNoAprobar - a.probNoAprobar || porId(a, b))
    case 'nota':
      return copia.sort((a, b) => a.nota - b.nota || porId(a, b))
    case 'semestre':
      return copia.sort(
        (a, b) => semestreDe(a.materia) - semestreDe(b.materia) || b.probNoAprobar - a.probNoAprobar || porId(a, b),
      )
  }
}

export interface CargaSugerida {
  materias: string[]
  creditos: number
}

/**
 * Carga sugerida: primero lo más atrasado (menor semestre) y, a igual semestre, lo de menor riesgo,
 * sin pasar del tope orientativo de créditos.
 */
export function cargaSugerida(preds: Prediccion[], malla: Malla, tope = CREDITOS_CARGA_ORIENTATIVA): CargaSugerida {
  const info = new Map(malla.materias.map((m) => [m.id, m]))
  const ordenadas = [...preds].sort(
    (a, b) =>
      (info.get(a.materia)?.semestre ?? 99) - (info.get(b.materia)?.semestre ?? 99) ||
      ORDEN_SEMAFORO[b.semaforo] - ORDEN_SEMAFORO[a.semaforo] ||
      a.probNoAprobar - b.probNoAprobar,
  )
  const materias: string[] = []
  let creditos = 0
  for (const p of ordenadas) {
    const cr = info.get(p.materia)?.creditos ?? 0
    if (cr > 0 && creditos + cr <= tope) {
      materias.push(p.materia)
      creditos += cr
    }
  }
  return { materias, creditos }
}

export interface ResumenPredicciones {
  total: number
  verde: number
  amarillo: number
  rojo: number
  /** Promedio de las notas esperadas; `null` si no hay predicciones. */
  notaPromedio: number | null
  carga: CargaSugerida
}

export function resumirPredicciones(preds: Prediccion[], malla: Malla): ResumenPredicciones {
  const validas = preds.filter((p) => Number.isFinite(p.nota))
  return {
    total: preds.length,
    verde: preds.filter((p) => p.semaforo === 'verde').length,
    amarillo: preds.filter((p) => p.semaforo === 'amarillo').length,
    rojo: preds.filter((p) => p.semaforo === 'rojo').length,
    notaPromedio: validas.length > 0 ? validas.reduce((s, p) => s + p.nota, 0) / validas.length : null,
    carga: cargaSugerida(preds, malla),
  }
}
