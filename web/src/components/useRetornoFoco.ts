// Retorno de foco para diálogos controlados desde el estado.
//
// Radix devuelve el foco al `Trigger` que abrió el diálogo, pero aquí los diálogos se abren desde el
// estado (un botón, un atajo, la paleta de comandos): no hay Trigger, y el foco caía en <body>. Quien
// usa teclado o lector de pantalla perdía su sitio. Este hook recuerda el elemento enfocado al abrir y
// lo devuelve al cerrar (WCAG 2.4.3, orden del foco). Se esparce sobre `Dialog.Content`.

import { useMemo, useRef } from 'react'

export function useRetornoFoco() {
  const quienAbrio = useRef<HTMLElement | null>(null)
  return useMemo(
    () => ({
      onOpenAutoFocus: () => {
        const activo = document.activeElement
        quienAbrio.current = activo instanceof HTMLElement && activo !== document.body ? activo : null
      },
      onCloseAutoFocus: (e: Event) => {
        const destino = quienAbrio.current
        quienAbrio.current = null
        if (destino?.isConnected) {
          e.preventDefault()
          destino.focus()
        }
      },
    }),
    [],
  )
}
