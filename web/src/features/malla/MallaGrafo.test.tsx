// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import type { Datos } from '../../lib/ui/arranque'
import { useApp } from '../../store/app'
import { PREFS_GRAFO_INICIALES, useGrafo } from '../../store/grafo'
import { cargarEjemplo } from '../shell/acciones'
import { MallaGrafo } from './MallaGrafo'

// React Flow mide el DOM; jsdom no trae estas APIs.
class DOMMatrixFalsa {
  m22: number
  constructor(t?: string) {
    const escala = t?.match(/scale\(([\d.]+)\)/)
    this.m22 = escala ? Number(escala[1]) : 1
  }
}
beforeAll(() => {
  ;(globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly ??= DOMMatrixFalsa
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get: () => 600 },
    offsetWidth: { configurable: true, get: () => 900 },
  })
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
})

let datos: Datos
beforeAll(async () => {
  datos = await datosDePrueba()
})
beforeEach(() => {
  reiniciarApp()
  useGrafo.setState({ ...PREFS_GRAFO_INICIALES, busqueda: '', solicitud: null })
})
afterEach(cleanup)

const nodo = (id: string) => document.querySelector<HTMLElement>(`[data-materia="${id}"]`)
const lienzo = () => screen.getByRole('group', { name: 'Malla de la carrera como grafo' })

describe('MallaGrafo', () => {
  it('dibuja un nodo por materia, sin NaN ni undefined', () => {
    render(conProveedores(datos, <MallaGrafo />))
    expect(document.querySelectorAll('.nodo-materia')).toHaveLength(datos.malla.materias.length)
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  it('con notas, cada estado tiene su forma (clase) y su valor', () => {
    cargarEjemplo(datos)
    render(conProveedores(datos, <MallaGrafo />))
    const aprobadas = document.querySelectorAll('.nodo-aprobada')
    const disponibles = document.querySelectorAll('.nodo-disponible')
    expect(aprobadas.length).toBeGreaterThan(0)
    expect(disponibles.length).toBeGreaterThan(0)
    // El semáforo no depende solo del color: cada disponible lleva clase de nivel y un glifo.
    for (const d of disponibles) {
      expect(d.className).toMatch(/nodo-(verde|amarillo|rojo)/)
      expect(d.querySelector('.nodo-glifo svg')).not.toBeNull()
      expect(d.querySelector('.nodo-valor')?.textContent).toMatch(/^≈ \d\.\d$/)
    }
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
  })

  it('se recorre con el teclado: flechas seleccionan, Enter abre, Esc deselecciona', () => {
    render(conProveedores(datos, <MallaGrafo />))
    const g = lienzo()
    g.focus()
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    const primera = datos.orden[0]
    expect(useApp.getState().seleccionada).toBe(primera)
    // Se anuncia a lectores de pantalla.
    expect(screen.getAllByRole('status').some((s) => s.textContent?.includes(datos.materiaPorId.get(primera)!.nombre))).toBe(true)

    fireEvent.keyDown(g, { key: 'ArrowDown' })
    expect(useApp.getState().seleccionada).not.toBe(primera)

    fireEvent.keyDown(g, { key: 'Enter' })
    const sel = useApp.getState().seleccionada!
    expect(useApp.getState().pestanas).toContain(sel)
    expect(window.location.hash).toBe(`#/materia/${sel}`)

    fireEvent.keyDown(g, { key: 'Escape' })
    expect(useApp.getState().seleccionada).toBeNull()
  })

  it('ignora teclas que vienen de controles internos (p. ej. el buscador)', () => {
    useGrafo.setState({ panelAbierto: true })
    render(conProveedores(datos, <MallaGrafo />))
    const buscador = document.querySelector<HTMLInputElement>('[data-buscador="grafo"]')!
    fireEvent.keyDown(buscador, { key: 'ArrowRight' })
    expect(useApp.getState().seleccionada).toBeNull()
  })

  it('«/» abre el panel y enfoca la búsqueda; Enter centra y selecciona la coincidencia', async () => {
    render(conProveedores(datos, <MallaGrafo />))
    fireEvent.keyDown(lienzo(), { key: '/' })
    expect(useGrafo.getState().panelAbierto).toBe(true)
    const buscador = document.querySelector<HTMLInputElement>('[data-buscador="grafo"]')!
    const objetivo = datos.malla.materias[7]
    fireEvent.change(buscador, { target: { value: objetivo.id } })
    expect(screen.getByText(/coincidencia/)).toBeTruthy()
    fireEvent.keyDown(buscador, { key: 'Enter' })
    expect(useApp.getState().seleccionada).toBe(objetivo.id)
    // Las que no coinciden se atenúan.
    expect(document.querySelectorAll('.nodo-atenuada').length).toBeGreaterThan(0)
    expect(nodo(objetivo.id)?.className).not.toContain('nodo-atenuada')
  })

  it('el hover deja a la materia y sus vecinas a la vista y atenúa el resto', () => {
    render(conProveedores(datos, <MallaGrafo />))
    const e = datos.malla.prerrequisitos[0]
    const wrapper = nodo(e.a)!.closest('.react-flow__node')!
    fireEvent.mouseEnter(wrapper)
    expect(nodo(e.a)!.className).toContain('nodo-enfocada')
    expect(nodo(e.de)!.className).not.toContain('nodo-atenuada')
    expect(document.querySelectorAll('.nodo-atenuada').length).toBeGreaterThan(0)
    expect(screen.getByText(e.a, { selector: 'code' })).toBeTruthy()
    fireEvent.mouseLeave(wrapper)
    expect(document.querySelectorAll('.nodo-atenuada')).toHaveLength(0)
  })

  it('«Solo disponibles» oculta el resto; si no queda nada lo explica y ofrece quitar filtros', () => {
    cargarEjemplo(datos)
    render(conProveedores(datos, <MallaGrafo />))
    act(() => useGrafo.setState({ soloDisponibles: true }))
    const visibles = document.querySelectorAll('.nodo-materia').length
    expect(visibles).toBeGreaterThan(0)
    expect(visibles).toBeLessThan(datos.malla.materias.length)
    expect(screen.queryByText(/no queda ninguna materia/)).toBeNull()

    // Con todo aprobado no queda ninguna disponible.
    act(() =>
      useApp.getState().reemplazarNotas(datos.malla.materias.map((m) => ({ materia: m.id, nota: 4, periodo: '2025-1' }))),
    )
    expect(screen.getByText(/no queda ninguna materia/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(useGrafo.getState().soloDisponibles).toBe(false)
  })

  it('resalta cuellos de botella y cadena crítica', () => {
    useGrafo.setState({ cuellos: true, cadena: true })
    render(conProveedores(datos, <MallaGrafo />))
    expect(document.querySelectorAll('.nodo-cuello')).toHaveLength(5)
    expect(document.querySelectorAll('.nodo-en-cadena')).toHaveLength(datos.camino.length)
    expect(screen.getByText('Cuello de botella')).toBeTruthy()
  })
})
