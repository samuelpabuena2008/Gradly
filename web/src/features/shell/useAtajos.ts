// Atajos globales de teclado. Usa `event.code` para las letras y dígitos, así funcionan igual con
// cualquier distribución de teclado (y con Alt en Mac, que cambia el carácter).

import { useEffect, useRef } from 'react'
import { VISTAS, type Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { cerrarPestana, irA } from './acciones'

const esCampoDeTexto = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Enfoca el buscador del explorador (abriéndolo si estaba oculto). */
export function enfocarBuscador(): void {
  const { exploradorAbierto, alternarExplorador } = useApp.getState()
  if (!exploradorAbierto) alternarExplorador(true)
  requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>('[data-buscador="materias"]')?.focus()
  })
}

export function useAtajos(ruta: Ruta): void {
  const rutaActual = useRef(ruta)
  rutaActual.current = ruta

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return
      const mod = e.ctrlKey || e.metaKey
      const app = useApp.getState()

      if (mod && !e.altKey && e.code === 'KeyK') {
        e.preventDefault()
        app.abrirPaleta()
        return
      }
      if (mod && !e.altKey && !e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        app.alternarExplorador()
        return
      }
      if (mod && e.altKey && e.code === 'KeyB') {
        e.preventDefault()
        app.alternarInspector()
        return
      }
      if (e.altKey && !mod && /^Digit[1-5]$/.test(e.code)) {
        e.preventDefault()
        irA({ tipo: 'vista', vista: VISTAS[Number(e.code.slice(5)) - 1] })
        return
      }
      // Ctrl+W lo reserva el navegador en una pestaña normal; Alt+W funciona siempre.
      if (e.code === 'KeyW' && (mod || e.altKey) && rutaActual.current.tipo === 'materia') {
        e.preventDefault()
        cerrarPestana(rutaActual.current.id, rutaActual.current)
        return
      }
      if (mod || e.altKey || esCampoDeTexto(e.target)) return
      if (e.key === '?') {
        e.preventDefault()
        app.abrirAtajos(true)
      } else if (e.key === '/') {
        e.preventDefault()
        enfocarBuscador()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])
}
