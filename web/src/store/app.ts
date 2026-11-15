// Estado de la aplicación (zustand). Separa lo que el estudiante importó (`notasReales`, fuente de
// verdad) de sus hipótesis del simulador (`ajustes`). Las notas efectivas son derivadas, ver escenario.tsx.
//
// Privacidad: solo las preferencias de interfaz (paneles, anchos) se guardan en localStorage.
// Las notas viven únicamente en memoria hasta que el usuario active la persistencia (opt-in, Ajustes).

import { create } from 'zustand'
import type { Nota } from '../types'
import type { TipoModelo } from '../lib/model/predict'
import type { Ajustes } from '../lib/ui/escenario'
import { guardarJson, leerJson } from '../lib/ui/almacenamiento'
import { agregarNota as agregarANotas, fusionarNotas, claveNota, type ResultadoAgregar } from '../lib/ui/notas'
import { abrirPestana, cerrarPestana, moverPestana } from '../lib/ui/pestanas'
import {
  borrarNotasGuardadas,
  fijarPersistencia,
  guardarNotas,
  leerNotasGuardadas,
  persistenciaActiva,
} from '../lib/ui/persistencia'

export type TabInspector = 'detalle' | 'simulador' | 'analisis'

export const LIMITES_PANEL = {
  explorador: { min: 220, max: 480, inicial: 280 },
  inspector: { min: 300, max: 560, inicial: 360 },
} as const

const CLAVE_PREFS = 'gradly:prefs'

interface Prefs {
  exploradorAbierto: boolean
  inspectorAbierto: boolean
  anchoExplorador: number
  anchoInspector: number
  tabInspector: TabInspector
}

/** En pantallas estrechas los paneles laterales empiezan cerrados (son cajones superpuestos). */
function prefsIniciales(): Prefs {
  const ancho = typeof window === 'undefined' ? 1440 : window.innerWidth
  return {
    exploradorAbierto: ancho >= 900,
    inspectorAbierto: ancho >= 1280,
    anchoExplorador: LIMITES_PANEL.explorador.inicial,
    anchoInspector: LIMITES_PANEL.inspector.inicial,
    tabInspector: 'detalle',
  }
}

export function limitarAncho(panel: keyof typeof LIMITES_PANEL, ancho: number): number {
  const { min, max, inicial } = LIMITES_PANEL[panel]
  if (!Number.isFinite(ancho)) return inicial
  return Math.min(max, Math.max(min, Math.round(ancho)))
}

/** Lee las preferencias guardadas validando cada campo (un valor corrupto no rompe nada). */
export function leerPrefs(): Prefs {
  const base = prefsIniciales()
  const g = leerJson<Partial<Record<keyof Prefs, unknown>>>(CLAVE_PREFS, {})
  const tabs: TabInspector[] = ['detalle', 'simulador', 'analisis']
  return {
    exploradorAbierto: typeof g.exploradorAbierto === 'boolean' ? g.exploradorAbierto : base.exploradorAbierto,
    inspectorAbierto: typeof g.inspectorAbierto === 'boolean' ? g.inspectorAbierto : base.inspectorAbierto,
    anchoExplorador: limitarAncho('explorador', Number(g.anchoExplorador ?? NaN)),
    anchoInspector: limitarAncho('inspector', Number(g.anchoInspector ?? NaN)),
    tabInspector: tabs.includes(g.tabInspector as TabInspector) ? (g.tabInspector as TabInspector) : 'detalle',
  }
}

interface Estado extends Prefs {
  /** Lo que importó el estudiante. Solo cambian las acciones de importación/edición explícitas. */
  notasReales: Nota[]
  /** Escenario hipotético del simulador: materia → nota. Vacío = sin simulación. */
  ajustes: Ajustes
  /** `null` = usar el modelo recomendado por la validación cruzada. */
  tipoModelo: TipoModelo | null
  seleccionada: string | null
  pestanas: string[]
  paletaAbierta: boolean
  atajosAbiertos: boolean
  /** Opt-in: recordar las notas en este navegador. Apagado por defecto. */
  persistirNotas: boolean
  /** El recorrido guiado se está mostrando. */
  recorridoAbierto: boolean
  /** El usuario prefirió explorar la malla antes de cargar notas (solo esta sesión). */
  bienvenidaDescartada: boolean

  reemplazarNotas: (notas: Nota[]) => void
  /** Suma notas a las existentes (el mismo intento de la misma materia y periodo lo reemplaza el nuevo). */
  combinarNotas: (notas: Nota[]) => void
  agregarNota: (nota: Nota) => ResultadoAgregar
  quitarNota: (materia: string, periodo: string) => void
  editarNota: (materia: string, periodo: string, valor: number) => void
  borrarNotas: () => void
  fijarAjuste: (materia: string, nota: number) => void
  quitarAjuste: (materia: string) => void
  restaurarAjustes: () => void
  elegirModelo: (tipo: TipoModelo) => void
  seleccionar: (id: string | null) => void
  abrirMateria: (id: string) => void
  cerrarMateria: (id: string) => void
  moverMateria: (id: string, indice: number) => void
  alternarExplorador: (abierto?: boolean) => void
  alternarInspector: (abierto?: boolean) => void
  fijarAnchoExplorador: (ancho: number) => void
  fijarAnchoInspector: (ancho: number) => void
  elegirTabInspector: (tab: TabInspector) => void
  abrirPaleta: (abierta?: boolean) => void
  abrirAtajos: (abiertos?: boolean) => void
  fijarPersistirNotas: (activa: boolean) => void
  abrirRecorrido: (abierto?: boolean) => void
  descartarBienvenida: () => void
}

