// Análisis de la malla como grafo dirigido acíclico (DAG).
// Nodos = materias, aristas = prerrequisitos (de → a).

import type { Malla } from '../../types'

export type Adyacencia = Map<string, string[]>

/** Lista de sucesores de cada materia. Por defecto solo prerrequisitos oficiales. */
export function construirGrafo(malla: Malla, incluirBlandas = false): Adyacencia {
  const adj: Adyacencia = new Map(malla.materias.map((m) => [m.id, []]))
  const aristas = incluirBlandas
    ? [...malla.prerrequisitos, ...malla.aristas_blandas]
    : malla.prerrequisitos
  for (const { de, a } of aristas) {
    if (!adj.has(de) || !adj.has(a)) {
      throw new Error(`Arista ${de} → ${a} usa una materia que no está en la malla`)
    }
    adj.get(de)!.push(a)
  }
  return adj
}

/**
 * Orden topológico (algoritmo de Kahn). Si la malla tiene un ciclo lanza un error,
 * porque entonces habría materias imposibles de inscribir.
 */
export function ordenTopologico(malla: Malla, incluirBlandas = false): string[] {
  const adj = construirGrafo(malla, incluirBlandas)
  const entrada = new Map<string, number>([...adj.keys()].map((id) => [id, 0]))
  for (const sucesores of adj.values()) {
    for (const v of sucesores) entrada.set(v, entrada.get(v)! + 1)
  }

  const cola = [...adj.keys()].filter((id) => entrada.get(id) === 0)
  const orden: string[] = []
  while (cola.length > 0) {
    const u = cola.shift()!
    orden.push(u)
    for (const v of adj.get(u)!) {
      entrada.set(v, entrada.get(v)! - 1)
      if (entrada.get(v) === 0) cola.push(v)
    }
  }

  if (orden.length !== adj.size) {
    const enCiclo = [...adj.keys()].filter((id) => !orden.includes(id))
    throw new Error(`La malla tiene un ciclo entre: ${enCiclo.join(', ')}`)
  }
  return orden
}

/**
 * Cadena de prerrequisitos más larga (en número de materias).
 * Su longitud es el mínimo de semestres para terminar esa cadena:
 * perder una materia de esta cadena retrasa la carrera.
 */
export function caminoMasLargo(malla: Malla): string[] {
  const adj = construirGrafo(malla)
  const orden = ordenTopologico(malla)
  const largo = new Map<string, number>(orden.map((id) => [id, 1]))
  const anterior = new Map<string, string>()

  for (const u of orden) {
    for (const v of adj.get(u)!) {
      if (largo.get(u)! + 1 > largo.get(v)!) {
        largo.set(v, largo.get(u)! + 1)
        anterior.set(v, u)
      }
    }
  }

  let fin = orden[0]
  for (const id of orden) if (largo.get(id)! > largo.get(fin)!) fin = id

  const camino = [fin]
  while (anterior.has(camino[0])) camino.unshift(anterior.get(camino[0])!)
  return camino
}

/** Grado de salida: cuántas materias abre directamente cada una. */
export function gradoSalida(malla: Malla): Record<string, number> {
  const adj = construirGrafo(malla)
  return Object.fromEntries([...adj].map(([id, suc]) => [id, suc.length]))
}

/**
 * Centralidad de intermediación (algoritmo de Brandes, grafo dirigido, sin normalizar):
 * cuántos caminos más cortos entre otras dos materias pasan por cada materia.
 */
export function intermediacion(malla: Malla): Record<string, number> {
  const adj = construirGrafo(malla)
  const nodos = [...adj.keys()]
  const C = new Map<string, number>(nodos.map((id) => [id, 0]))

  for (const s of nodos) {
    const pila: string[] = []
    const predecesores = new Map<string, string[]>(nodos.map((id) => [id, []]))
    const sigma = new Map<string, number>(nodos.map((id) => [id, 0]))
    const dist = new Map<string, number>(nodos.map((id) => [id, -1]))
    sigma.set(s, 1)
    dist.set(s, 0)

    // BFS: cuenta cuántos caminos más cortos llegan a cada nodo desde s.
    const cola = [s]
    while (cola.length > 0) {
      const v = cola.shift()!
      pila.push(v)
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          dist.set(w, dist.get(v)! + 1)
          cola.push(w)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!)
          predecesores.get(w)!.push(v)
        }
      }
    }

    // Acumulación hacia atrás de la dependencia de s en cada nodo.
    const delta = new Map<string, number>(nodos.map((id) => [id, 0]))
    while (pila.length > 0) {
      const w = pila.pop()!
      for (const v of predecesores.get(w)!) {
        const aporte = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!)
        delta.set(v, delta.get(v)! + aporte)
      }
      if (w !== s) C.set(w, C.get(w)! + delta.get(w)!)
    }
  }
  return Object.fromEntries(C)
}

/** Todas las materias que dependen (directa o indirectamente) de `id`. */
export function descendientes(malla: Malla, id: string): string[] {
  const adj = construirGrafo(malla)
  const vistos = new Set<string>()
  const pila = [...(adj.get(id) ?? [])]
  while (pila.length > 0) {
    const v = pila.pop()!
    if (vistos.has(v)) continue
    vistos.add(v)
    pila.push(...adj.get(v)!)
  }
  return [...vistos].sort()
}

/** Prerrequisitos directos de `id` (opcionalmente con aristas blandas). */
export function predecesores(malla: Malla, id: string, incluirBlandas = false): string[] {
  const aristas = incluirBlandas
    ? [...malla.prerrequisitos, ...malla.aristas_blandas]
    : malla.prerrequisitos
  return aristas.filter((e) => e.a === id).map((e) => e.de)
}
