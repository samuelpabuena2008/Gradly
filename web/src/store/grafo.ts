// Preferencias de la vista de grafo (filtros, resaltados, apariencia, disposición).
// Son preferencias de interfaz: se guardan en localStorage si se puede; nunca incluyen notas.

import { create } from 'zustand'
import { guardarJson, leerJson } from '../lib/ui/almacenamiento'
import type { TamanoNodo } from '../lib/ui/grafo'

export type Disposicion = 'semestre' | 'organico'
export type ColorearPor = 'estado' | 'semestre'
/** Pedidos al grafo desde fuera (paleta de comandos): se atienden cuando el lienzo está montado. */
export type SolicitudGrafo = 'ajustar' | 'exportar' | 'restablecer'

export interface PrefsGrafo {
  blandas: boolean
  soloDisponibles: boolean
  ocultarBloqueadas: boolean
  cadena: boolean
  flujo: boolean
  cuellos: boolean
  descendientes: boolean
  tamano: TamanoNodo
  /** Grosor de las aristas en px. */
  grosor: number
  /** Zoom por debajo del cual se ocultan las etiquetas. */
  umbralTexto: number
  colorearPor: ColorearPor
  disposicion: Disposicion
  minimapa: boolean
  panelAbierto: boolean
}

export const LIMITES_GROSOR = { min: 0.5, max: 3, paso: 0.25 } as const
export const LIMITES_UMBRAL = { min: 0, max: 1.2, paso: 0.05 } as const

export const PREFS_GRAFO_INICIALES: PrefsGrafo = {
  blandas: true,
  soloDisponibles: false,
  ocultarBloqueadas: false,
  cadena: false,
  flujo: false,
  cuellos: false,
  descendientes: false,
  tamano: 'creditos',
  grosor: 1.25,
  umbralTexto: 0.45,
  colorearPor: 'estado',
  disposicion: 'semestre',
  minimapa: true,
  panelAbierto: false,
}

const CLAVE = 'gradly:grafo'

const limitar = (v: unknown, { min, max }: { min: number; max: number }, porDefecto: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : porDefecto

/** Lee las preferencias guardadas validando cada campo; un valor corrupto vuelve al predeterminado. */
export function leerPrefsGrafo(): PrefsGrafo {
  const g = leerJson<Partial<Record<keyof PrefsGrafo, unknown>>>(CLAVE, {})
  const base = PREFS_GRAFO_INICIALES
  const bool = (k: keyof PrefsGrafo) => (typeof g?.[k] === 'boolean' ? (g[k] as boolean) : (base[k] as boolean))
  const uno = <T extends string>(v: unknown, opciones: readonly T[], d: T): T => (opciones.includes(v as T) ? (v as T) : d)
  return {
    blandas: bool('blandas'),
    soloDisponibles: bool('soloDisponibles'),
    ocultarBloqueadas: bool('ocultarBloqueadas'),
    cadena: bool('cadena'),
    flujo: bool('flujo'),
    cuellos: bool('cuellos'),
    descendientes: bool('descendientes'),
    tamano: uno(g?.tamano, ['creditos', 'intermediacion', 'uniforme'] as const, base.tamano),
    grosor: limitar(g?.grosor, LIMITES_GROSOR, base.grosor),
    umbralTexto: limitar(g?.umbralTexto, LIMITES_UMBRAL, base.umbralTexto),
    colorearPor: uno(g?.colorearPor, ['estado', 'semestre'] as const, base.colorearPor),
    disposicion: uno(g?.disposicion, ['semestre', 'organico'] as const, base.disposicion),
    minimapa: bool('minimapa'),
    panelAbierto: bool('panelAbierto'),
  }
}

interface EstadoGrafo extends PrefsGrafo {
  /** Texto del buscador del grafo (no se guarda). */
  busqueda: string
  solicitud: SolicitudGrafo | null
  fijar: <K extends keyof PrefsGrafo>(clave: K, valor: PrefsGrafo[K]) => void
  alternar: (clave: { [K in keyof PrefsGrafo]: PrefsGrafo[K] extends boolean ? K : never }[keyof PrefsGrafo]) => void
  buscar: (texto: string) => void
  solicitar: (s: SolicitudGrafo | null) => void
  restablecerPrefs: () => void
}

export const useGrafo = create<EstadoGrafo>()((set) => ({
  ...leerPrefsGrafo(),
  busqueda: '',
  solicitud: null,
  fijar: (clave, valor) => set({ [clave]: valor } as Partial<PrefsGrafo>),
  alternar: (clave) => set((s) => ({ [clave]: !s[clave] }) as Partial<PrefsGrafo>),
  buscar: (busqueda) => set({ busqueda }),
  solicitar: (solicitud) => set({ solicitud }),
  restablecerPrefs: () => set((s) => ({ ...PREFS_GRAFO_INICIALES, panelAbierto: s.panelAbierto })),
}))

let anterior = ''
useGrafo.subscribe((s) => {
  const prefs = Object.fromEntries(Object.keys(PREFS_GRAFO_INICIALES).map((k) => [k, s[k as keyof PrefsGrafo]]))
  const serializado = JSON.stringify(prefs)
  if (serializado === anterior) return
  anterior = serializado
  guardarJson(CLAVE, prefs)
})
