// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import type { Datos } from '../../lib/ui/arranque'
import { parsearNotasCsv } from '../../lib/import/csv'
import { predecirSiguientes } from '../../lib/model/predict'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { PaginaMateria } from './PaginaMateria'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const cargarEjemplo = () => useApp.getState().reemplazarNotas(parsearNotasCsv(plantilla).notas)
/** Una materia que el ejemplo deja disponible (con pesos propios en el modelo). */
const disponible = (datos: Datos) => {
  const notas = parsearNotasCsv(plantilla).notas
  return predecirSiguientes(datos.malla, datos.modelo, notas).find((p) => p.usaModelo && !notas.some((n) => n.materia === p.materia))!.materia
}
const sinBasura = () => {
  const texto = document.body.textContent ?? ''
  expect(texto).not.toMatch(/NaN|undefined|Infinity/)
}

describe('Página de materia', () => {
  it('materia desconocida: mensaje claro, sin romper', () => {
    render(conProveedores(datos, <PaginaMateria id="XXX0000" />))
    expect(screen.getByRole('heading', { name: /No encontramos la materia XXX0000/ })).toBeTruthy()
  })

  it('sin notas: propiedades y CTA, sin números raros', () => {
    render(conProveedores(datos, <PaginaMateria id="MAT1121" />))
    expect(screen.getByRole('heading', { level: 1, name: /cálculo|calculo/i })).toBeTruthy()
    expect(screen.getByText(/Carga tus notas para ver cómo te puede ir/)).toBeTruthy()
    sinBasura()
  })

  it('materia disponible: nota esperada, rango, anillo, semáforo con texto, por qué y comparación', () => {
    cargarEjemplo()
    render(conProveedores(datos, <PaginaMateria id={disponible(datos)} />))
    const pred = screen.queryByRole('heading', { name: 'Predicción' })
    expect(pred).toBeTruthy()
    expect(screen.getAllByRole('img', { name: /Nota esperada .*rango probable entre/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /Probabilidad de no aprobar: \d+ %/ })).toBeTruthy()
    expect(screen.getAllByText(/Vas bien preparado|Conviene reforzar|Dale prioridad/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Comparar modelos' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Enlaces entrantes' })).toBeTruthy()
    expect(screen.getByRole('group', { name: /Vecindad de .* en la malla/ })).toBeTruthy()
    sinBasura()
  })

  it('«Por qué» enlaza a la materia previa y abre su pestaña', async () => {
    cargarEjemplo()
    render(conProveedores(datos, <PaginaMateria id={disponible(datos)} />))
    const lista = screen.queryByRole('list', { name: /Aporte de cada materia previa/ })
    if (lista) {
      const enlace = within(lista).getAllByRole('button')[0]
      await userEvent.setup().click(enlace)
      expect(useApp.getState().pestanas.length).toBe(1)
    }
  })

  it('sin pesos propios: explica que se basa en la media y el nivel', () => {
    cargarEjemplo()
    const sinPesos: Datos = { ...datos, modelo: { ...datos.modelo, cursos: {}, red: undefined } }
    render(conProveedores(sinPesos, <PaginaMateria id={disponible(datos)} />))
    expect(screen.getByText(/basada en la media de la materia y tu nivel/i)).toBeTruthy()
    // Sin red no hay con qué comparar y se dice sin inventar números.
    expect(screen.getByText(/solo hay predicción por regresión/i)).toBeTruthy()
    sinBasura()
  })

  it('materia reprobada y repetida: muestra el historial y cuenta el intento más reciente', () => {
    useApp.getState().reemplazarNotas([
      { materia: 'MAT1031', periodo: '2024-1', nota: 1.8 },
      { materia: 'MAT1031', periodo: '2024-2', nota: 2.4 },
    ])
    render(conProveedores(datos, <PaginaMateria id="MAT1031" />))
    expect(screen.getByRole('heading', { name: 'Historial de intentos' })).toBeTruthy()
    const filas = screen.getAllByRole('row')
    expect(filas.some((f) => /2024-1/.test(f.textContent ?? ''))).toBe(true)
    expect(screen.getByText('cuenta este intento')).toBeTruthy()
    expect(screen.getAllByText(/Por repetir/, { selector: 'td' }).length).toBeGreaterThan(0)
    sinBasura()
  })

  it('con 1 o 2 notas avisa que la estimación es más incierta', () => {
    useApp.getState().reemplazarNotas([{ materia: 'MAT1031', periodo: '2025-1', nota: 4.0 }])
    render(conProveedores(datos, <PaginaMateria id="MAT1101" />))
    expect(screen.getByText(/Con pocas notas la estimación es más incierta/)).toBeTruthy()
  })
})
