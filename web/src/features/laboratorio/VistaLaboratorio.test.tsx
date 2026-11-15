// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import VistaLaboratorio from './VistaLaboratorio'
import VistaModelo from '../modelo/VistaModelo'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const sinBasura = () => expect(document.body.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/)

describe('Laboratorio de grafos', () => {
  it('muestra los cinco conceptos y avanza el algoritmo de Kahn paso a paso', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <VistaLaboratorio />))
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    expect(screen.getByText('0 / 50')).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Paso siguiente' }))
    expect(screen.getByText('1 / 50')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/Paso 1 de 50: sale /)
    await usuario.click(screen.getByRole('button', { name: 'Paso anterior' }))
    expect(screen.getByText('0 / 50')).toBeTruthy()
    sinBasura()
  })

  it('al terminar el algoritmo, la cola queda vacía y se ofrece repetir', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <VistaLaboratorio />))
    const siguiente = screen.getByRole('button', { name: 'Paso siguiente' })
    for (let i = 0; i < 50; i++) await usuario.click(siguiente)
    expect(screen.getByText('50 / 50')).toBeTruthy()
    expect(screen.getByText(/La cola quedó vacía/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Repetir' })).toBeTruthy()
  })

  it('cambia de concepto con flechas y muestra su explicación y datos reales', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <VistaLaboratorio />))
    screen.getByRole('tab', { name: 'Orden topológico' }).focus()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Cadena crítica', selected: true })).toBeTruthy()
    expect(document.querySelector('.lab-dato-valor')?.textContent).toBe(String(datos.camino.length))
    await usuario.click(screen.getByRole('tab', { name: 'Cuellos de botella' }))
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(5)
    sinBasura()
  })

  it('descendientes: sin selección pide elegir; con selección cuenta las que dependen', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <VistaLaboratorio />))
    await usuario.click(screen.getByRole('tab', { name: 'Descendientes' }))
    expect(screen.getByText(/Elige una materia/, { selector: 'p' })).toBeTruthy()
    useApp.getState().seleccionar('MAT1101')
    await usuario.click(screen.getByRole('tab', { name: 'Cadena crítica' }))
    await usuario.click(screen.getByRole('tab', { name: 'Descendientes' }))
    expect(screen.getByText(/materias que dependen de ella|materia que depende de ella/)).toBeTruthy()
  })
})

describe('Vista Modelo', () => {
  it('avisa que el entrenamiento usó estudiantes simulados y lee las métricas reales', () => {
    render(conProveedores(datos, <VistaModelo />))
    expect(screen.getByText('El modelo se entrenó con estudiantes simulados.')).toBeTruthy()
    expect(screen.getByRole('math', { hidden: true }) ?? true).toBeTruthy()
    expect(screen.getByText(/Error medio \(MAE\)/, { selector: 'h3' })).toBeTruthy()
    // 0.294 es el MAE real de la regresión en pesos.json.
    expect(document.body.textContent).toContain('0.294')
    expect(document.body.textContent).toContain('0.457')
    sinBasura()
  })

  it('la red no mejora a la regresión: lo dice con el intervalo real', () => {
    render(conProveedores(datos, <VistaModelo />))
    expect(screen.getByText(/La red no mejora a la regresión/)).toBeTruthy()
  })

  it('sin métricas en pesos.json: lo dice en vez de inventar números', () => {
    const sinMetricas = { ...datos, modelo: { ...datos.modelo, metricas: undefined, validacion: undefined } } as unknown as Datos
    render(conProveedores(sinMetricas, <VistaModelo />))
    expect(screen.getByText(/no trae métricas de validación/)).toBeTruthy()
    sinBasura()
  })

  it('sin notas, el ejemplo invita a cargarlas; con notas arma la cascada', () => {
    const { unmount } = render(conProveedores(datos, <VistaModelo />))
    expect(screen.getByRole('button', { name: 'Cargar mis notas' })).toBeTruthy()
    unmount()
    useApp.getState().reemplazarNotas([
      { materia: 'MAT1031', periodo: '2025-1', nota: 3.0 },
      { materia: 'MAT1101', periodo: '2025-1', nota: 3.2 },
      { materia: 'IST0010', periodo: '2025-1', nota: 4.5 },
    ])
    render(conProveedores(datos, <VistaModelo />))
    expect(screen.getByText('Cómo te fue en las materias previas')).toBeTruthy()
    sinBasura()
  })
})
