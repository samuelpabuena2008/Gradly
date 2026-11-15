// Cuenta breve («count-up») de un número cuando cambia, para que el cambio se note.
// Sin animación la primera vez, con movimiento reducido o si el valor no es finito.

import { useEffect, useRef, useState } from 'react'
import { prefiereMenosMovimiento } from '../lib/ui/movimiento'

export function useNumeroAnimado(objetivo: number | null, ms = 450): number | null {
  const [valor, setValor] = useState(objetivo)
  const actual = useRef(objetivo)

  useEffect(() => {
    const desde = actual.current
    if (
      objetivo === null ||
      desde === null ||
      !Number.isFinite(objetivo) ||
      !Number.isFinite(desde) ||
      desde === objetivo ||
      prefiereMenosMovimiento()
    ) {
      actual.current = objetivo
      setValor(objetivo)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const v = desde + (objetivo - desde) * (1 - (1 - k) ** 3)
      actual.current = v
      setValor(k >= 1 ? objetivo : v)
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [objetivo, ms])

  return valor
}
