// @vitest-environment jsdom
// Vista Notas: formulario manual validado, tabla editable, exportar CSV y borrar con confirmación.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import { periodoActual } from '../../lib/ui/notas'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { Dialogos } from '../shell/Dialogos'
import { VistaNotas } from './VistaNotas'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const montar = () =>
  render(
    conProveedores(
      datos,
      <>
        <VistaNotas />
        <Dialogos />
      </>,
    ),
  )
const campoNota = () => screen.getByRole('textbox', { name: 'Nota' }) as HTMLInputElement
const campoPeriodo = () => screen.getByRole('textbox', { name: 'Periodo' }) as HTMLInputElement
const materia = () => screen.getByRole('combobox', { name: 'Materia' }) as HTMLSelectElement
const sinBasura = () => expect(document.body.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/)

describe('formulario manual', () => {
  it('el periodo ya no está fijo: arranca con el periodo actual y la materia tiene nombre', () => {
    montar()
    expect(campoPeriodo().value).toBe(periodoActual())
    expect(materia().selectedOptions[0].textContent).toMatch(/\(MAT1031\)|\(\w{3}\d{4}\)/)
  })

  it.each([
    ['2025-4', '3.5', /periodo debe verse como 2025-1/],
    ['25-1', '3.5', /periodo debe verse como 2025-1/],
    ['', '3.5', /Escribe el periodo/],
    ['2025-1', 'abc', /nota debe ser un número/],
    ['2025-1', '-1', /nota debe ser un número|entre 0\.0 y 5\.0/],
    ['2025-1', '5.1', /entre 0\.0 y 5\.0/],
    ['2025-1', '', /Escribe la nota/],
  ])('rechaza periodo «%s» con nota «%s» con un mensaje claro', async (periodo, nota, mensaje) => {
    const usuario = userEvent.setup()
    montar()
    await usuario.clear(campoPeriodo())
    if (periodo) await usuario.type(campoPeriodo(), periodo)
    if (nota) await usuario.type(campoNota(), nota)
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(screen.getByText(mensaje)).toBeTruthy()
    expect(useApp.getState().notasReales).toEqual([])
  })

  it.each([
    ['0.0', 0],
    ['5.0', 5],
    ['4,5', 4.5],
    ['3.75', 3.75],
  ])('acepta y normaliza la nota «%s»', async (texto, esperado) => {
    const usuario = userEvent.setup()
    montar()
    await usuario.clear(campoPeriodo())
    await usuario.type(campoPeriodo(), '2025-1')
    await usuario.type(campoNota(), `${texto}{Enter}`)
    expect(useApp.getState().notasReales).toEqual([{ materia: datos.malla.materias[0].id, periodo: '2025-1', nota: esperado }])
  })

  it('Enter agrega, limpia la nota y devuelve el foco al campo de nota', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.clear(campoPeriodo())
    await usuario.type(campoPeriodo(), '2025-1')
    await usuario.type(campoNota(), '3.5{Enter}')
    expect(campoNota().value).toBe('')
    expect(document.activeElement).toBe(campoNota())
    expect(screen.getByText(/Agregué .*3\.5 \(2025-1\)/)).toBeTruthy()
    sinBasura()
  })

  it('un duplicado exacto no se agrega y se explica', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.clear(campoPeriodo())
    await usuario.type(campoPeriodo(), '2025-1')
    await usuario.type(campoNota(), '3.5{Enter}')
    await usuario.type(campoNota(), '3.5{Enter}')
    expect(screen.getByText(/Ya cargaste exactamente esa nota/)).toBeTruthy()
    expect(useApp.getState().notasReales).toHaveLength(1)
  })

  it('el campo con error queda marcado como inválido para lectores de pantalla', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.type(campoNota(), 'abc{Enter}')
    expect(campoNota().getAttribute('aria-invalid')).toBe('true')
    expect(campoNota().getAttribute('aria-describedby')).toBeTruthy()
  })
})

describe('tabla de notas', () => {
  beforeEach(() => {
    useApp.getState().reemplazarNotas([
      { materia: 'MAT1031', periodo: '2024-1', nota: 2.0 },
      { materia: 'MAT1031', periodo: '2024-2', nota: 3.4 },
      { materia: 'IST0010', periodo: '2025-1', nota: 4.5 },
    ])
  })

  it('lista las notas y marca qué intento cuenta cuando una materia se repitió', () => {
    montar()
    expect(screen.getByText('cuenta este intento')).toBeTruthy()
    expect(screen.getByText('intento anterior')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Notas cargadas' })).toBeTruthy()
    sinBasura()
  })

  it('editar una nota la guarda al salir del campo; una inválida se revierte con un mensaje', async () => {
    const usuario = userEvent.setup()
    montar()
    const campo = screen.getByRole('textbox', { name: /Nota de Introducción a la Ingeniería de Sistemas en 2025-1/ }) as HTMLInputElement
    await usuario.clear(campo)
    await usuario.type(campo, '3,9')
    await usuario.tab()
    expect(useApp.getState().notasReales.find((n) => n.materia === 'IST0010')?.nota).toBe(3.9)

    await usuario.clear(campo)
    await usuario.type(campo, '9')
    await usuario.tab()
    expect(screen.getByRole('alert').textContent).toMatch(/entre 0\.0 y 5\.0/)
    expect(useApp.getState().notasReales.find((n) => n.materia === 'IST0010')?.nota).toBe(3.9)
    expect(campo.value).toBe('3.9')
  })

  it('quitar una nota ofrece deshacer', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /Quitar la nota de Introducción a la Ingeniería de Sistemas en 2025-1/ }))
    expect(useApp.getState().notasReales).toHaveLength(2)
    await usuario.click(await screen.findByRole('button', { name: 'Deshacer' }))
    expect(useApp.getState().notasReales).toHaveLength(3)
  })

  it('exportar CSV genera el archivo con el formato de la plantilla', async () => {
    let contenido = ''
    const crear = vi.fn((blob: Blob) => {
      void blob.text().then((t) => (contenido = t))
      return 'blob:prueba'
    })
    URL.createObjectURL = crear as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await waitFor(() => expect(contenido).not.toBe(''))
    expect(contenido.split('\n')[0]).toBe('materia,periodo,nota')
    expect(contenido).toContain('IST0010,2025-1,4.5')
    expect(contenido).toContain('MAT1031,2024-1,2.0')
  })

  it('borrar todo pide confirmación y se puede deshacer', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /Borrar todo/ }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('¿Borrar todas tus notas?')).toBeTruthy()
    // Cancelar no borra nada
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(useApp.getState().notasReales).toHaveLength(3)

    await usuario.click(screen.getByRole('button', { name: /Borrar todo/ }))
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Borrar notas' }))
    expect(useApp.getState().notasReales).toEqual([])
    await usuario.click(await screen.findByRole('button', { name: 'Deshacer' }))
    expect(useApp.getState().notasReales).toHaveLength(3)
  })
})

describe('vista Notas vacía', () => {
  it('ofrece los caminos para cargar notas y la privacidad a la vista', () => {
    montar()
    expect(screen.getByRole('button', { name: /Subir certificado PDF/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Subir CSV/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pegar texto/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ver con notas de ejemplo/ })).toBeTruthy()
    expect(screen.getByText(/no salen de tu computador/)).toBeTruthy()
    expect(screen.getByText('Todavía no hay notas cargadas.')).toBeTruthy()
  })
})
