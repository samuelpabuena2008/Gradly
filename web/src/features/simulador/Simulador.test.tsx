// @vitest-environment jsdom
// Simulador «¿Qué pasaría si…?» (§7): deslizar, escribir, restaurar, proyección y banner.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import type { Datos } from '../../lib/ui/arranque'
import { parsearNotasCsv } from '../../lib/import/csv'
import { materiasDisponibles, ultimasNotas } from '../../lib/model/predict'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { BannerEscenario } from './BannerEscenario'
import { Simulador } from './Simulador'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(cleanup)

const notasEjemplo = () => parsearNotasCsv(plantilla).notas
const cargar = () => useApp.getState().reemplazarNotas(notasEjemplo())
const montar = () =>
  render(
    conProveedores(
      datos,
      <>
        <BannerEscenario />
        <Simulador />
      </>,
    ),
  )
const deslizador = (nombre: string) => screen.getByRole('slider', { name: `Nota de ${nombre}` }) as HTMLInputElement
const campo = (nombre: string) => screen.getByRole('textbox', { name: `Nota simulada de ${nombre}` }) as HTMLInputElement
const sinBasura = () => expect(document.body.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/)

describe('Simulador', () => {
  it('sin notas no hay simulador: invita a cargarlas', () => {
    montar()
    expect(screen.getByText(/Primero carga tus notas/)).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByText('Estás viendo un escenario hipotético')).toBeNull()
  })

  it('deslizar una nota crea un escenario hipotético sin tocar las notas reales', async () => {
    cargar()
    const reales = JSON.stringify(useApp.getState().notasReales)
    montar()
    expect(screen.queryByText('Estás viendo un escenario hipotético')).toBeNull()

    fireEvent.change(deslizador('Cálculo III - Vectorial'), { target: { value: '1.9' } })
    await waitFor(() => expect(useApp.getState().ajustes.MAT1121).toBe(1.9))
    expect(await screen.findByText('Estás viendo un escenario hipotético')).toBeTruthy()
    expect(JSON.stringify(useApp.getState().notasReales)).toBe(reales)
    sinBasura()
  })

  it('escribir una nota (con coma) la aplica; un valor inválido espera y no cambia nada', async () => {
    cargar()
    const usuario = userEvent.setup()
    montar()
    const c = campo('Cálculo III - Vectorial')

    await usuario.clear(c)
    await usuario.type(c, 'abc')
    expect(c.value).toBe('abc') // borrador mientras se escribe
    expect(useApp.getState().ajustes).toEqual({})

    await usuario.clear(c)
    await usuario.type(c, '4,8')
    await waitFor(() => expect(useApp.getState().ajustes.MAT1121).toBe(4.8))

    await usuario.clear(c)
    await usuario.type(c, '7')
    await new Promise((r) => setTimeout(r, 50))
    expect(useApp.getState().ajustes.MAT1121).toBe(4.8) // 7 está fuera de 0–5: no se aplica
  })

  it('restaurar una materia y restaurar todo', async () => {
    cargar()
    const usuario = userEvent.setup()
    montar()
    fireEvent.change(deslizador('Cálculo III - Vectorial'), { target: { value: '2' } })
    fireEvent.change(deslizador('Física Mecánica'), { target: { value: '5' } })
    await waitFor(() => expect(Object.keys(useApp.getState().ajustes)).toHaveLength(2))

    await usuario.click(await screen.findByRole('button', { name: 'Restaurar Cálculo III - Vectorial' }))
    await waitFor(() => expect(Object.keys(useApp.getState().ajustes)).toEqual(['FIS1023']))

    await usuario.click(screen.getAllByRole('button', { name: /Restaurar todo/ })[0])
    expect(useApp.getState().ajustes).toEqual({})
    await waitFor(() => expect(screen.queryByText('Estás viendo un escenario hipotético')).toBeNull())
  })

  it('el banner muestra «antes → después» y Restaurar vuelve a lo real', async () => {
    cargar()
    const usuario = userEvent.setup()
    montar()
    fireEvent.change(deslizador('Estructura de Datos I'), { target: { value: '1' } })
    const banner = await screen.findByRole('region', { name: 'Escenario hipotético' })
    expect(within(banner).getByText(/Promedio/)).toBeTruthy()
    expect(banner.textContent).toMatch(/→/)
    await usuario.click(within(banner).getByRole('button', { name: 'Restaurar' }))
    expect(useApp.getState().ajustes).toEqual({})
    sinBasura()
  })

  it('los deltas muestran ▲/▼ con el cambio de cada predicción', async () => {
    cargar()
    montar()
    fireEvent.change(deslizador('Cálculo III - Vectorial'), { target: { value: '5' } })
    const titulo = await screen.findByRole('heading', { name: 'Cómo cambian tus predicciones' })
    expect(titulo).toBeTruthy()
    await waitFor(() => expect(document.querySelector('.delta')).not.toBeNull())
    expect(document.querySelector('.delta')?.textContent).toMatch(/[▲▼] [+−]\d\.\d/)
  })

  it('proyección: una nota hipotética en una materia disponible desbloquea otras', async () => {
    cargar()
    const notas = ultimasNotas(notasEjemplo())
    const disponibles = materiasDisponibles(datos.malla, notas).filter((id) => !notas.has(id))
    const aprobada = (id: string) => (notas.get(id) ?? -1) >= datos.malla.nota_aprobacion
    // Una materia disponible cuyo único prerrequisito pendiente sea ella misma desbloquea a su dependiente.
    let elegida = ''
    let desbloquea = ''
    for (const id of disponibles) {
      const dep = datos.malla.prerrequisitos
        .filter((e) => e.de === id)
        .map((e) => e.a)
        .find((d) => !aprobada(d) && datos.malla.prerrequisitos.filter((e) => e.a === d).every((e) => e.de === id || aprobada(e.de)))
      if (dep) {
        elegida = id
        desbloquea = dep
        break
      }
    }
    expect(elegida).not.toBe('')
    const nombre = (id: string) => datos.materiaPorId.get(id)!.nombre

    montar()
    fireEvent.change(deslizador(nombre(elegida)), { target: { value: '4.5' } })
    await waitFor(() => expect(useApp.getState().ajustes[elegida]).toBe(4.5))
    expect(await screen.findByText(/Se desbloquean:/)).toBeTruthy()
    expect(screen.getByText(/Se desbloquean:/).parentElement?.textContent).toContain(nombre(desbloquea))
    // La fila de la materia hipotética sigue ahí (aunque ya no esté «disponible») y se marca como tal.
    expect(screen.getAllByText('hipotética').length).toBeGreaterThan(0)
    expect(useApp.getState().notasReales.some((n) => n.materia === elegida)).toBe(false)
    sinBasura()
  })

  it('anuncia el resultado a lectores de pantalla (una frase, sin saturar)', async () => {
    cargar()
    montar()
    fireEvent.change(deslizador('Cálculo III - Vectorial'), { target: { value: '2' } })
    expect(await screen.findByText(/Escenario actualizado:/, {}, { timeout: 3000 })).toBeTruthy()
  })

  it('cambiar de modelo con un escenario activo mantiene los ajustes y no rompe nada', async () => {
    cargar()
    montar()
    fireEvent.change(deslizador('Cálculo III - Vectorial'), { target: { value: '2.5' } })
    await waitFor(() => expect(useApp.getState().ajustes.MAT1121).toBe(2.5))
    useApp.getState().elegirModelo('red')
    await waitFor(() => expect(screen.getByText('Estás viendo un escenario hipotético')).toBeTruthy())
    expect(useApp.getState().ajustes.MAT1121).toBe(2.5)
    sinBasura()
  })
})
