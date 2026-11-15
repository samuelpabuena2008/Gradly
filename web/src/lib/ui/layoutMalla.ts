// Disposición de la malla en columnas por semestre (izquierda → derecha).
// Dentro de cada semestre el orden vertical se elige con la heurística del baricentro
// (Sugiyama): cada materia se acerca a la altura media de sus vecinas en las columnas
// contiguas, lo que reduce los cruces de aristas. Parte del orden topológico, no del JSON.

import type { Arista, Malla } from '../../types'

/** Separación horizontal entre semestres y vertical entre materias (en px del lienzo). */
export const COLUMNA = 184
export const FILA = 104

export interface Punto {
  x: number
  y: number
}

export interface ColumnaSemestre {
  semestre: number
  /** Centro horizontal de la columna. */
  x: number
}

export interface LayoutSemestres {
  /** Centro de cada materia. */
  centros: Map<string, Punto>
  /** Orden vertical final de cada semestre (de arriba abajo). */
  columnas: Map<number, string[]>
  encabezados: ColumnaSemestre[]
}

/** Altura relativa de una materia dentro de su columna (centrada en 0). */
function alturas(columnas: Map<number, string[]>): Map<string, number> {
  const h = new Map<string, number>()
  for (const ids of columnas.values()) ids.forEach((id, i) => h.set(id, i - (ids.length - 1) / 2))
  return h
}

/** Dos segmentos se cruzan de forma propia (sin compartir extremos). */
function seCruzan(a: Punto, b: Punto, c: Punto, d: Punto): boolean {
  const o = (p: Punto, q: Punto, r: Punto) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

/** Cuántos pares de aristas (como segmentos rectos) se cruzan con estos centros. */
export function contarCruces(aristas: Arista[], centros: Map<string, Punto>): number {
  let cruces = 0
  for (let i = 0; i < aristas.length; i++) {
    for (let j = i + 1; j < aristas.length; j++) {
      const e = aristas[i]
      const f = aristas[j]
      if (e.de === f.de || e.de === f.a || e.a === f.de || e.a === f.a) continue
      const [a, b, c, d] = [centros.get(e.de), centros.get(e.a), centros.get(f.de), centros.get(f.a)]
      if (a && b && c && d && seCruzan(a, b, c, d)) cruces++
    }
  }
  return cruces
}

function centrosDe(columnas: Map<number, string[]>): Map<string, Punto> {
  const centros = new Map<string, Punto>()
  for (const [semestre, ids] of columnas) {
    ids.forEach((id, i) => centros.set(id, { x: (semestre - 1) * COLUMNA, y: (i - (ids.length - 1) / 2) * FILA }))
  }
  return centros
}

/** Columnas iniciales: materias de cada semestre en el orden topológico dado. */
export function columnasIniciales(malla: Malla, orden: string[]): Map<number, string[]> {
  const pos = new Map(orden.map((id, i) => [id, i]))
  const columnas = new Map<number, string[]>()
  const materias = [...malla.materias].sort((a, b) => a.semestre - b.semestre || (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
  for (const m of materias) columnas.set(m.semestre, [...(columnas.get(m.semestre) ?? []), m.id])
  return columnas
}

/**
 * Ordena cada semestre con barridos alternos de baricentro (de izquierda a derecha usando los
 * prerrequisitos y de derecha a izquierda usando los dependientes) y se queda con el orden que
 * menos cruces produce. Es determinista.
 */
export function layoutSemestres(malla: Malla, orden: string[], barridos = 8): LayoutSemestres {
  const aristas = malla.prerrequisitos
  const previas = new Map<string, string[]>()
  const siguientes = new Map<string, string[]>()
  for (const { de, a } of aristas) {
    previas.set(a, [...(previas.get(a) ?? []), de])
    siguientes.set(de, [...(siguientes.get(de) ?? []), a])
  }
  const semestres = [...new Set(malla.materias.map((m) => m.semestre))].sort((a, b) => a - b)

  let columnas = columnasIniciales(malla, orden)
  let mejor = columnas
  let menosCruces = contarCruces(aristas, centrosDe(columnas))

  for (let b = 0; b < barridos && menosCruces > 0; b++) {
    const haciaDerecha = b % 2 === 0
    const vecinas = haciaDerecha ? previas : siguientes
    const recorrido = haciaDerecha ? semestres : [...semestres].reverse()
    const nuevas = new Map(columnas)
    for (const semestre of recorrido) {
      const h = alturas(nuevas)
      const ids = nuevas.get(semestre)!
      const baricentro = new Map(
        ids.map((id) => {
          const vs = (vecinas.get(id) ?? []).filter((v) => h.has(v))
          // Sin vecinas en esa dirección conserva su altura actual.
          return [id, vs.length ? vs.reduce((s, v) => s + h.get(v)!, 0) / vs.length : h.get(id)!]
        }),
      )
      const indice = new Map(ids.map((id, i) => [id, i]))
      nuevas.set(semestre, [...ids].sort((x, y) => baricentro.get(x)! - baricentro.get(y)! || indice.get(x)! - indice.get(y)!))
    }
    columnas = nuevas
    const cruces = contarCruces(aristas, centrosDe(columnas))
    if (cruces < menosCruces) {
      menosCruces = cruces
      mejor = columnas
    }
  }

  return {
    centros: centrosDe(mejor),
    columnas: mejor,
    encabezados: semestres.map((semestre) => ({ semestre, x: (semestre - 1) * COLUMNA })),
  }
}

/** Interpola dos disposiciones (t de 0 a 1). Las materias que faltan en `hasta` quedan quietas. */
export function interpolar(desde: Map<string, Punto>, hasta: Map<string, Punto>, t: number): Map<string, Punto> {
  const k = Math.min(1, Math.max(0, t))
  const r = new Map<string, Punto>()
  for (const [id, a] of desde) {
    const b = hasta.get(id) ?? a
    r.set(id, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
  }
  for (const [id, b] of hasta) if (!r.has(id)) r.set(id, b)
  return r
}
