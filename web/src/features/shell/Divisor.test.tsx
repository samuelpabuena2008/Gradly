// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Divisor } from './Divisor'

afterEach(cleanup)

function montar(direccion: 1 | -1 = 1, ancho = 280) {
  const alCambiar = vi.fn()
  render(<Divisor etiqueta="Ancho del explorador" ancho={ancho} min={220} max={480} inicial={280} direccion={direccion} onCambiar={alCambiar} />)
  return { alCambiar, divisor: screen.getByRole('separator', { name: /ancho del explorador/i }) }
}

describe('Divisor de paneles', () => {
  it('expone el patrón separator de ARIA con sus límites', () => {
    const { divisor } = montar()
    expect(divisor.getAttribute('aria-valuenow')).toBe('280')
    expect(divisor.getAttribute('aria-valuemin')).toBe('220')
    expect(divisor.getAttribute('aria-valuemax')).toBe('480')
    expect(divisor.tabIndex).toBe(0)
  })

  it('las flechas cambian el ancho (Mayús, más rápido) y Home/End van a los límites', async () => {
    const usuario = userEvent.setup()
    const { divisor, alCambiar } = montar()
    divisor.focus()
    await usuario.keyboard('{ArrowRight}')
    expect(alCambiar).toHaveBeenLastCalledWith(296)
    await usuario.keyboard('{ArrowLeft}')
    expect(alCambiar).toHaveBeenLastCalledWith(264)
    await usuario.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(alCambiar).toHaveBeenLastCalledWith(328)
    await usuario.keyboard('{Home}')
    expect(alCambiar).toHaveBeenLastCalledWith(220)
    await usuario.keyboard('{End}')
    expect(alCambiar).toHaveBeenLastCalledWith(480)
  })

  it('en el inspector (dirección −1) la flecha derecha lo achica', async () => {
    const usuario = userEvent.setup()
    const { divisor, alCambiar } = montar(-1, 360)
    divisor.focus()
    await usuario.keyboard('{ArrowRight}')
    expect(alCambiar).toHaveBeenLastCalledWith(344)
  })

  it('doble clic restablece el ancho original', async () => {
    const usuario = userEvent.setup()
    const { divisor, alCambiar } = montar(1, 400)
    await usuario.dblClick(divisor)
    expect(alCambiar).toHaveBeenLastCalledWith(280)
  })
})
