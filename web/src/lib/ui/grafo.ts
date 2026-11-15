// Utilidades de la vista de grafo: vecindad, resaltados, tamaño de nodos y navegación por teclado.
// Solo usan los resultados de lib/graph (no cambian su lógica).

import type { Arista, Malla, Materia } from '../../types'
import { ETIQUETA_SEMAFORO, valorMateria, type EstadoMateria } from './estado'
import type { Punto } from './layoutMalla'

export type TamanoNodo = 'creditos' | 'intermediacion' | 'uniforme'

/** Clave estable de una arista dirigida. */
export const claveArista = (de: string, a: string) => `${de}->${a}`

/** Aristas de la malla, opcionalmente con las blandas. */
export function aristasMalla(malla: Malla, incluirBlandas: boolean): Arista[] {
  return incluirBlandas ? [...malla.prerrequisitos, ...malla.aristas_blandas] : malla.prerrequisitos
}

export interface Vecindad {
  /** Prerrequisitos directos (y blandas entrantes si se incluyen). */
  previas: Map<string, string[]>
  /** Materias que dependen directamente (y blandas salientes si se incluyen). */
  siguientes: Map<string, string[]>
}

export function construirVecindad(malla: Malla, incluirBlandas: boolean): Vecindad {
  const previas = new Map<string, string[]>(malla.materias.map((m) => [m.id, []]))
  const siguientes = new Map<string, string[]>(malla.materias.map((m) => [m.id, []]))
  for (const { de, a } of aristasMalla(malla, incluirBlandas)) {
    previas.get(a)?.push(de)
    siguientes.get(de)?.push(a)
  }
  return { previas, siguientes }
}

/** La materia y sus vecinas directas (prerrequisitos y dependientes). */
export function vecinos(v: Vecindad, id: string): Set<string> {
  return new Set([id, ...(v.previas.get(id) ?? []), ...(v.siguientes.get(id) ?? [])])
}

/** Las `n` materias con mayor intermediación (solo las que tienen algún camino por ellas). */
export function cuellosDeBotella(inter: Record<string, number>, n = 5): string[] {
  return Object.entries(inter)
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([id]) => id)
}

/** Aristas consecutivas de un camino (cadena crítica). */
export function aristasDeCamino(camino: string[]): Set<string> {
  const s = new Set<string>()
  for (let i = 1; i < camino.length; i++) s.add(claveArista(camino[i - 1], camino[i]))
  return s
}

export const RADIO = { min: 11, max: 26, uniforme: 17 } as const

/** Radio del círculo de una materia según el modo elegido. */
export function radioNodo(materia: Materia, modo: TamanoNodo, inter: Record<string, number>, maxInter: number): number {
  switch (modo) {
    case 'uniforme':
      return RADIO.uniforme
    case 'creditos': {
      const c = Number.isFinite(materia.creditos) ? materia.creditos : 3
      return Math.min(RADIO.max, Math.max(RADIO.min, 8 + c * 3.2))
    }
    case 'intermediacion': {
      const v = inter[materia.id] ?? 0
      const k = maxInter > 0 && Number.isFinite(v) ? Math.sqrt(Math.max(0, v) / maxInter) : 0
      return Math.round((RADIO.min + (RADIO.max - RADIO.min) * k) * 10) / 10
    }
  }
}

export type Tecla = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

export interface ContextoNavegacion {
  vecindad: Vecindad
  centros: Map<string, Punto>
  /** Materias de cada semestre, de arriba abajo. */
  columnas: Map<number, string[]>
  semestreDe: Map<string, number>
  /** Orden por defecto (topológico) para elegir la primera materia. */
  orden: string[]
  visible: (id: string) => boolean
}

/** De `candidatas`, la más cercana en altura a `desde`. */
function masCercana(candidatas: string[], desde: string, centros: Map<string, Punto>): string | null {
  const y0 = centros.get(desde)?.y ?? 0
  let mejor: string | null = null
  let dist = Infinity
  for (const id of candidatas) {
    const d = Math.abs((centros.get(id)?.y ?? 0) - y0)
    if (d < dist) {
      dist = d
      mejor = id
    }
  }
  return mejor
}

/**
 * Siguiente materia al navegar con flechas: ← a un prerrequisito, → a un dependiente
 * (el más cercano en altura), ↑ ↓ a la vecina dentro del mismo semestre.
 * Sin selección empieza por la primera materia visible del orden topológico.
 */
export function navegar(tecla: Tecla, actual: string | null, ctx: ContextoNavegacion): string | null {
  if (!actual || !ctx.visible(actual)) return ctx.orden.find(ctx.visible) ?? null
  switch (tecla) {
    case 'ArrowLeft':
      return masCercana((ctx.vecindad.previas.get(actual) ?? []).filter(ctx.visible), actual, ctx.centros) ?? actual
    case 'ArrowRight':
      return masCercana((ctx.vecindad.siguientes.get(actual) ?? []).filter(ctx.visible), actual, ctx.centros) ?? actual
    case 'ArrowUp':
    case 'ArrowDown': {
      const sem = ctx.semestreDe.get(actual)
      const col = (sem === undefined ? [] : (ctx.columnas.get(sem) ?? [])).filter(ctx.visible)
      const i = col.indexOf(actual)
      const j = tecla === 'ArrowUp' ? i - 1 : i + 1
      return col[j] ?? actual
    }
  }
}

/** Frase para anunciar una materia a lectores de pantalla al navegar el grafo. */
export function describirNodo(materia: Materia, estado: EstadoMateria, vecindad: Vecindad): string {
  const valor = valorMateria(estado)
  let situacion: string
  switch (estado.tipo) {
    case 'aprobada':
      situacion = `Aprobada con ${valor}`
      break
    case 'reprobada':
      situacion = `Por repetir, última nota ${valor}`
      break
    case 'bloqueada':
      situacion = 'Bloqueada: faltan prerrequisitos'
      break
    case 'disponible':
      situacion = estado.prediccion
        ? `${ETIQUETA_SEMAFORO[estado.prediccion.semaforo]}, nota esperada ${valor}`
        : 'Disponible'
  }
  const p = vecindad.previas.get(materia.id)?.length ?? 0
  const s = vecindad.siguientes.get(materia.id)?.length ?? 0
  const previas = p === 1 ? '1 prerrequisito' : `${p} prerrequisitos`
  const siguientes = s === 1 ? '1 materia depende de ella' : `${s} materias dependen de ella`
  return `${materia.nombre}, semestre ${materia.semestre}. ${situacion}. ${previas}, ${siguientes}.`
}
