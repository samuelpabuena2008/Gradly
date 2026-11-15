// Publica el zoom actual como variable CSS (--zoom) en el contenedor del grafo, sin re-renderizar
// el lienzo. Lo usan las piezas que deben verse a tamaño de pantalla (la tarjeta del hover).

import { useEffect, type RefObject } from 'react'
import { useStore } from '@xyflow/react'

export function VariableZoom({ contenedor }: { contenedor: RefObject<HTMLElement | null> }) {
  const zoom = useStore((s) => s.transform[2])
  useEffect(() => {
    contenedor.current?.style.setProperty('--zoom', String(zoom > 0 ? zoom : 1))
  }, [zoom, contenedor])
  return null
}
