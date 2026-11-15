// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../test/proveedores'
import { Cajon } from './Cajon'

afterEach(cleanup)

function Prueba({ modal = true, lado = 'derecha' as 'derecha' | 'inferior' }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>
        Abrir panel
      </button>
      <button type="button">Otro control</button>
      <Cajon abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Panel de prueba" lado={lado} modal={modal}>
        <p>Contenido del panel</p>
        <button type="button">Dentro del panel</button>
      </Cajon>
    </>
  )
}

describe('Cajon', () => {
  it('se abre como diálogo con nombre accesible y se cierra con Esc', async () => {
    const usuario = userEvent.setup()
    render(<Prueba />)
    expect(screen.queryByRole('dialog')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Abrir panel' }))
    expect(await screen.findByRole('dialog', { name: 'Panel de prueba' })).toBeTruthy()
    expect(screen.getByText('Contenido del panel')).toBeTruthy()

    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('devuelve el foco a quien lo abrió', async () => {
    const usuario = userEvent.setup()
    render(<Prueba />)
    const abrir = screen.getByRole('button', { name: 'Abrir panel' })
    await usuario.click(abrir)
    await screen.findByRole('dialog')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(abrir))
  })

  it('modal: hay telón y el fondo queda inerte', async () => {
    const usuario = userEvent.setup()
    const { baseElement } = render(<Prueba />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir panel' }))
    await screen.findByRole('dialog')
    expect(baseElement.querySelector('.cajon-telon')).not.toBeNull()
    // Radix oculta el resto de la página a los lectores de pantalla mientras el diálogo es modal.
    expect(screen.queryByRole('button', { name: 'Otro control' })).toBeNull()
  })

  it('no modal (hoja de detalle en móvil): sin telón, el fondo sigue disponible y tocar fuera no cierra', async () => {
    const usuario = userEvent.setup()
    const { baseElement } = render(<Prueba modal={false} lado="inferior" />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir panel' }))
    await screen.findByRole('dialog')
    expect(baseElement.querySelector('.cajon-telon')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Otro control' }))
    expect(screen.getByRole('dialog', { name: 'Panel de prueba' })).toBeTruthy()
  })

  it('la hoja inferior trae un asa de arrastre decorativa; el cajón lateral no', async () => {
    const usuario = userEvent.setup()
    const { baseElement, unmount } = render(<Prueba lado="inferior" />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir panel' }))
    await screen.findByRole('dialog')
    expect(baseElement.querySelector('.cajon-asa')?.getAttribute('aria-hidden')).toBe('true')
    unmount()

    const lateral = render(<Prueba lado="derecha" />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir panel' }))
    await screen.findByRole('dialog')
    expect(lateral.baseElement.querySelector('.cajon-asa')).toBeNull()
  })

  it('deslizar el asa hacia abajo cierra la hoja; un arrastre corto no', async () => {
    const usuario = userEvent.setup()
    const { baseElement } = render(<Prueba lado="inferior" />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir panel' }))
    await screen.findByRole('dialog')
    const asa = baseElement.querySelector('.cajon-asa')!

    // Arrastre corto y lento: vuelve a su sitio, la hoja sigue abierta.
    fireEvent.pointerDown(asa, { clientY: 100, pointerId: 1, timeStamp: 0 })
    fireEvent.pointerMove(asa, { clientY: 110, pointerId: 1 })
    fireEvent.pointerUp(asa, { clientY: 110, pointerId: 1, timeStamp: 900 })
    expect(screen.getByRole('dialog')).toBeTruthy()

    // Arrastre largo hacia abajo: se cierra.
    fireEvent.pointerDown(asa, { clientY: 100, pointerId: 2, timeStamp: 0 })
    fireEvent.pointerMove(asa, { clientY: 260, pointerId: 2 })
    fireEvent.pointerUp(asa, { clientY: 260, pointerId: 2, timeStamp: 400 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
