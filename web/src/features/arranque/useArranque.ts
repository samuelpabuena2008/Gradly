// Ejecuta el arranque real (cargar malla → validar → precalcular → cargar pesos) y expone su progreso.

import { useCallback, useEffect, useState } from 'react'
import { cargarDatos, ErrorArranque, type Datos } from '../../lib/ui/arranque'

export type EstadoArranque =
  | { fase: 'cargando'; etapa: number }
  | { fase: 'error'; error: ErrorArranque }
  | { fase: 'listo'; datos: Datos }

const prefiereMovimientoReducido = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useArranque(): { estado: EstadoArranque; reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoArranque>({ fase: 'cargando', etapa: 0 })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    setEstado({ fase: 'cargando', etapa: 0 })
    cargarDatos(
      (etapa) => {
        if (!cancelado) setEstado({ fase: 'cargando', etapa })
      },
      // Con movimiento reducido no hay espera artificial: la duración es la del trabajo real.
      { minimoPorEtapaMs: prefiereMovimientoReducido() ? 0 : 180 },
    )
      .then((datos) => {
        if (!cancelado) setEstado({ fase: 'listo', datos })
      })
      .catch((e: unknown) => {
        if (cancelado) return
        const error = e instanceof ErrorArranque ? e : new ErrorArranque('No se pudo iniciar Gradly', String(e))
        setEstado({ fase: 'error', error })
      })
    return () => {
      cancelado = true
    }
  }, [intento])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])
  return { estado, reintentar }
}
