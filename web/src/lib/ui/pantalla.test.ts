import { describe, expect, it } from 'vitest'
import { debeCerrarHoja, modoActual, modoDePantalla, UMBRAL_CIERRE_PX } from './pantalla'

describe('modoDePantalla', () => {
  it('separa amplio, medio y móvil en 1280 y 900 px', () => {
    expect(modoDePantalla(1440)).toBe('amplio')
    expect(modoDePantalla(1280)).toBe('amplio')
    expect(modoDePantalla(1279)).toBe('medio')
    expect(modoDePantalla(900)).toBe('medio')
    expect(modoDePantalla(899)).toBe('movil')
    expect(modoDePantalla(390)).toBe('movil')
  })

  it('con un ancho inválido no rompe: asume amplio', () => {
    expect(modoDePantalla(NaN)).toBe('amplio')
  })

  it('sin matchMedia (jsdom) asume pantalla amplia', () => {
    expect(modoActual()).toBe('amplio')
  })
})

describe('debeCerrarHoja', () => {
  it('cierra con un arrastre largo hacia abajo', () => {
    expect(debeCerrarHoja(UMBRAL_CIERRE_PX, 800)).toBe(true)
    expect(debeCerrarHoja(UMBRAL_CIERRE_PX - 1, 800)).toBe(false)
  })

  it('cierra con un deslizamiento corto pero rápido', () => {
    expect(debeCerrarHoja(40, 40)).toBe(true)
    expect(debeCerrarHoja(40, 400)).toBe(false)
  })

  it('no cierra hacia arriba, sin movimiento ni con datos inválidos', () => {
    expect(debeCerrarHoja(-200, 50)).toBe(false)
    expect(debeCerrarHoja(0, 50)).toBe(false)
    expect(debeCerrarHoja(NaN, 50)).toBe(false)
    expect(debeCerrarHoja(10, 5)).toBe(false)
  })
})
