// Medidas de los nodos del grafo. El círculo va centrado arriba y la etiqueta debajo.
// Las posiciones del layout son centros de círculo; React Flow usa la esquina superior izquierda.

import type { Punto } from '../../lib/ui/layoutMalla'

/** Ancho fijo del nodo (cabe la etiqueta truncada). */
export const ANCHO_NODO = 136
/** Espacio alrededor del círculo para el aro de selección y el halo de cuello de botella. */
export const MARGEN_NODO = 8
/** Alto reservado para la etiqueta (nombre + valor). */
export const ALTO_ETIQUETA = 34

export const altoNodo = (radio: number) => 2 * (radio + MARGEN_NODO) + ALTO_ETIQUETA

/** Esquina superior izquierda del nodo a partir del centro de su círculo. */
export const esquinaDesdeCentro = (c: Punto, radio: number): Punto => ({
  x: c.x - ANCHO_NODO / 2,
  y: c.y - radio - MARGEN_NODO,
})

/** Centro del círculo a partir de la esquina del nodo. */
export const centroDesdeEsquina = (p: Punto, radio: number): Punto => ({
  x: p.x + ANCHO_NODO / 2,
  y: p.y + radio + MARGEN_NODO,
})
