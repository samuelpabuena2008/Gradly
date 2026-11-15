// Desglose de la fórmula de regresión para una materia, para explicarla con ejemplos reales:
//   ŷ = μ + b + β·a + Σ w·z      (con z = (y_p − μ_p) − a)
// Replica la cuenta de predecirMateria solo para MOSTRARLA; la prueba comprueba que coincide.

import type { Modelo } from '../../types'
import { nivel } from '../model/predict'

export interface Descomposicion {
  materia: string
  /** μ: media de la materia. */
  media: number
  /** b: ajuste propio de la materia. */
  ajuste: number
  /** β: cuánto pesa el nivel del estudiante aquí. */
  beta: number
  /** a: nivel del estudiante. */
  nivel: number
  /** β·a */
  aporteNivel: number
  /** Σ w·z, con el detalle por materia previa. */
  aportePrevias: number
  previas: { materia: string; peso: number; z: number; aporte: number }[]
  /** Suma de todo, antes de limitar a la escala 0–5. */
  bruta: number
}

/** `null` si la materia no tiene pesos propios (entonces el modelo usa «media + nivel»). */
export function descomponerRegresion(materia: string, modelo: Modelo, notas: Map<string, number>): Descomposicion | null {
  const curso = modelo.cursos[materia]
  const media = modelo.medias[materia]
  if (!curso || media === undefined || notas.size === 0) return null
  const a = nivel(modelo, notas)
  const previas: Descomposicion['previas'] = []
  for (const [previa, peso] of Object.entries(curso.pesos)) {
    const y = notas.get(previa)
    const mu = modelo.medias[previa]
    if (y === undefined || mu === undefined) continue
    const z = y - mu - a
    previas.push({ materia: previa, peso, z, aporte: peso * z })
  }
  previas.sort((x, y) => Math.abs(y.aporte) - Math.abs(x.aporte))
  const aportePrevias = previas.reduce((s, p) => s + p.aporte, 0)
  const aporteNivel = curso.beta * a
  return {
    materia,
    media,
    ajuste: curso.b,
    beta: curso.beta,
    nivel: a,
    aporteNivel,
    aportePrevias,
    previas,
    bruta: media + curso.b + aporteNivel + aportePrevias,
  }
}
