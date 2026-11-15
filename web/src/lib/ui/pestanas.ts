// Pestañas de materia del centro del espacio de trabajo (máximo 8; la más antigua se reemplaza).

export const MAX_PESTANAS = 8

export function abrirPestana(pestanas: string[], id: string, max = MAX_PESTANAS): string[] {
  if (pestanas.includes(id)) return pestanas
  const nuevas = [...pestanas, id]
  return nuevas.length > max ? nuevas.slice(nuevas.length - max) : nuevas
}

export function cerrarPestana(pestanas: string[], id: string): string[] {
  return pestanas.filter((p) => p !== id)
}

/** Pestaña que queda activa al cerrar `id`: la vecina a la derecha, si no a la izquierda, si no la malla. */
export function siguienteTrasCerrar(pestanas: string[], id: string): string | null {
  const i = pestanas.indexOf(id)
  if (i < 0) return null
  return pestanas[i + 1] ?? pestanas[i - 1] ?? null
}

export function moverPestana(pestanas: string[], id: string, haciaIndice: number): string[] {
  const desde = pestanas.indexOf(id)
  if (desde < 0) return pestanas
  const destino = Math.max(0, Math.min(pestanas.length - 1, haciaIndice))
  if (destino === desde) return pestanas
  const copia = [...pestanas]
  copia.splice(desde, 1)
  copia.splice(destino, 0, id)
  return copia
}
