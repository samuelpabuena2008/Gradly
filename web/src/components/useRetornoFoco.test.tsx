// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Dialog from '@radix-ui/react-dialog'
import '../test/proveedores'
import { useRetornoFoco } from './useRetornoFoco'

afterEach(cleanup)

/** Diálogo controlado desde el estado, sin `Dialog.Trigger`: como los de Gradly. */
function Prueba({ quitarDisparadorAlAbrir = false }: { quitarDisparadorAlAbrir?: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [hayDisparador, setHayDisparador] = useState(true)
  const retorno = useRetornoFoco()
  return (
    <>
      {hayDisparador && (
        <button
          type="button"
          onClick={() => {
            setAbierto(true)
            if (quitarDisparadorAlAbrir) setHayDisparador(false)
          }}
        >
          Abrir diálogo
        </button>
      )}
      <Dialog.Root open={abierto} onOpenChange={setAbierto}>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined} {...retorno}>
            <Dialog.Title>Diálogo de prueba</Dialog.Title>
            <button type="button">Dentro</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

describe('useRetornoFoco', () => {
  it('al cerrar con Esc, el foco vuelve al botón que abrió el diálogo', async () => {
    const usuario = userEvent.setup()
    render(<Prueba />)
    const disparador = screen.getByRole('button', { name: 'Abrir diálogo' })
    await usuario.click(disparador)
    await screen.findByRole('dialog', { name: 'Diálogo de prueba' })
    expect(document.activeElement).not.toBe(disparador) // el foco entró al diálogo

    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(disparador)
  })

  it('funciona también al abrir con el teclado', async () => {
    const usuario = userEvent.setup()
    render(<Prueba />)
    await usuario.tab()
    const disparador = screen.getByRole('button', { name: 'Abrir diálogo' })
    expect(document.activeElement).toBe(disparador)
    await usuario.keyboard('{Enter}')
    await screen.findByRole('dialog')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(disparador))
  })

  it('si quien lo abrió ya no existe, no falla ni lanza el foco a un elemento desconectado', async () => {
    const usuario = userEvent.setup()
    render(<Prueba quitarDisparadorAlAbrir />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir diálogo' }))
    await screen.findByRole('dialog')
    await usuario.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Abrir diálogo' })).toBeNull()
  })
})
