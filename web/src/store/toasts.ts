// Avisos breves (toasts), con acción opcional como «Deshacer». Se anuncian con aria-live.

import { create } from 'zustand'

export interface Toast {
  id: number
  mensaje: string
  accion?: { etiqueta: string; alHacerClic: () => void }
  /** Milisegundos visible. */
  duracion: number
}

interface EstadoToasts {
  toasts: Toast[]
  mostrar: (t: Omit<Toast, 'id' | 'duracion'> & { duracion?: number }) => number
  cerrar: (id: number) => void
}

let siguiente = 1

export const useToasts = create<EstadoToasts>()((set) => ({
  toasts: [],
  mostrar: ({ duracion = 6000, ...resto }) => {
    const id = siguiente++
    // Máximo 3 visibles: el más antiguo cede su lugar.
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, duracion, ...resto }] }))
    return id
  },
  cerrar: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const avisar = (mensaje: string, opciones: { accion?: Toast['accion']; duracion?: number } = {}) =>
  useToasts.getState().mostrar({ mensaje, ...opciones })
