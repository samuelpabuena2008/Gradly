import { describe, expect, it } from 'vitest'
import { filtrarDifuso, puntajeDifuso } from './fuzzy'

const materias = ['Cálculo I - Diferencial', 'Cálculo II - Integral', 'Álgebra Lineal', 'Estructuras Discretas']

describe('búsqueda difusa', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(filtrarDifuso(materias, 'calculo', (m) => m)).toHaveLength(2)
    expect(filtrarDifuso(materias, 'ALGEBRA', (m) => m)).toEqual(['Álgebra Lineal'])
  })

  it('acepta letras en orden', () => {
    expect(filtrarDifuso(materias, 'estdis', (m) => m)).toEqual(['Estructuras Discretas'])
    expect(puntajeDifuso('zzz', 'Álgebra')).toBeNull()
  })

  it('premia el inicio de palabra y consulta vacía devuelve todo', () => {
    expect(filtrarDifuso(materias, 'integral', (m) => m)[0]).toBe('Cálculo II - Integral')
    expect(filtrarDifuso(materias, '  ', (m) => m)).toBe(materias)
  })
})
