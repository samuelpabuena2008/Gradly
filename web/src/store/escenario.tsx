// Contexto con los datos de la sesión (malla, modelo, análisis precalculado) y el escenario derivado:
// notas efectivas = reales + ajustes, y sus predicciones. Se calcula una sola vez por cambio y lo
// comparten todos los paneles (explorador, grafo, inspector, barra de estado).

import { createContext, useContext, useDeferredValue, useMemo, type ReactNode } from 'react'
import type { Nota, Prediccion } from '../types'
import type { Datos } from '../lib/ui/arranque'
import { nivel, predecirSiguientes, ultimasNotas, type TipoModelo } from '../lib/model/predict'
import { ajustesEfectivos, notasEfectivas } from '../lib/ui/escenario'
import { useApp } from './app'

const DatosContext = createContext<Datos | null>(null)

export function useDatos(): Datos {
  const datos = useContext(DatosContext)
  if (!datos) throw new Error('useDatos debe usarse dentro de <EscenarioProvider>')
  return datos
}

export interface Escenario {
  /** Modelo en uso (el elegido o, si no hay elección, el recomendado). */
  tipoModelo: TipoModelo
  /** Notas que ve el modelo: reales + ajustes. */
  notas: Nota[]
  /** Nota vigente por materia (con ajustes). */
  mapaNotas: Map<string, number>
  /** Nota vigente por materia solo con lo importado. */
  mapaReales: Map<string, number>
  predicciones: Prediccion[]
  prediccionPorId: Map<string, Prediccion>
  /** Predicciones y promedio solo con lo importado (sin el escenario), para mostrar «antes → después». */
  prediccionesBase: Prediccion[]
  promedioBase: number | null
  /** Materias cuya nota vigente es hipotética (viene de un ajuste y no de lo importado). */
  hipoteticas: Set<string>
  /** Hay ajustes que cambian algo: se está viendo un escenario hipotético. */
  hipotetico: boolean
  /** Promedio de las notas vigentes; `null` si no hay notas. */
  promedio: number | null
  /** Nivel del estudiante (a); `null` si no hay notas. */
  nivel: number | null
}

const EscenarioContext = createContext<Escenario | null>(null)

export function useEscenario(): Escenario {
  const e = useContext(EscenarioContext)
  if (!e) throw new Error('useEscenario debe usarse dentro de <EscenarioProvider>')
  return e
}

export function EscenarioProvider({ datos, children }: { datos: Datos; children: ReactNode }) {
  const notasReales = useApp((s) => s.notasReales)
  // Arrastrar el simulador no debe bloquear la entrada: el escenario se recalcula con prioridad baja.
  const ajustes = useDeferredValue(useApp((s) => s.ajustes))
  const elegido = useApp((s) => s.tipoModelo)
  const tipoModelo = elegido ?? datos.recomendado
  const { malla, modelo } = datos

  const efectivos = useMemo(() => ajustesEfectivos(notasReales, ajustes), [notasReales, ajustes])
  const notas = useMemo(() => notasEfectivas(notasReales, efectivos), [notasReales, efectivos])
  const mapaNotas = useMemo(() => ultimasNotas(notas), [notas])
  const mapaReales = useMemo(() => ultimasNotas(notasReales), [notasReales])
  const predicciones = useMemo(
    () => predecirSiguientes(malla, modelo, notas, tipoModelo),
    [malla, modelo, notas, tipoModelo],
  )
  const prediccionPorId = useMemo(() => new Map(predicciones.map((p) => [p.materia, p])), [predicciones])
  const hipotetico = Object.keys(efectivos).length > 0
  // Sin escenario, «antes» y «después» son lo mismo: no se calcula dos veces.
  const prediccionesBase = useMemo(
    () => (hipotetico ? predecirSiguientes(malla, modelo, notasReales, tipoModelo) : predicciones),
    [hipotetico, malla, modelo, notasReales, tipoModelo, predicciones],
  )
  const hipoteticas = useMemo(() => new Set(Object.keys(efectivos)), [efectivos])

  const escenario = useMemo<Escenario>(() => {
    const valores = [...mapaNotas.values()]
    const reales = [...mapaReales.values()]
    return {
      tipoModelo,
      notas,
      mapaNotas,
      mapaReales,
      predicciones,
      prediccionPorId,
      prediccionesBase,
      promedioBase: reales.length > 0 ? reales.reduce((a, b) => a + b, 0) / reales.length : null,
      hipoteticas,
      hipotetico,
      promedio: valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
      nivel: valores.length > 0 ? nivel(modelo, mapaNotas) : null,
    }
  }, [tipoModelo, notas, mapaNotas, mapaReales, predicciones, prediccionPorId, prediccionesBase, hipoteticas, hipotetico, modelo])

  return (
    <DatosContext.Provider value={datos}>
      <EscenarioContext.Provider value={escenario}>{children}</EscenarioContext.Provider>
    </DatosContext.Provider>
  )
}
