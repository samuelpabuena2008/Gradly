// Confirmaciones de acciones destructivas (borrar datos). Un solo diálogo global.

import { create } from 'zustand'

export interface Confirmacion {
  titulo: string
  mensaje: string
  etiquetaConfirmar: string
  alConfirmar: () => void
}

interface Estado {
  pendiente: Confirmacion | null
  pedir: (c: Confirmacion) => void
  cerrar: () => void
}

export const useConfirmacion = create<Estado>()((set) => ({
  pendiente: null,
  pedir: (pendiente) => set({ pendiente }),
  cerrar: () => set({ pendiente: null }),
}))
