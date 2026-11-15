// Estado del flujo de importación: leyendo → revisión (tabla editable) → confirmar. Un solo flujo
// global, para que arrastrar un archivo a cualquier parte de la ventana funcione igual que el botón.

import { create } from 'zustand'
import type { ErrorMostrable } from '../lib/ui/archivo'
import type { Lectura, Origen } from '../lib/ui/lectura'
import { aFilasRevision, type FilaRevision } from '../lib/ui/notas'

export type FaseImportacion = 'inactivo' | 'leyendo' | 'revision' | 'vacio' | 'error'
export type ModoImportacion = 'reemplazar' | 'combinar'

/** Qué pasó en la última importación confirmada (se muestra en la vista Notas). */
export interface ResumenImportacion {
  notas: number
  nombre?: string
  origen: Origen
  /** Todo lo que conviene saber: avisos del lector, filas que no se pudieron leer y filas omitidas. */
  avisos: string[]
}

interface Estado {
  fase: FaseImportacion
  /** Texto de progreso mientras se lee. */
  mensaje: string
  origen: Origen | null
  nombre?: string
  filas: FilaRevision[]
  /** Del lector: avisos (electivas mapeadas…) y errores (filas que no se pudieron leer). */
  avisos: string[]
  errores: string[]
  error: ErrorMostrable | null
  modo: ModoImportacion
  resumen: ResumenImportacion | null
  /** Diálogo para pegar texto. */
  pegarAbierto: boolean
  /** Hay algo arrastrándose sobre la ventana. */
  arrastrando: boolean

  empezar: (mensaje: string, nombre?: string, origen?: Origen) => void
  mostrarLectura: (lectura: Lectura) => void
  fallar: (error: ErrorMostrable) => void
  editarFila: (id: number, cambios: Partial<Omit<FilaRevision, 'id'>>) => void
  quitarFila: (id: number) => void
  elegirModo: (modo: ModoImportacion) => void
  fijarResumen: (resumen: ResumenImportacion | null) => void
  cerrar: () => void
  abrirPegar: (abierto: boolean) => void
  fijarArrastrando: (arrastrando: boolean) => void
}

const VACIO = {
  fase: 'inactivo' as FaseImportacion,
  mensaje: '',
  origen: null as Origen | null,
  nombre: undefined as string | undefined,
  filas: [] as FilaRevision[],
  avisos: [] as string[],
  errores: [] as string[],
  error: null as ErrorMostrable | null,
}

export const useImportacion = create<Estado>()((set) => ({
  ...VACIO,
  modo: 'reemplazar',
  resumen: null,
  pegarAbierto: false,
  arrastrando: false,

  empezar: (mensaje, nombre, origen) => set({ ...VACIO, fase: 'leyendo', mensaje, nombre, origen: origen ?? null }),
  mostrarLectura: (l) =>
    set({
      fase: l.notas.length === 0 ? 'vacio' : 'revision',
      origen: l.origen,
      nombre: l.nombre,
      filas: aFilasRevision(l.notas),
      avisos: l.avisos,
      errores: l.errores,
      error: null,
    }),
  fallar: (error) => set({ ...VACIO, fase: 'error', error }),
  editarFila: (id, cambios) => set((s) => ({ filas: s.filas.map((f) => (f.id === id ? { ...f, ...cambios } : f)) })),
  quitarFila: (id) => set((s) => ({ filas: s.filas.filter((f) => f.id !== id) })),
  elegirModo: (modo) => set({ modo }),
  fijarResumen: (resumen) => set({ resumen }),
  cerrar: () => set({ ...VACIO }),
  abrirPegar: (pegarAbierto) => set({ pegarAbierto }),
  fijarArrastrando: (arrastrando) => set({ arrastrando }),
}))
