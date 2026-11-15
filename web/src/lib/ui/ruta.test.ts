import { describe, expect, it } from 'vitest'
import { mismaRuta, parsearHash, rutaAHash, RUTA_INICIAL } from './ruta'

describe('ruta por hash', () => {
  it('reconoce las vistas', () => {
    expect(parsearHash('#/predicciones')).toEqual({ tipo: 'vista', vista: 'predicciones' })
    expect(parsearHash('#/modelo')).toEqual({ tipo: 'vista', vista: 'modelo' })
    expect(parsearHash('#/laboratorio/')).toEqual({ tipo: 'vista', vista: 'laboratorio' })
  })

  it('reconoce una materia y normaliza a mayúsculas', () => {
    expect(parsearHash('#/materia/MAT1101')).toEqual({ tipo: 'materia', id: 'MAT1101' })
    expect(parsearHash('#/materia/mat1101')).toEqual({ tipo: 'materia', id: 'MAT1101' })
  })

  it('cualquier cosa desconocida cae en la malla', () => {
    for (const h of ['', '#', '#/', '#/no-existe', '#/materia', '#/materia/', '#/materia/%E0%A4%A', '#/materia/<script>']) {
      expect(parsearHash(h)).toEqual(RUTA_INICIAL)
    }
  })

  it('ida y vuelta, sin notas en la URL', () => {
    for (const r of [RUTA_INICIAL, { tipo: 'materia', id: 'IST0010' } as const, { tipo: 'vista', vista: 'notas' } as const]) {
      const hash = rutaAHash(r)
      expect(parsearHash(hash)).toEqual(r)
      expect(hash).not.toMatch(/[?&=]/)
    }
  })

  it('compara rutas', () => {
    expect(mismaRuta({ tipo: 'materia', id: 'A' }, { tipo: 'materia', id: 'A' })).toBe(true)
    expect(mismaRuta({ tipo: 'materia', id: 'A' }, { tipo: 'vista', vista: 'malla' })).toBe(false)
  })
})
