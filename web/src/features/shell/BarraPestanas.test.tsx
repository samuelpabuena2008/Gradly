// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { BarraPestanas } from './BarraPestanas'
import { abrirMateria } from './acciones'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const IDS = ['MAT1031', 'MAT1101', 'IST0010', 'IST2088', 'MAT1111', 'FIS1031', 'IST2089', 'MAT2051', 'MAT4021']

function montar(ruta: Ruta = { tipo: 'vista', vista: 'malla' }) {
  return render(conProveedores(datos, <BarraPestanas ruta={ruta} idPanel="panel" />))
}
const pestanas = () => screen.getAllByRole('tab')
// El × es solo para mouse/táctil (aria-hidden): se busca por su etiqueta, no por rol.
const botonCerrar = (nombre: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.tab-cerrar')].find(
    (b) => b.getAttribute('aria-label') === `Cerrar ${nombre}`,
  ) ?? null

describe('Barra de pestañas', () => {
  it('siempre tiene la pestaña fija «Malla», sin botón de cerrar', () => {
    montar()
    expect(pestanas()).toHaveLength(1)
    expect(pestanas()[0].textContent).toBe('Malla')
    expect(botonCerrar('Malla')).toBeNull()
  })

  it('al abrir una materia aparece su pestaña, activa y cerrable', () => {
    abrirMateria('MAT4021')
    montar({ tipo: 'materia', id: 'MAT4021' })
    expect(pestanas()).toHaveLength(2)
    expect(pestanas()[1].getAttribute('aria-selected')).toBe('true')
    expect(pestanas()[1].textContent).toMatch(/Matemáticas Discretas/)
    expect(botonCerrar('Matemáticas Discretas')).toBeTruthy()
  })

  it('máximo 8 pestañas de materia: la más antigua se reemplaza', () => {
    for (const id of IDS) useApp.getState().abrirMateria(id)
    montar()
    expect(useApp.getState().pestanas).toHaveLength(8)
    expect(useApp.getState().pestanas).not.toContain('MAT1031')
    expect(pestanas()).toHaveLength(9) // 8 materias + Malla
  })

  it('cerrar la pestaña activa pasa a la vecina; cerrar la última vuelve a la malla', async () => {
    const usuario = userEvent.setup()
    abrirMateria('MAT1031')
    abrirMateria('MAT1101')
    montar({ tipo: 'materia', id: 'MAT1101' })
    await usuario.click(botonCerrar('Cálculo I - Diferencial')!)
    expect(useApp.getState().pestanas).toEqual(['MAT1031'])
    expect(window.location.hash).toBe('#/materia/MAT1031')
  })

  it('las flechas mueven el foco y Alt+flecha reordena', async () => {
    const usuario = userEvent.setup()
    useApp.getState().abrirMateria('MAT1031')
    useApp.getState().abrirMateria('MAT1101')
    montar({ tipo: 'vista', vista: 'malla' })
    pestanas()[0].focus()
    await usuario.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(pestanas()[1])
    await usuario.keyboard('{End}')
    expect(document.activeElement).toBe(pestanas()[2])
    await usuario.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    expect(useApp.getState().pestanas).toEqual(['MAT1101', 'MAT1031'])
  })

  it('Supr cierra la pestaña enfocada (cierre por teclado)', async () => {
    const usuario = userEvent.setup()
    useApp.getState().abrirMateria('MAT1031')
    montar({ tipo: 'materia', id: 'MAT1031' })
    pestanas()[1].focus()
    await usuario.keyboard('{Delete}')
    expect(useApp.getState().pestanas).toEqual([])
    expect(window.location.hash).toBe('#/malla')
  })

  it('la ruta de una vista distinta a la malla agrega una pestaña de vista cerrable', async () => {
    const usuario = userEvent.setup()
    montar({ tipo: 'vista', vista: 'predicciones' })
    expect(pestanas().map((p) => p.textContent)).toEqual(['Malla', 'Predicciones'])
    await usuario.click(botonCerrar('Predicciones')!)
    expect(window.location.hash).toBe('#/malla')
  })

  it('el botón del inspector refleja y cambia su estado', async () => {
    const usuario = userEvent.setup()
    act(() => useApp.getState().alternarInspector(true))
    montar()
    const boton = screen.getByRole('button', { name: /ocultar inspector/i })
    expect(boton.getAttribute('aria-pressed')).toBe('true')
    await usuario.click(boton)
    expect(useApp.getState().inspectorAbierto).toBe(false)
    act(() => useApp.getState().alternarInspector(true))
  })
})
