// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import { useApp } from '../../store/app'
import { useConfirmacion } from '../../store/confirmacion'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { Paleta } from './Paleta'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const abrir = () => {
  render(conProveedores(datos, <Paleta />))
  act(() => useApp.getState().abrirPaleta(true))
}
const caja = () => screen.getByRole('combobox')

describe('Paleta de comandos', () => {
  it('abre con el foco en el buscador y lista vistas y acciones', async () => {
    abrir()
    await screen.findByRole('dialog', { name: /paleta de comandos/i })
    expect(document.activeElement).toBe(caja())
    const opciones = screen.getAllByRole('option')
    expect(opciones.length).toBeGreaterThan(8)
    expect(screen.getByRole('option', { name: /Ir a Predicciones/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Cargar notas de ejemplo/ })).toBeTruthy()
    // Las 50 materias aparecen al escribir, no en la lista inicial.
    expect(screen.queryByRole('option', { name: /Álgebra Lineal/ })).toBeNull()
  })

  it('la búsqueda es difusa y encuentra materias por nombre o código', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.type(await screen.findByRole('combobox'), 'discretas')
    expect(screen.getByRole('option', { name: /Matemáticas Discretas/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Estructuras Discretas/ })).toBeTruthy()

    await usuario.clear(caja())
    await usuario.type(caja(), 'mat1031')
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0].textContent).toMatch(/Álgebra Lineal/)
  })

  it('flechas + Enter ejecutan el comando, cierran la paleta y la dejan en recientes', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.type(await screen.findByRole('combobox'), 'calculo ii')
    const primera = screen.getAllByRole('option')[0]
    expect(primera.getAttribute('aria-selected')).toBe('true')
    expect(caja().getAttribute('aria-activedescendant')).toBe(primera.id)

    await usuario.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/materia\/MAT/))
    expect(useApp.getState().paletaAbierta).toBe(false)
    expect(JSON.parse(window.localStorage.getItem('gradly:recientes')!)).toHaveLength(1)

    // Al reabrir, el comando reciente aparece primero.
    act(() => useApp.getState().abrirPaleta(true))
    await screen.findByRole('dialog')
    expect(screen.getAllByRole('option')[0].textContent).toMatch(/Cálculo/)
  })

  it('Esc cierra la paleta', async () => {
    const usuario = userEvent.setup()
    abrir()
    await screen.findByRole('dialog')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(useApp.getState().paletaAbierta).toBe(false)
  })

  it('sin coincidencias explica qué hacer (no queda vacía)', async () => {
    const usuario = userEvent.setup()
    abrir()
    await usuario.type(await screen.findByRole('combobox'), 'qqqqqq')
    expect(screen.getByRole('status').textContent).toMatch(/Nada coincide/)
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('«Borrar mis datos» pide confirmación antes de borrar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    useApp.getState().reemplazarNotas([{ materia: 'MAT1031', periodo: '2025-1', nota: 4 }])
    abrir()
    await usuario.type(await screen.findByRole('combobox'), 'borrar')
    await usuario.keyboard('{Enter}')
    await waitFor(() => expect(useConfirmacion.getState().pendiente?.titulo).toMatch(/Borrar/))
    expect(useApp.getState().notasReales).toHaveLength(1) // todavía no se borró nada
    vi.useRealTimers()
  })
})
