// Estado de cada materia para la interfaz (nodos del grafo, explorador, páginas de materia).

import type { Malla, Prediccion } from '../../types'

export type TipoEstado = 'aprobada' | 'reprobada' | 'disponible' | 'bloqueada'

export interface EstadoMateria {
  tipo: TipoEstado
  /** Nota obtenida (aprobada o reprobada). */
  nota?: number
  prediccion?: Prediccion
}

/**
 * Deriva el estado de una materia a partir de las notas vigentes y las predicciones.
 * Con intento previo cuenta el más reciente: si está reprobado se muestra como `reprobada`.
 */
export function estadoMateria(
  id: string,
  malla: Malla,
  notas: Map<string, number>,
  predicciones: Map<string, Prediccion>,
): EstadoMateria {
  const nota = notas.get(id)
  if (nota !== undefined) {
    return { tipo: nota >= malla.nota_aprobacion ? 'aprobada' : 'reprobada', nota }
  }
  const prediccion = predicciones.get(id)
  if (prediccion) return { tipo: 'disponible', prediccion }
  return { tipo: 'bloqueada' }
}

/** Valor principal de la materia (su nota o su predicción) con un decimal; `null` si no hay. */
export function valorMateria(estado: EstadoMateria): string | null {
  if (estado.nota !== undefined && Number.isFinite(estado.nota)) return estado.nota.toFixed(1)
  if (estado.prediccion && Number.isFinite(estado.prediccion.nota)) return estado.prediccion.nota.toFixed(1)
  return null
}

export const ETIQUETA_SEMAFORO = {
  verde: 'Vas bien preparado',
  amarillo: 'Conviene reforzar',
  rojo: 'Dale prioridad',
} as const

/** Describe el nivel del estudiante (a) en lenguaje claro, sin juicios. */
export function describirNivel(a: number): string {
  if (!Number.isFinite(a)) return 'Nivel por estimar'
  if (a >= 0.4) return 'Nivel muy por encima del promedio'
  if (a >= 0.12) return 'Nivel por encima del promedio'
  if (a > -0.12) return 'Nivel cerca del promedio'
  if (a > -0.4) return 'Nivel por debajo del promedio'
  return 'Nivel muy por debajo del promedio'
}
