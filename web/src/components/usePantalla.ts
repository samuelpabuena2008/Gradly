// Modo de pantalla reactivo: se actualiza al girar el dispositivo o redimensionar la ventana.

import { useSyncExternalStore } from 'react'
import { CONSULTA_AMPLIO, CONSULTA_MEDIO, modoActual, type ModoPantalla } from '../lib/ui/pantalla'

function suscribir(avisar: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const listas = [window.matchMedia(CONSULTA_AMPLIO), window.matchMedia(CONSULTA_MEDIO)]
  listas.forEach((l) => l.addEventListener('change', avisar))
  return () => listas.forEach((l) => l.removeEventListener('change', avisar))
}

export function usePantalla(): ModoPantalla {
  return useSyncExternalStore(suscribir, modoActual, () => 'amplio')
}
