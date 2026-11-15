// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Semaforo } from './Semaforo'

afterEach(cleanup)

describe('Semaforo: nunca solo color', () => {
  const casos = [
    ['verde', 'Vas bien preparado'],
    ['amarillo', 'Conviene reforzar'],
    ['rojo', 'Dale prioridad'],
  ] as const

  for (const [nivel, texto] of casos) {
    it(`${nivel}: texto «${texto}», ícono y clase de color`, () => {
      const { container } = render(<Semaforo nivel={nivel} />)
      expect(screen.getByText(texto)).toBeTruthy()
      expect(container.querySelector('svg')).toBeTruthy()
      expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
      expect(container.querySelector(`.semaforo-${nivel}`)).toBeTruthy()
    })
  }

  it('cada nivel usa un ícono distinto (formas diferentes además del color)', () => {
    const formas = casos.map(([nivel]) => {
      const { container, unmount } = render(<Semaforo nivel={nivel} />)
      const forma = container.querySelector('svg')!.innerHTML
      unmount()
      return forma
    })
    expect(new Set(formas).size).toBe(3)
  })

  it('en modo compacto el texto sigue disponible para lectores de pantalla', () => {
    const { container } = render(<Semaforo nivel="amarillo" compacto />)
    expect(container.querySelector('.solo-lectores')?.textContent).toBe('Conviene reforzar')
    expect(container.querySelector('[title="Conviene reforzar"]')).toBeTruthy()
  })
})
