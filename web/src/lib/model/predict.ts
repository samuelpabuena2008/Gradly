// Inferencia en el navegador: las notas del estudiante nunca salen de su computador.
//
// Fórmula (row-centering), con ȳ = promedio del estudiante en materias anteriores:
//   ŷ(s,c) = ȳ(s) + b(c) + Σ w(p→c) · (y(s,p) − ȳ(s))

import type { Contribucion, Malla, Modelo, Nota, Prediccion, Semaforo } from '../../types'
import { predecesores } from '../graph/dag'

/** Probabilidad de no aprobar a partir de la cual cambia el color del semáforo. */
export const UMBRALES = { amarillo: 0.2, rojo: 0.5 }

/** Función de distribución de la normal estándar (aproximación de Abramowitz y Stegun 7.1.26). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2)
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - poly * Math.exp(-(x * x) / 2)
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

/**
 * Deja una nota por materia. Si una materia se repitió, cuenta el intento más reciente
 * (los periodos tienen formato AAAA-S, así que se comparan como texto).
 */
export function ultimasNotas(notas: Nota[]): Map<string, number> {
  const ultima = new Map<string, Nota>()
  for (const n of notas) {
    const previa = ultima.get(n.materia)
    if (!previa || n.periodo >= previa.periodo) ultima.set(n.materia, n)
  }
  return new Map([...ultima].map(([id, n]) => [id, n.nota]))
}

export function promedio(notas: Map<string, number>): number {
  const valores = [...notas.values()]
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

/** Materias que el estudiante puede inscribir: no aprobadas y con todos sus prerrequisitos aprobados. */
export function materiasDisponibles(malla: Malla, notas: Map<string, number>): string[] {
  const aprobada = (id: string) => (notas.get(id) ?? -1) >= malla.nota_aprobacion
  return malla.materias
    .filter((m) => !aprobada(m.id))
    .filter((m) => predecesores(malla, m.id).every(aprobada))
    .map((m) => m.id)
}

function semaforo(prob: number): Semaforo {
  if (prob >= UMBRALES.rojo) return 'rojo'
  if (prob >= UMBRALES.amarillo) return 'amarillo'
  return 'verde'
}

const limitar = (x: number) => Math.min(5, Math.max(0, x))

/**
 * Predice la nota de una materia. Si el modelo no tiene pesos para ella,
 * usa el baseline: el promedio del estudiante.
 */
export function predecirMateria(
  materia: string,
  malla: Malla,
  modelo: Modelo,
  notas: Map<string, number>,
): Prediccion | null {
  if (notas.size === 0) return null
  const ybar = promedio(notas)
  const curso = modelo.cursos[materia]

  let nota = ybar
  let sigma = modelo.sigma_global
  const contribuciones: Contribucion[] = []

  if (curso) {
    nota += curso.b
    sigma = curso.sigma
    for (const [previa, w] of Object.entries(curso.pesos)) {
      const y = notas.get(previa)
      if (y === undefined) continue // materia previa sin nota: no aporta
      const aporte = w * (y - ybar)
      nota += aporte
      contribuciones.push({ materia: previa, aporte })
    }
  }

  nota = limitar(nota)
  const probNoAprobar = normalCdf((malla.nota_aprobacion - nota) / sigma)
  const porQue = contribuciones
    .filter((c) => Math.abs(c.aporte) > 0.005)
    .sort((x, y) => Math.abs(y.aporte) - Math.abs(x.aporte))
    .slice(0, 3)

  return {
    materia,
    nota,
    rango: [limitar(nota - sigma), limitar(nota + sigma)],
    probNoAprobar,
    semaforo: semaforo(probNoAprobar),
    porQue,
    usaModelo: Boolean(curso),
  }
}

/** Predicciones para todas las materias que el estudiante puede inscribir. */
export function predecirSiguientes(malla: Malla, modelo: Modelo, notas: Nota[]): Prediccion[] {
  const mapa = ultimasNotas(notas)
  return materiasDisponibles(malla, mapa)
    .map((id) => predecirMateria(id, malla, modelo, mapa))
    .filter((p): p is Prediccion => p !== null)
}

/**
 * Qué repasar: materias previas que más bajan las predicciones en amarillo o rojo.
 * El mensaje es "enfócate en esto", nunca "vas a perder".
 */
export function recomendarEnfoque(predicciones: Prediccion[]): { materia: string; impacto: number }[] {
  const impacto = new Map<string, number>()
  for (const p of predicciones) {
    if (p.semaforo === 'verde') continue
    for (const c of p.porQue) {
      if (c.aporte < 0) impacto.set(c.materia, (impacto.get(c.materia) ?? 0) + c.aporte)
    }
  }
  return [...impacto]
    .map(([materia, total]) => ({ materia, impacto: total }))
    .sort((a, b) => a.impacto - b.impacto)
    .slice(0, 3)
}
