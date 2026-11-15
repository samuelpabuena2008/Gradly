// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import type { Datos } from '../../lib/ui/arranque'
import { parsearNotasCsv } from '../../lib/import/csv'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { VistaPredicciones } from './VistaPredicciones'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const cargarEjemplo = () => useApp.getState().reemplazarNotas(parsearNotasCsv(plantilla).notas)
const sinBasura = () => expect(document.body.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/)

describe('Vista Predicciones', () => {
  it('sin notas: estado vacío con llamado a la acción', () => {
    render(conProveedores(datos, <VistaPredicciones />))
    expect(screen.getByRole('heading', { name: 'Aún no hay predicciones' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cargar mis notas' })).toBeTruthy()
    sinBasura()
  })

  it('con notas: KPIs, filtros con conteos y tarjetas ordenadas por riesgo', () => {
    cargarEjemplo()
    render(conProveedores(datos, <VistaPredicciones />))
    const kpis = screen.getByRole('region', { name: 'Resumen del próximo semestre' })
    expect(within(kpis).getByText('Nota promedio esperada')).toBeTruthy()
    expect(within(kpis).getByText(/Créditos de carga sugerida/)).toBeTruthy()
    const items = screen.getAllByRole('listitem').filter((li) => li.classList.contains('pred-tarjeta'))
    expect(items.length).toBeGreaterThan(0)
    const riesgos = items.map((li) => (li.className.includes('pred-rojo') ? 0 : li.className.includes('pred-amarillo') ? 1 : 2))
    expect(riesgos).toEqual([...riesgos].sort((a, b) => a - b))
    sinBasura()
  })

  it('filtrar por semáforo deja solo ese color; un filtro sin resultados lo dice', async () => {
    cargarEjemplo()
    const usuario = userEvent.setup()
    render(conProveedores(datos, <VistaPredicciones />))
    const filtros = screen.getByRole('group', { name: 'Filtrar por semáforo' })
    for (const nombre of ['Dale prioridad', 'Conviene reforzar', 'Vas bien preparado']) {
      const boton = within(filtros).getByRole('button', { name: new RegExp(nombre) })
      await usuario.click(boton)
      const cantidad = Number(boton.querySelector('.mono')!.textContent)
      const tarjetas = document.querySelectorAll('.pred-tarjeta')
      expect(tarjetas.length).toBe(cantidad)
      if (cantidad === 0) expect(screen.getByText('No hay materias con ese semáforo.')).toBeTruthy()
    }
  })

  it('cambiar el modelo desde el selector actualiza el estado global', async () => {
    cargarEjemplo()
    render(conProveedores(datos, <VistaPredicciones />))
    await userEvent.setup().click(screen.getByRole('radio', { name: /Red neuronal/ }))
    expect(useApp.getState().tipoModelo).toBe('red')
  })

  it('con todas las materias aprobadas: celebración sobria, sin predicciones ni errores', () => {
    useApp.getState().reemplazarNotas(datos.malla.materias.map((m) => ({ materia: m.id, periodo: '2025-1', nota: 4 })))
    render(conProveedores(datos, <VistaPredicciones />))
    expect(screen.getByRole('heading', { name: 'Completaste la malla' })).toBeTruthy()
    expect(document.querySelectorAll('.pred-tarjeta').length).toBe(0)
    sinBasura()
  })

  it('con 2 notas avisa que la estimación es más incierta', () => {
    useApp.getState().reemplazarNotas([
      { materia: 'MAT1031', periodo: '2025-1', nota: 3.5 },
      { materia: 'IST0010', periodo: '2025-1', nota: 4.2 },
    ])
    render(conProveedores(datos, <VistaPredicciones />))
    expect(screen.getByText(/Con pocas notas la estimación es más incierta/)).toBeTruthy()
  })
})
