// Disposición «orgánica» de la malla: una simulación de fuerzas pequeña y determinista
// (repulsión entre materias, resortes en las aristas, colisión y una leve atracción hacia la
// columna de su semestre para que el grafo siga leyéndose de izquierda a derecha).
// Para 50 nodos el cálculo directo O(n²) toma milisegundos, así que no hace falta d3-force.

import type { Arista } from '../../types'
import type { Punto } from './layoutMalla'

export interface OpcionesFuerzas {
  iteraciones?: number
  /** Largo de reposo de las aristas. */
  distancia?: number
  /** Intensidad de la repulsión entre materias (positiva). */
  repulsion?: number
  /** Radio de colisión de cada materia. */
  radio?: (id: string) => number
  /** Posición horizontal hacia la que tiende cada materia (p. ej. su semestre). */
  anclaX?: (id: string) => number
  fuerzaAncla?: number
  /** Atracción vertical hacia el centro (evita que las materias sin aristas se alejen). */
  fuerzaCentro?: number
}

interface Cuerpo {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Calcula la disposición final partiendo de `inicial`. Es determinista: con los mismos datos
 * devuelve siempre las mismas posiciones (no usa números aleatorios).
 */
export function simularFuerzas(
  ids: string[],
  aristas: Arista[],
  inicial: Map<string, Punto>,
  opciones: OpcionesFuerzas = {},
): Map<string, Punto> {
  const {
    iteraciones = 300,
    distancia = 120,
    repulsion = 900,
    radio = () => 40,
    anclaX,
    fuerzaAncla = 0.04,
    fuerzaCentro = 0.02,
  } = opciones

  const cuerpos: Cuerpo[] = ids.map((id, i) => {
    const p = inicial.get(id) ?? { x: 0, y: 0 }
    // Desempate determinista si dos materias empiezan en el mismo punto.
    return { id, x: p.x + ((i % 7) - 3) * 0.01, y: p.y + ((i % 5) - 2) * 0.01, vx: 0, vy: 0 }
  })
  const porId = new Map(cuerpos.map((c) => [c.id, c]))
  const enlaces = aristas
    .map((e) => [porId.get(e.de), porId.get(e.a)] as const)
    .filter((par): par is readonly [Cuerpo, Cuerpo] => !!par[0] && !!par[1])

  const grado = new Map<string, number>()
  for (const [s, t] of enlaces) {
    grado.set(s.id, (grado.get(s.id) ?? 0) + 1)
    grado.set(t.id, (grado.get(t.id) ?? 0) + 1)
  }
  const radios = new Map(ids.map((id) => [id, radio(id)]))
  const centroY = cuerpos.reduce((s, c) => s + c.y, 0) / Math.max(1, cuerpos.length)

  let alfa = 1
  const decaimiento = 1 - Math.pow(0.001, 1 / iteraciones)
  const friccion = 0.6

  for (let it = 0; it < iteraciones; it++) {
    alfa += (0 - alfa) * decaimiento

    // Resortes (como forceLink de d3: la materia con más conexiones se mueve menos).
    for (const [s, t] of enlaces) {
      let dx = t.x + t.vx - s.x - s.vx
      let dy = t.y + t.vy - s.y - s.vy
      const l = Math.hypot(dx, dy) || 1e-6
      const fuerza = 1 / Math.min(grado.get(s.id)!, grado.get(t.id)!)
      const k = ((l - distancia) / l) * alfa * fuerza
      dx *= k
      dy *= k
      const sesgo = grado.get(s.id)! / (grado.get(s.id)! + grado.get(t.id)!)
      t.vx -= dx * sesgo
      t.vy -= dy * sesgo
      s.vx += dx * (1 - sesgo)
      s.vy += dy * (1 - sesgo)
    }

    // Repulsión entre todos los pares y colisión.
    for (let i = 0; i < cuerpos.length; i++) {
      const a = cuerpos[i]
      for (let j = i + 1; j < cuerpos.length; j++) {
        const b = cuerpos[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = Math.max(dx * dx + dy * dy, 1)
        const d = Math.sqrt(d2)
        const w = (repulsion * alfa) / d2
        a.vx -= dx * w
        a.vy -= dy * w
        b.vx += dx * w
        b.vy += dy * w

        const minimo = radios.get(a.id)! + radios.get(b.id)!
        if (d < minimo) {
          const empuje = ((minimo - d) / d) * 0.5 * 0.7
          a.vx -= dx * empuje
          a.vy -= dy * empuje
          b.vx += dx * empuje
          b.vy += dy * empuje
        }
      }
    }

    // Anclas suaves: columna del semestre en x y centro en y.
    for (const c of cuerpos) {
      if (anclaX) c.vx += (anclaX(c.id) - c.x) * fuerzaAncla * alfa
      c.vy += (centroY - c.y) * fuerzaCentro * alfa
    }

    for (const c of cuerpos) {
      c.vx *= friccion
      c.vy *= friccion
      c.x += c.vx
      c.y += c.vy
    }
  }

  return new Map(cuerpos.map((c) => [c.id, { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }]))
}
