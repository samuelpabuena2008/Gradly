// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { Logo } from './brand/Logo'

afterEach(cleanup)

function Bomba({ falla }: { falla: boolean }) {
  if (falla) throw new Error('boom de prueba')
  return <p>Todo bien</p>
}

function Contenedor() {
  const [falla, setFalla] = useState(true)
  return (
    <ErrorBoundary vista="la vista Modelo">
      <button onClick={() => setFalla(false)}>Arreglar</button>
      <Bomba falla={falla} />
    </ErrorBoundary>
  )
}

describe('ErrorBoundary', () => {
  it('muestra el error con detalle plegable y permite reintentar', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const usuario = userEvent.setup()
    // El hijo que falla desmonta al botón: el reintento vuelve a intentar el render.
    const { rerender } = render(
      <ErrorBoundary vista="la vista Modelo">
        <Bomba falla />
      </ErrorBoundary>,
    )
    const alerta = screen.getByRole('alert')
    expect(alerta.textContent).toContain('la vista Modelo')
    expect(alerta.textContent).toContain('tus notas no se perdieron')
    expect(screen.getByText('Detalle técnico')).toBeTruthy()
    expect(screen.getByText('boom de prueba')).toBeTruthy()

    rerender(
      <ErrorBoundary vista="la vista Modelo">
        <Bomba falla={false} />
      </ErrorBoundary>,
    )
    await usuario.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(screen.getByText('Todo bien')).toBeTruthy()
    consola.mockRestore()
  })

  it('un cambio de «reiniciarCon» lo reinicia solo', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary vista="x" reiniciarCon="a">
        <Bomba falla />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    rerender(
      <ErrorBoundary vista="x" reiniciarCon="b">
        <Bomba falla={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Todo bien')).toBeTruthy()
    consola.mockRestore()
  })

  it('sin fallos no altera a los hijos', () => {
    render(<Contenedor />)
    expect(screen.queryByText('Todo bien')).toBeNull()
  })
})

describe('Logo', () => {
  it('es accesible y la variante lockup agrega el texto', () => {
    const { container } = render(
      <>
        <Logo variant="mark" size={32} />
        <Logo variant="lockup" size={32} animated />
        <Logo variant="mono" decorativo />
      </>,
    )
    expect(screen.getAllByRole('img', { name: 'Gradly' })).toHaveLength(2)
    expect(container.querySelectorAll('.g-texto')).toHaveLength(1)
    expect(container.querySelectorAll('.logo-animado')).toHaveLength(1)
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })
})
