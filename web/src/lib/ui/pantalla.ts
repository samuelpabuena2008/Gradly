// Modo de pantalla del espacio de trabajo (§9.1): amplio (3 paneles), medio (el inspector es un cajón)
// y móvil (barra inferior, hojas inferiores y lista de materias).

export type ModoPantalla = 'amplio' | 'medio' | 'movil'

export const ANCHO_AMPLIO = 1280
export const ANCHO_MEDIO = 900

export function modoDePantalla(ancho: number): ModoPantalla {
  if (!Number.isFinite(ancho)) return 'amplio'
  if (ancho >= ANCHO_AMPLIO) return 'amplio'
  if (ancho >= ANCHO_MEDIO) return 'medio'
  return 'movil'
}

/** Consultas de medios equivalentes a `modoDePantalla`, para suscribirse a los cambios. */
export const CONSULTA_AMPLIO = `(min-width: ${ANCHO_AMPLIO}px)`
export const CONSULTA_MEDIO = `(min-width: ${ANCHO_MEDIO}px)`

/** Modo actual del navegador. Sin `matchMedia` (pruebas en jsdom, render en servidor) se asume pantalla amplia. */
export function modoActual(): ModoPantalla {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'amplio'
  if (window.matchMedia(CONSULTA_AMPLIO).matches) return 'amplio'
  return window.matchMedia(CONSULTA_MEDIO).matches ? 'medio' : 'movil'
}

export const esMovil = (): boolean => modoActual() === 'movil'

/** Distancia (px) y tiempo (ms) de un gesto de arrastre hacia abajo que cierra una hoja inferior. */
export const UMBRAL_CIERRE_PX = 96
const VELOCIDAD_CIERRE = 0.6

/** ¿Un arrastre vertical de `dy` px en `ms` ms debe cerrar la hoja? (hacia abajo y largo o rápido) */
export function debeCerrarHoja(dy: number, ms: number): boolean {
  if (!Number.isFinite(dy) || dy <= 0) return false
  if (dy >= UMBRAL_CIERRE_PX) return true
  return ms > 0 && dy >= 24 && dy / ms >= VELOCIDAD_CIERRE
}
