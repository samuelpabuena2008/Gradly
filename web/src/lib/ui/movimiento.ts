// Preferencia de movimiento reducido del sistema operativo.

export function prefiereMenosMovimiento(): boolean {
  try {
    return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  } catch {
    return false
  }
}

/** Duración de una animación: 0 si el usuario pidió menos movimiento. */
export const duracion = (ms: number): number => (prefiereMenosMovimiento() ? 0 : ms)
