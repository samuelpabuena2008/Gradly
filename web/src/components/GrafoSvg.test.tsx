// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { nombreAccesible } from './GrafoSvg'

describe('nombreAccesible (etiqueta en el nombre, WCAG 2.5.3)', () => {
  it('antepone el texto visible cuando la descripción no empieza por él', () => {
    expect(nombreAccesible({ id: 'MAT1031', etiqueta: 'MAT1031', descripcion: 'Álgebra Lineal (MAT1031), semestre 1' })).toBe(
      'MAT1031: Álgebra Lineal (MAT1031), semestre 1',
    )
  })

  it('deja la descripción igual si ya empieza por el texto visible', () => {
    expect(nombreAccesible({ id: 'MAT1031', etiqueta: 'Álgebra Lineal', descripcion: 'Álgebra Lineal (MAT1031), semestre 1' })).toBe(
      'Álgebra Lineal (MAT1031), semestre 1',
    )
  })

  it('reconoce una etiqueta truncada con puntos suspensivos', () => {
    expect(nombreAccesible({ id: 'X', etiqueta: 'Introducción a la I…', descripcion: 'Introducción a la Ingeniería (IST1000)' })).toBe(
      'Introducción a la Ingeniería (IST1000)',
    )
  })

  it('sin etiqueta usa la descripción, y sin ninguna, el id', () => {
    expect(nombreAccesible({ id: 'A', descripcion: 'Descripción' })).toBe('Descripción')
    expect(nombreAccesible({ id: 'A' })).toBe('A')
  })
})
