// @vitest-environment jsdom
// Bienvenida, recorrido guiado y ajustes (persistencia opt-in y borrar datos).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Datos } from '../../lib/ui/arranque'
import { CLAVE_RECORRIDO } from '../../lib/ui/recorrido'
import { CLAVE_NOTAS } from '../../lib/ui/persistencia'
import { useApp } from '../../store/app'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { DialogoAjustes } from '../ayuda/DialogoAjustes'
import { Dialogos } from '../shell/Dialogos'
import { Bienvenida } from './Bienvenida'
import { Recorrido } from './Recorrido'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
})
afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-tour]').forEach((e) => e.remove())
})

describe('Bienvenida', () => {
  it('ofrece los 4 caminos más ingresar manualmente, con la privacidad a la vista', () => {
    render(conProveedores(datos, <Bienvenida />))
    expect(screen.getByRole('button', { name: /Subir certificado PDF/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Subir CSV/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pegar texto/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ver con notas de ejemplo/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ingresar manualmente/ })).toBeTruthy()
    expect(screen.getByText(/no salen de tu computador/)).toBeTruthy()
  })

  it('«Notas de ejemplo» carga las notas; «Explorar la malla primero» la deja ver sin notas', async () => {
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Bienvenida />))
    await usuario.click(screen.getByRole('button', { name: 'Explorar la malla primero' }))
    expect(useApp.getState().bienvenidaDescartada).toBe(true)
    await usuario.click(screen.getByRole('button', { name: /Ver con notas de ejemplo/ }))
    expect(useApp.getState().notasReales).toHaveLength(15)
  })

  it('«Ingresar manualmente» lleva a la vista Notas', async () => {
    render(conProveedores(datos, <Bienvenida />))
    await userEvent.setup().click(screen.getByRole('button', { name: /Ingresar manualmente/ }))
    expect(window.location.hash).toBe('#/notas')
  })
})

/** jsdom no calcula layout: se simula la posición de los elementos que el recorrido señala. */
function simularObjetivos(ids: string[]) {
  ids.forEach((id, i) => {
    const el = document.createElement('div')
    el.dataset.tour = id
    el.getBoundingClientRect = () => ({ top: 50 + i * 10, left: 40, width: 200, height: 300, right: 240, bottom: 350, x: 40, y: 50, toJSON() {} }) as DOMRect
    document.body.appendChild(el)
  })
}

describe('Recorrido guiado', () => {
  it('recorre 5 pasos y al terminar se cierra sin recordar nada (opt-in)', async () => {
    simularObjetivos(['explorador', 'grafo', 'inspector', 'paleta'])
    useApp.setState({ recorridoAbierto: true })
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Recorrido />))
    const dialogo = screen.getByRole('dialog', { name: 'Recorrido guiado' })
    expect(within(dialogo).getByText('Paso 1 de 5')).toBeTruthy()
    expect(within(dialogo).getByRole('heading', { name: 'El explorador' })).toBeTruthy()
    for (let i = 0; i < 4; i++) await usuario.click(within(dialogo).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialogo).getByText('Paso 5 de 5')).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Listo' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useApp.getState().recorridoAbierto).toBe(false)
    expect(window.localStorage.getItem(CLAVE_RECORRIDO)).toBeNull()
  })

  it('«No volver a mostrar» solo se recuerda si el usuario lo marca', async () => {
    simularObjetivos(['explorador'])
    useApp.setState({ recorridoAbierto: true })
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Recorrido />))
    await usuario.click(screen.getByRole('checkbox', { name: /No volver a mostrar/ }))
    await usuario.click(screen.getByRole('button', { name: 'Omitir' }))
    expect(window.localStorage.getItem(CLAVE_RECORRIDO)).toBe('true')
  })

  it('Esc lo omite y Atrás vuelve al paso anterior', async () => {
    simularObjetivos(['explorador', 'grafo'])
    useApp.setState({ recorridoAbierto: true })
    const usuario = userEvent.setup()
    render(conProveedores(datos, <Recorrido />))
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByText('Paso 1 de 3')).toBeTruthy()
    await usuario.keyboard('{Escape}')
    expect(useApp.getState().recorridoAbierto).toBe(false)
  })

  it('los pasos cuyo elemento no está visible se saltan (por ejemplo, paneles cerrados en móvil)', () => {
    useApp.setState({ recorridoAbierto: true })
    render(conProveedores(datos, <Recorrido />))
    expect(screen.getByText('Paso 1 de 1')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tus notas son tuyas' })).toBeTruthy()
  })

  it('el primer botón recibe el foco al abrir (accesible por teclado)', async () => {
    simularObjetivos(['explorador'])
    useApp.setState({ recorridoAbierto: true })
    render(conProveedores(datos, <Recorrido />))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Siguiente' })))
  })
})

describe('Ajustes: persistencia opt-in y borrar datos', () => {
  const montar = () =>
    render(
      conProveedores(
        datos,
        <>
          <DialogoAjustes abierto onCambiar={() => {}} />
          <Dialogos />
        </>,
      ),
    )

  it('la persistencia de notas está apagada por defecto', () => {
    montar()
    expect((screen.getByRole('checkbox', { name: /Recordar mis notas en este navegador/ }) as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole('button', { name: /Borrar datos/ })).toBeTruthy()
  })

  it('al activarla se guardan las notas; al desactivarla se borran de lo guardado', async () => {
    useApp.getState().reemplazarNotas([{ materia: 'MAT1031', periodo: '2025-1', nota: 3 }])
    const usuario = userEvent.setup()
    montar()
    const casilla = screen.getByRole('checkbox', { name: /Recordar mis notas en este navegador/ })
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toBeNull()
    await usuario.click(casilla)
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toContain('MAT1031')
    await usuario.click(casilla)
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toBeNull()
  })

  it('«Borrar datos» pide confirmación y borra también lo guardado', async () => {
    useApp.getState().reemplazarNotas([{ materia: 'MAT1031', periodo: '2025-1', nota: 3 }])
    useApp.getState().fijarPersistirNotas(true)
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /Borrar datos/ }))
    const confirmacion = await screen.findByRole('alertdialog')
    expect(within(confirmacion).getByText(/también las que Gradly había guardado/)).toBeTruthy()
    await usuario.click(within(confirmacion).getByRole('button', { name: 'Borrar notas' }))
    expect(useApp.getState().notasReales).toEqual([])
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toBeNull()
  })
})
