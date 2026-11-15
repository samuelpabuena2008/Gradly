// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import { parsearNotasCsv } from '../../lib/import/csv'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { Explorador } from './Explorador'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const cargarEjemplo = () => useApp.getState().reemplazarNotas(parsearNotasCsv(plantilla).notas)
const item = (nombre: RegExp | string) => screen.getByRole('treeitem', { name: nombre })

describe('Explorador de materias (árbol)', () => {
  it('es un árbol con 10 semestres y 50 materias', () => {
    render(conProveedores(datos, <Explorador />))
    const arbol = screen.getByRole('tree')
    const todos = within(arbol).getAllByRole('treeitem')
    expect(todos.filter((n) => n.getAttribute('aria-level') === '1')).toHaveLength(10)
    expect(todos.filter((n) => n.getAttribute('aria-level') === '2')).toHaveLength(50)
  })

  it('solo un elemento es tabulable (tabindex móvil)', () => {
    render(conProveedores(datos, <Explorador />))
    const tabulables = screen.getAllByRole('treeitem').filter((n) => n.tabIndex === 0)
    expect(tabulables).toHaveLength(1)
  })

  it('las flechas recorren el árbol, → y ← expanden y colapsan semestres', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Explorador />))
    const sem1 = item(/^Semestre 1 \d+ materias$/)
    sem1.focus()
    expect(sem1.getAttribute('aria-expanded')).toBe('true')

    await usuario.keyboard('{ArrowDown}')
    expect(document.activeElement?.getAttribute('data-key')).toMatch(/^mMAT1031$/) // Álgebra Lineal, primera del semestre 1

    await usuario.keyboard('{ArrowLeft}') // de una materia vuelve a su semestre
    expect(document.activeElement).toBe(sem1)

    await usuario.keyboard('{ArrowLeft}') // colapsa
    expect(sem1.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('treeitem', { name: /Álgebra Lineal/ })).toBeNull()

    await usuario.keyboard('{ArrowRight}') // expande
    expect(sem1.getAttribute('aria-expanded')).toBe('true')
    await usuario.keyboard('{ArrowRight}') // entra al primer hijo
    expect(document.activeElement?.getAttribute('data-key')).toBe('mMAT1031')

    await usuario.keyboard('{End}')
    expect(document.activeElement?.getAttribute('data-key')).toMatch(/^m/)
    await usuario.keyboard('{Home}')
    expect(document.activeElement).toBe(sem1)
  })

  it('Espacio selecciona y Enter abre la página de la materia', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Explorador />))
    item(/^Semestre 1 \d+ materias$/).focus()
    await usuario.keyboard('{ArrowDown}{ }')
    expect(useApp.getState().seleccionada).toBe('MAT1031')
    expect(item(/Álgebra Lineal/).getAttribute('aria-selected')).toBe('true')
    await usuario.keyboard('{Enter}')
    expect(window.location.hash).toBe('#/materia/MAT1031')
    expect(useApp.getState().pestanas).toContain('MAT1031')
  })

  it('el estado de cada materia se anuncia con texto (no solo con íconos)', () => {
    cargarEjemplo()
    render(conProveedores(datos, <Explorador />))
    expect(item(/Álgebra Lineal/).textContent).toMatch(/Aprobada/)
    expect(item(/Álgebra Lineal/).textContent).toMatch(/nota 3\.0/)
    expect(item(/Física Calor-Ondas/).textContent).toMatch(/Por repetir/)
    expect(item(/Estructuras Discretas/).textContent).toMatch(/Bloqueada/)
    expect(item(/Ecuaciones Diferenciales/).textContent).toMatch(/nota esperada/)
  })

  it('buscar filtra en vivo, ignora acentos y se puede limpiar', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Explorador />))
    await usuario.type(screen.getByRole('textbox', { name: /buscar materia/i }), 'calculo')
    const materias = screen.getAllByRole('treeitem').filter((n) => n.getAttribute('aria-level') === '2')
    expect(materias.length).toBeGreaterThanOrEqual(3)
    expect(materias.every((m) => /c[aá]lculo/i.test(m.textContent ?? ''))).toBe(true)

    await usuario.clear(screen.getByRole('textbox', { name: /buscar materia/i }))
    await usuario.type(screen.getByRole('textbox', { name: /buscar materia/i }), 'zzzzzz')
    expect(screen.getByText(/ninguna materia coincide/i)).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: /quitar filtros/i }))
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(50)
  })

  it('los chips filtran por estado', async () => {
    cargarEjemplo()
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Explorador />))
    const contar = () => screen.getAllByRole('treeitem').filter((n) => n.getAttribute('aria-level') === '2')

    await usuario.click(screen.getByRole('button', { name: 'Aprobadas' }))
    expect(contar().length).toBeGreaterThan(5)
    expect(contar().every((m) => /Aprobada/.test(m.textContent ?? ''))).toBe(true)

    await usuario.click(screen.getByRole('button', { name: 'En riesgo' }))
    expect(contar().every((m) => /Conviene reforzar|Dale prioridad/.test(m.textContent ?? ''))).toBe(true)

    await usuario.click(screen.getByRole('button', { name: 'Disponibles' }))
    expect(contar().length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Disponibles' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('seleccionar desde fuera (el grafo) expande el semestre y lo marca', () => {
    render(conProveedores(datos, <Explorador />))
    useApp.getState().seleccionar('MAT4021')
    // el estado cambió fuera de React: el store notifica y el árbol lo refleja
    return Promise.resolve().then(() => {
      expect(item(/Matemáticas Discretas/).getAttribute('aria-selected')).toBe('true')
    })
  })
})
