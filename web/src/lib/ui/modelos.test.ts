import { describe, expect, it } from 'vitest'
import type { Modelo } from '../../types'
import pesos from '../../../../data/pesos.json'
import { otroModelo, tieneRed } from './modelos'

describe('modelos', () => {
  it('detecta si pesos.json trae red neuronal', () => {
    expect(tieneRed(pesos as unknown as Modelo)).toBe(true)
    const { red: _red, ...sinRed } = pesos as unknown as Modelo
    expect(tieneRed(sinRed as Modelo)).toBe(false)
    expect(tieneRed({ ...sinRed, red: { activacion: 'tanh', cursos: {} } } as Modelo)).toBe(false)
  })

  it('alterna entre los dos modelos', () => {
    expect(otroModelo('regresion')).toBe('red')
    expect(otroModelo('red')).toBe('regresion')
  })
})
