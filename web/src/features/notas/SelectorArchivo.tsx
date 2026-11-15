// Botón que abre el selector de archivos del sistema. El <input> se REINICIA tras cada selección:
// sin eso, volver a elegir el mismo archivo no dispararía `onChange` y parecería que no pasa nada.

import { useCallback, useRef, type ReactElement } from 'react'

interface Resultado {
  abrir: () => void
  input: ReactElement
}

export function useSelectorArchivo(accept: string, etiqueta: string, alElegir: (archivo: File) => void): Resultado {
  const ref = useRef<HTMLInputElement>(null)
  const abrir = useCallback(() => ref.current?.click(), [])
  const input = (
    <input
      ref={ref}
      type="file"
      className="solo-lectores"
      accept={accept}
      aria-label={etiqueta}
      tabIndex={-1}
      onChange={(e) => {
        const archivo = e.target.files?.[0]
        // Se reinicia antes de leer: así se puede volver a elegir el mismo archivo.
        e.target.value = ''
        if (archivo) alElegir(archivo)
      }}
    />
  )
  return { abrir, input }
}
