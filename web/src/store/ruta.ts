// Hook del router por hash. Suscribe a `hashchange` y expone la ruta ya interpretada.

import { useMemo, useSyncExternalStore } from 'react'
import { parsearHash, rutaAHash, type Ruta } from '../lib/ui/ruta'

function suscribir(alCambiar: () => void) {
  window.addEventListener('hashchange', alCambiar)
  return () => window.removeEventListener('hashchange', alCambiar)
}

const leerHash = () => window.location.hash
const hashServidor = () => ''

export function useRuta(): Ruta {
  const hash = useSyncExternalStore(suscribir, leerHash, hashServidor)
  return useMemo(() => parsearHash(hash), [hash])
}

/** Cambia de ruta (agrega una entrada al historial para que «atrás» funcione). */
export function navegar(ruta: Ruta): void {
  const hash = rutaAHash(ruta)
  if (window.location.hash !== hash) window.location.hash = hash
}

/** Cambia de ruta sin agregar una entrada al historial. */
export function reemplazarRuta(ruta: Ruta): void {
  const url = new URL(window.location.href)
  url.hash = rutaAHash(ruta)
  window.history.replaceState(null, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
