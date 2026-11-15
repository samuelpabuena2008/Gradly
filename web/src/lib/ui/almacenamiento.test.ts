import { describe, expect, it } from 'vitest'
import { guardarJson, leerJson } from './almacenamiento'

// El entorno global de pruebas es «node»: no hay window ni localStorage (equivale a estar bloqueado).
describe('almacenamiento sin localStorage', () => {
  it('no lanza: devuelve el valor por defecto y avisa que no guardó', () => {
    expect(leerJson('clave', { a: 1 })).toEqual({ a: 1 })
    expect(guardarJson('clave', { a: 2 })).toBe(false)
  })
})
