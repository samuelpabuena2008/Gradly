// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { reiniciarApp } from '../../test/proveedores'
import { useAtajos } from './useAtajos'

beforeEach(reiniciarApp)
afterEach(cleanup)

function Arnes({ ruta }: { ruta: Ruta }) {
  useAtajos(ruta)
  return (
    <>
      <input aria-label="campo" />
      <input data-buscador="materias" aria-label="buscador" />
    </>
  )
}
const montar = (ruta: Ruta = { tipo: 'vista', vista: 'malla' }) => render(<Arnes ruta={ruta} />)

describe('Atajos globales', () => {
  it('Ctrl+K y ⌘+K abren la paleta, incluso escribiendo en un campo', async () => {
    const usuario = userEvent.setup()
    const { getByLabelText } = montar()
    await usuario.keyboard('{Control>}k{/Control}')
    expect(useApp.getState().paletaAbierta).toBe(true)
    useApp.getState().abrirPaleta(false)
    getByLabelText('campo').focus()
    await usuario.keyboard('{Meta>}k{/Meta}')
    expect(useApp.getState().paletaAbierta).toBe(true)
  })

  it('Ctrl+B y Ctrl+Alt+B alternan los paneles', async () => {
    const usuario = userEvent.setup()
    montar()
    const antes = useApp.getState().exploradorAbierto
    await usuario.keyboard('{Control>}b{/Control}')
    expect(useApp.getState().exploradorAbierto).toBe(!antes)
    const insp = useApp.getState().inspectorAbierto
    await usuario.keyboard('{Control>}{Alt>}b{/Alt}{/Control}')
    expect(useApp.getState().inspectorAbierto).toBe(!insp)
  })

  it('Alt+1…5 cambian de vista', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.keyboard('{Alt>}3{/Alt}')
    expect(window.location.hash).toBe('#/predicciones')
    await usuario.keyboard('{Alt>}5{/Alt}')
    expect(window.location.hash).toBe('#/modelo')
    await usuario.keyboard('{Alt>}1{/Alt}')
    expect(window.location.hash).toBe('#/malla')
  })

  it('Alt+W cierra la pestaña de materia activa', async () => {
    const usuario = userEvent.setup()
    useApp.getState().abrirMateria('MAT1031')
    window.location.hash = '#/materia/MAT1031'
    montar({ tipo: 'materia', id: 'MAT1031' })
    await usuario.keyboard('{Alt>}w{/Alt}')
    expect(useApp.getState().pestanas).toEqual([])
    expect(window.location.hash).toBe('#/malla')
  })

  it('«?» abre la ayuda y «/» enfoca el buscador, pero no mientras se escribe', async () => {
    const usuario = userEvent.setup()
    const { getByLabelText } = montar()
    await usuario.keyboard('/')
    await waitFor(() => expect(document.activeElement).toBe(getByLabelText('buscador')))
    getByLabelText('campo').focus()
    await usuario.keyboard('?/')
    expect(useApp.getState().atajosAbiertos).toBe(false)
    expect((getByLabelText('campo') as HTMLInputElement).value).toBe('?/')
    ;(document.activeElement as HTMLElement).blur()
    await usuario.keyboard('?')
    expect(useApp.getState().atajosAbiertos).toBe(true)
  })
})
