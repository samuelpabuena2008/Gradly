import { describe, expect, it } from 'vitest'
import { abrirPestana, cerrarPestana, moverPestana, siguienteTrasCerrar } from './pestanas'

describe('pestañas de materia', () => {
  it('abre sin duplicar', () => {
    expect(abrirPestana(['A'], 'A')).toEqual(['A'])
    expect(abrirPestana(['A'], 'B')).toEqual(['A', 'B'])
  })

  it('con el máximo, reemplaza la más antigua', () => {
    const ocho = ['1', '2', '3', '4', '5', '6', '7', '8']
    expect(abrirPestana(ocho, '9')).toEqual(['2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('al cerrar elige la vecina derecha, luego la izquierda, luego nada', () => {
    expect(siguienteTrasCerrar(['A', 'B', 'C'], 'B')).toBe('C')
    expect(siguienteTrasCerrar(['A', 'B', 'C'], 'C')).toBe('B')
    expect(siguienteTrasCerrar(['A'], 'A')).toBeNull()
    expect(cerrarPestana(['A', 'B'], 'A')).toEqual(['B'])
  })

  it('reordena con límites seguros', () => {
    expect(moverPestana(['A', 'B', 'C'], 'A', 2)).toEqual(['B', 'C', 'A'])
    expect(moverPestana(['A', 'B', 'C'], 'C', -5)).toEqual(['C', 'A', 'B'])
    expect(moverPestana(['A', 'B'], 'Z', 0)).toEqual(['A', 'B'])
  })
})
