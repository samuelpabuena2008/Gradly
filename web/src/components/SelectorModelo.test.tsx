// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../lib/ui/arranque'
import { datosDePrueba, reiniciarApp } from '../test/proveedores'
import { SelectorModelo } from './SelectorModelo'
import { BarraRango } from './BarraRango'
import { AnilloProbabilidad } from './AnilloProbabilidad'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

describe('Selector de modelo', () => {
  it('con red: dos opciones, la activa marcada y la recomendada con insignia', async () => {
    const alCambiar = vi.fn()
    render(<SelectorModelo modelo={datos.modelo} tipo="regresion" recomendado={datos.recomendado} onCambiar={alCambiar} />)
    const regresion = screen.getByRole('radio', { name: /Regresión/ }) as HTMLInputElement
    const red = screen.getByRole('radio', { name: /Red neuronal/ }) as HTMLInputElement
    expect(regresion.checked).toBe(true)
    expect(red.disabled).toBe(false)
    expect(screen.getByText('recomendado')).toBeTruthy()
    await userEvent.setup().click(red)
    expect(alCambiar).toHaveBeenCalledWith('red')
  })

  it('sin red: la opción Red se deshabilita y se explica por qué', async () => {
    const alCambiar = vi.fn()
    render(<SelectorModelo modelo={{ ...datos.modelo, red: undefined }} tipo="regresion" recomendado="regresion" onCambiar={alCambiar} />)
    const red = screen.getByRole('radio', { name: /Red neuronal/ }) as HTMLInputElement
    expect(red.disabled).toBe(true)
    expect(screen.getByText(/no trae red neuronal/i)).toBeTruthy()
    await userEvent.setup().click(red)
    expect(alCambiar).not.toHaveBeenCalled()
  })

  it('las flechas del teclado cambian de opción', async () => {
    const alCambiar = vi.fn()
    render(<SelectorModelo modelo={datos.modelo} tipo="regresion" recomendado="regresion" onCambiar={alCambiar} />)
    screen.getByRole('radio', { name: /Regresión/ }).focus()
    await userEvent.setup().keyboard('{ArrowRight}')
    expect(alCambiar).toHaveBeenCalledWith('red')
  })
})

describe('Barra de rango y anillo', () => {
  it('describen la estimación con texto', () => {
    render(<BarraRango nota={3.4} rango={[2.9, 3.9]} semaforo="amarillo" />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Nota esperada 3.4, rango probable entre 2.9 y 3.9. Se aprueba con 3.0.')
  })
  it('con valores no numéricos no pinta NaN', () => {
    const { container } = render(<BarraRango nota={NaN} rango={[0, 1]} />)
    expect(container.textContent).toBe('Sin estimación')
    cleanup()
    const anillo = render(<AnilloProbabilidad probabilidad={NaN} semaforo="verde" />)
    expect(anillo.container.textContent).not.toMatch(/NaN/)
  })
  it('el anillo informa la probabilidad en texto', () => {
    render(<AnilloProbabilidad probabilidad={0.234} semaforo="amarillo" />)
    expect(screen.getByRole('img', { name: 'Probabilidad de no aprobar: 23 %' })).toBeTruthy()
  })
})
