// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import { parsearHash } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { elegirMateria } from './acciones'
import { BarraInferior } from './BarraInferior'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(() => {
  cleanup()
  delete (window as { matchMedia?: unknown }).matchMedia
})

const rutaMalla = parsearHash('#/malla')
const montar = (ruta = rutaMalla, onAjustes = () => {}) =>
  render(conProveedores(datos, <BarraInferior ruta={ruta} onAjustes={onAjustes} />))

/** Simula un teléfono: solo la consulta `(max-width…)` queda sin coincidir con amplio/medio. */
function simularMovil() {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
}

describe('Barra inferior (móvil)', () => {
  it('ofrece Malla, Notas, Predicciones y Más, y marca la vista actual', () => {
    montar(parsearHash('#/predicciones'))
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
    for (const nombre of ['Malla', 'Notas', 'Predicciones', 'Más']) {
      expect(within(nav).getByRole('button', { name: nombre })).toBeTruthy()
    }
    expect(within(nav).getByRole('button', { name: 'Predicciones' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('button', { name: 'Malla' }).getAttribute('aria-current')).toBeNull()
  })

  it('navega al tocar una pestaña', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Notas' }))
    await waitFor(() => expect(window.location.hash).toBe('#/notas'))
  })

  it('«Más» abre una hoja con el resto y la cierra al elegir una opción', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Más' }))
    const hoja = await screen.findByRole('dialog', { name: 'Más opciones' })
    for (const nombre of [/Lista de materias/, /Laboratorio de grafos/, /Cómo piensa Gradly/, /Buscar y acciones/, /Ajustes y privacidad/, /Ayuda y glosario/]) {
      expect(within(hoja).getByRole('button', { name: nombre })).toBeTruthy()
    }

    await usuario.click(within(hoja).getByRole('button', { name: /Laboratorio de grafos/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.location.hash).toBe('#/laboratorio')
  })

  it('«Lista de materias» cambia la malla a modo lista', async () => {
    const usuario = userEvent.setup()
    montar()
    expect(useApp.getState().modoMalla).toBe('grafo')
    await usuario.click(screen.getByRole('button', { name: 'Más' }))
    await usuario.click(await screen.findByRole('button', { name: /Lista de materias/ }))
    expect(useApp.getState().modoMalla).toBe('lista')
  })

  it('«Ajustes y privacidad» avisa al espacio de trabajo', async () => {
    const usuario = userEvent.setup()
    let abiertos = 0
    montar(rutaMalla, () => abiertos++)
    await usuario.click(screen.getByRole('button', { name: 'Más' }))
    await usuario.click(await screen.findByRole('button', { name: /Ajustes y privacidad/ }))
    expect(abiertos).toBe(1)
  })
})

describe('elegirMateria', () => {
  it('en pantalla amplia solo selecciona (el inspector ya está a la vista)', () => {
    useApp.setState({ inspectorAbierto: false })
    act(() => elegirMateria('MAT1031'))
    expect(useApp.getState().seleccionada).toBe('MAT1031')
    expect(useApp.getState().inspectorAbierto).toBe(false)
  })

  it('en móvil selecciona y abre la hoja de detalle en su pestaña Detalle', () => {
    simularMovil()
    useApp.setState({ inspectorAbierto: false, tabInspector: 'analisis' })
    act(() => elegirMateria('MAT1031'))
    const s = useApp.getState()
    expect(s.seleccionada).toBe('MAT1031')
    expect(s.inspectorAbierto).toBe(true)
    expect(s.tabInspector).toBe('detalle')
  })
})