export const useApp = create<Estado>()((set, get) => ({
  ...leerPrefs(),
  persistirNotas: persistenciaActiva(),
  // Con la persistencia activada (opt-in) las notas guardadas se recuperan al abrir.
  notasReales: persistenciaActiva() ? leerNotasGuardadas() : [],
  ajustes: {},
  tipoModelo: null,
  seleccionada: null,
  pestanas: [],
  paletaAbierta: false,
  atajosAbiertos: false,
  recorridoAbierto: false,
  bienvenidaDescartada: false,

  // Cambiar las notas reales descarta el escenario hipotético: ya no corresponde a esos datos.
  reemplazarNotas: (notas) => set({ notasReales: notas, ajustes: {} }),
  combinarNotas: (nuevas) => set((s) => ({ notasReales: fusionarNotas(s.notasReales, nuevas), ajustes: {} })),
  agregarNota: (nota) => {
    const r = agregarANotas(get().notasReales, nota)
    if (r.resultado !== 'duplicada') set({ notasReales: r.notas, ajustes: {} })
    return r.resultado
  },
  quitarNota: (materia, periodo) =>
    set((s) => {
      const clave = claveNota({ materia, periodo })
      return { notasReales: s.notasReales.filter((n) => claveNota(n) !== clave), ajustes: {} }
    }),
  editarNota: (materia, periodo, valor) =>
    set((s) => ({
      notasReales: s.notasReales.map((n) => (n.materia === materia && n.periodo === periodo ? { ...n, nota: valor } : n)),
      ajustes: {},
    })),
  borrarNotas: () => set({ notasReales: [], ajustes: {}, seleccionada: null }),
  fijarAjuste: (materia, nota) => set((s) => ({ ajustes: { ...s.ajustes, [materia]: nota } })),
  quitarAjuste: (materia) =>
    set((s) => {
      const { [materia]: _quitada, ...resto } = s.ajustes
      return { ajustes: resto }
    }),
  restaurarAjustes: () => set({ ajustes: {} }),
  elegirModelo: (tipoModelo) => set({ tipoModelo }),
  seleccionar: (seleccionada) => set({ seleccionada }),
  abrirMateria: (id) => set((s) => ({ seleccionada: id, pestanas: abrirPestana(s.pestanas, id) })),
  cerrarMateria: (id) => set((s) => ({ pestanas: cerrarPestana(s.pestanas, id) })),
  moverMateria: (id, indice) => set((s) => ({ pestanas: moverPestana(s.pestanas, id, indice) })),
  alternarExplorador: (abierto) => set((s) => ({ exploradorAbierto: abierto ?? !s.exploradorAbierto })),
  alternarInspector: (abierto) => set((s) => ({ inspectorAbierto: abierto ?? !s.inspectorAbierto })),
  fijarAnchoExplorador: (ancho) => set({ anchoExplorador: limitarAncho('explorador', ancho) }),
  fijarAnchoInspector: (ancho) => set({ anchoInspector: limitarAncho('inspector', ancho) }),
  elegirTabInspector: (tabInspector) => set({ tabInspector }),
  abrirPaleta: (abierta) => set((s) => ({ paletaAbierta: abierta ?? !s.paletaAbierta })),
  abrirAtajos: (abiertos) => set((s) => ({ atajosAbiertos: abiertos ?? !s.atajosAbiertos })),
  fijarPersistirNotas: (persistirNotas) => set({ persistirNotas }),
  abrirRecorrido: (abierto) => set((s) => ({ recorridoAbierto: abierto ?? !s.recorridoAbierto })),
  descartarBienvenida: () => set({ bienvenidaDescartada: true }),
}))

// Persistencia de preferencias de interfaz (nunca de notas).
let anterior = ''
useApp.subscribe((s) => {
  const prefs: Prefs = {
    exploradorAbierto: s.exploradorAbierto,
    inspectorAbierto: s.inspectorAbierto,
    anchoExplorador: s.anchoExplorador,
    anchoInspector: s.anchoInspector,
    tabInspector: s.tabInspector,
  }
  const serializado = JSON.stringify(prefs)
  if (serializado === anterior) return
  anterior = serializado
  guardarJson(CLAVE_PREFS, prefs)
})

// Persistencia OPCIONAL de las notas: solo mientras el usuario la mantenga activada en Ajustes.
useApp.subscribe((s, anterior) => {
  if (s.persistirNotas !== anterior.persistirNotas) {
    fijarPersistencia(s.persistirNotas)
    if (s.persistirNotas) guardarNotas(s.notasReales)
    return
  }
  if (s.persistirNotas && s.notasReales !== anterior.notasReales) {
    if (s.notasReales.length === 0) borrarNotasGuardadas()
    else guardarNotas(s.notasReales)
  }
})
