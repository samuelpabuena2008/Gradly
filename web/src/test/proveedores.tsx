// Apoyo para pruebas de componentes: datos reales de la malla y proveedores de la app.

import type { ReactElement } from 'react'
import { ProveedorTips } from '../components/Tip'
import { cargarDatos, type Datos } from '../lib/ui/arranque'
import { useApp } from '../store/app'
import { useConfirmacion } from '../store/confirmacion'
import { EscenarioProvider } from '../store/escenario'
import { useToasts } from '../store/toasts'

// jsdom no trae estas APIs de layout; Radix y el scroll las usan al abrir capas.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}

let cache: Promise<Datos> | null = null
export const datosDePrueba = () => (cache ??= cargarDatos(undefined, { minimoPorEtapaMs: 0 }))

/** Deja los stores y la URL como en una sesión nueva. */
export function reiniciarApp(): void {
  useApp.setState(useApp.getInitialState(), true)
  useToasts.setState({ toasts: [] })
  useConfirmacion.setState({ pendiente: null })
  window.localStorage.clear()
  window.location.hash = ''
}

export const conProveedores = (datos: Datos, ui: ReactElement) => (
  <ProveedorTips>
    <EscenarioProvider datos={datos}>{ui}</EscenarioProvider>
  </ProveedorTips>
)
