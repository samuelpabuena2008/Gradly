// Escenario = notas reales (lo importado, fuente de verdad) + ajustes (hipótesis del simulador).
// Los ajustes nunca modifican las notas reales: se aplican al derivar las notas efectivas.

import type { Nota } from '../../types'
import { notasVigentes } from '../model/predict'

/** Nota hipotética para materias sin intento real: el periodo más reciente posible. */
export const PERIODO_HIPOTETICO = '9999-9'

export type Ajustes = Record<string, number>

const redondear = (n: number) => Math.round(n * 10) / 10

/**
 * Notas que ve el modelo. Si la materia ya tiene un intento, el ajuste reemplaza la nota del
 * intento vigente conservando su periodo; si no lo tiene (proyección sobre una materia disponible),
 * se agrega un intento hipotético.
 */
export function notasEfectivas(reales: Nota[], ajustes: Ajustes): Nota[] {
  const materias = Object.keys(ajustes)
  if (materias.length === 0) return reales
  const vigentes = notasVigentes(reales)
  const resultado = reales.map((n) => {
    const ajuste = ajustes[n.materia]
    const vigente = vigentes.get(n.materia)
    if (ajuste !== undefined && vigente && vigente.periodo === n.periodo) {
      return { ...n, nota: redondear(ajuste) }
    }
    return n
  })
  for (const materia of materias) {
    if (!vigentes.has(materia)) {
      resultado.push({ materia, periodo: PERIODO_HIPOTETICO, nota: redondear(ajustes[materia]) })
    }
  }
  return resultado
}

/** Ajustes que de verdad cambian algo (descarta los que igualan la nota real). */
export function ajustesEfectivos(reales: Nota[], ajustes: Ajustes): Ajustes {
  const vigentes = notasVigentes(reales)
  return Object.fromEntries(
    Object.entries(ajustes).filter(([materia, valor]) => {
      const real = vigentes.get(materia)
      return !real || redondear(valor) !== real.nota
    }),
  )
}

/** Valida una nota escrita por el usuario (acepta coma o punto). `null` si no es válida. */
export function parsearNota(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '' || !/^\d+(\.\d+)?$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null
}
