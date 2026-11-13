// Inferencia en el navegador: las notas del estudiante nunca salen de su computador.
//
// Fórmula:
//   ŷ(s,c) = μ(c) + b(c) + β(c)·a(s) + Σ w(p→c) · z(s,p)
//   μ(c)   media de la materia c (modelo.medias)
//   a(s)   nivel del estudiante: Σ (y_p − μ_p) / (n + k_nivel)
//   z(s,p) cómo le fue en p frente a su nivel: (y_p − μ_p) − a(s)

import type { Contribucion, Malla, Modelo, Nota, Prediccion, Semaforo } from '../../types'
import { gradoSalida, intermediacion, predecesores } from '../graph/dag'

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

/** a(s): desviación media del estudiante frente a la media de cada materia, encogida hacia 0. */
export function nivel(modelo: Modelo, notas: Map<string, number>): number {
  let suma = 0
  let n = 0
  for (const [materia, nota] of notas) {
    const media = modelo.medias[materia]
    if (media === undefined) continue
    suma += nota - media
    n += 1
  }
  return suma / (n + modelo.k_nivel)
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
 * usa la media de la materia más el nivel del estudiante.
 */
export function predecirMateria(
  materia: string,
  malla: Malla,
  modelo: Modelo,
  notas: Map<string, number>,
): Prediccion | null {
  if (notas.size === 0) return null
  const a = nivel(modelo, notas)
  const curso = modelo.cursos[materia]

  let nota = (modelo.medias[materia] ?? promedio(notas)) + a
  let sigma = modelo.sigma_global
  const contribuciones: Contribucion[] = []

  if (curso) {
    nota = modelo.medias[materia] + curso.b + curso.beta * a
    sigma = curso.sigma
    for (const [previa, w] of Object.entries(curso.pesos)) {
      const y = notas.get(previa)
      if (y === undefined) continue // materia previa sin nota: no aporta
      const aporte = w * (y - modelo.medias[previa] - a)
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
 * Si se pasa `malla`, pondera el impacto por la centralidad del nodo objetivo
 * (intermediación y grado de salida en el DAG), dando prioridad a los cuellos de botella.
 * El mensaje es "enfócate en esto", nunca "vas a perder".
 */
export function recomendarEnfoque(
  predicciones: Prediccion[],
  malla?: Malla,
): { materia: string; impacto: number }[] {
  const inter = malla ? intermediacion(malla) : null
  const salida = malla ? gradoSalida(malla) : null
  const maxInter = inter ? Math.max(1, ...Object.values(inter)) : 1
  const maxSalida = salida ? Math.max(1, ...Object.values(salida)) : 1

  const impacto = new Map<string, number>()
  for (const p of predicciones) {
    if (p.semaforo === 'verde') continue
    const factorCentralidad =
      malla && inter && salida
        ? 1 + 0.5 * ((inter[p.materia] ?? 0) / maxInter) + 0.5 * ((salida[p.materia] ?? 0) / maxSalida)
        : 1
    for (const c of p.porQue) {
      if (c.aporte < 0) {
        impacto.set(c.materia, (impacto.get(c.materia) ?? 0) + c.aporte * factorCentralidad)
      }
    }
  }
  return [...impacto]
    .map(([materia, total]) => ({ materia, impacto: total }))
    .sort((a, b) => a.impacto - b.impacto)
    .slice(0, 3)
}

/**
 * Contenidos cruzados para reforzar una materia en riesgo (amarillo o rojo):
 * devuelve los temas puntuales de las materias previas que están bajando la predicción
 * (aporte < 0) y tienen contenidos puente hacia la materia objetivo.
 */
export function recomendarContenidosCruzados(
  prediccion: Prediccion,
  malla: Malla,
): { previa: string; aporte: number; temas: string[] }[] {
  if (prediccion.semaforo === 'verde' || !malla.contenidos_cruzados?.length) return []
  const negativos = new Map(
    prediccion.porQue.filter((c) => c.aporte < 0).map((c) => [c.materia, c.aporte]),
  )
  return malla.contenidos_cruzados
    .filter((cc) => cc.a === prediccion.materia && negativos.has(cc.de))
    .map((cc) => ({
      previa: cc.de,
      aporte: negativos.get(cc.de)!,
      temas: cc.temas,
    }))
    .sort((a, b) => a.aporte - b.aporte)
}
