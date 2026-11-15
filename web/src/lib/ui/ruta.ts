// Enrutamiento por hash: #/malla, #/notas, #/predicciones, #/laboratorio, #/modelo, #/materia/MAT1101.
// Nunca se ponen notas en la URL: solo la vista y el código de una materia.

export const VISTAS = ['malla', 'notas', 'predicciones', 'laboratorio', 'modelo'] as const
export type Vista = (typeof VISTAS)[number]

export type Ruta = { tipo: 'vista'; vista: Vista } | { tipo: 'materia'; id: string }

export const RUTA_INICIAL: Ruta = { tipo: 'vista', vista: 'malla' }

const ID_MATERIA = /^[A-Za-z0-9]{3,12}$/

/** Interpreta un hash (con o sin «#»). Cualquier cosa desconocida cae en la malla. */
export function parsearHash(hash: string): Ruta {
  const limpio = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  const [primero, segundo] = limpio.split('/')
  if (primero === 'materia' && segundo) {
    let id: string
    try {
      id = decodeURIComponent(segundo)
    } catch {
      return RUTA_INICIAL
    }
    return ID_MATERIA.test(id) ? { tipo: 'materia', id: id.toUpperCase() } : RUTA_INICIAL
  }
  if ((VISTAS as readonly string[]).includes(primero)) {
    return { tipo: 'vista', vista: primero as Vista }
  }
  return RUTA_INICIAL
}

export function rutaAHash(ruta: Ruta): string {
  return ruta.tipo === 'materia' ? `#/materia/${ruta.id}` : `#/${ruta.vista}`
}

export function mismaRuta(a: Ruta, b: Ruta): boolean {
  if (a.tipo === 'materia' && b.tipo === 'materia') return a.id === b.id
  if (a.tipo === 'vista' && b.tipo === 'vista') return a.vista === b.vista
  return false
}
