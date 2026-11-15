// Vecindad local de una materia en el DAG (mini-grafo de la página de materia).
// Nivel negativo = prerrequisitos (−1 directos, −2 los de sus prerrequisitos); positivo = dependientes.

import type { Arista, Malla } from '../../types'

export interface Vecindario {
  centro: string
  /** Materia → nivel respecto al centro (0 = el centro). */
  niveles: Map<string, number>
  aristas: Arista[]
}

export function vecindario(malla: Malla, centro: string, distancia = 2): Vecindario {
  const niveles = new Map<string, number>([[centro, 0]])

  const recorrer = (signo: 1 | -1) => {
    let frontera = [centro]
    for (let d = 1; d <= distancia; d++) {
      const siguiente: string[] = []
      for (const id of frontera) {
        for (const e of malla.prerrequisitos) {
          const vecino = signo === 1 ? (e.de === id ? e.a : null) : e.a === id ? e.de : null
          if (vecino && !niveles.has(vecino)) {
            niveles.set(vecino, signo * d)
            siguiente.push(vecino)
          }
        }
      }
      frontera = siguiente
    }
  }
  recorrer(-1)
  recorrer(1)

  return {
    centro,
    niveles,
    aristas: malla.prerrequisitos.filter((e) => niveles.has(e.de) && niveles.has(e.a)),
  }
}

export interface PuntoMini {
  x: number
  y: number
}

export const MINI = { columna: 150, fila: 46, margenX: 70, margenY: 28 } as const

/** Columnas por nivel (izquierda → derecha) y filas centradas. Devuelve posiciones y tamaño del lienzo. */
export function layoutVecindario(v: Vecindario): { puntos: Map<string, PuntoMini>; ancho: number; alto: number } {
  const porNivel = new Map<number, string[]>()
  for (const [id, nivel] of [...v.niveles].sort((a, b) => a[0].localeCompare(b[0]))) {
    porNivel.set(nivel, [...(porNivel.get(nivel) ?? []), id])
  }
  const niveles = [...porNivel.keys()].sort((a, b) => a - b)
  const maxFilas = Math.max(1, ...[...porNivel.values()].map((c) => c.length))
  const alto = MINI.margenY * 2 + Math.max(0, maxFilas - 1) * MINI.fila
  const ancho = MINI.margenX * 2 + Math.max(0, niveles.length - 1) * MINI.columna

  const puntos = new Map<string, PuntoMini>()
  niveles.forEach((nivel, columna) => {
    const ids = porNivel.get(nivel)!
    const alturaColumna = (ids.length - 1) * MINI.fila
    ids.forEach((id, fila) => {
      puntos.set(id, {
        x: MINI.margenX + columna * MINI.columna,
        y: MINI.margenY + (alto - MINI.margenY * 2 - alturaColumna) / 2 + fila * MINI.fila,
      })
    })
  })
  return { puntos, ancho, alto }
}
