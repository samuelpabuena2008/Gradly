import { describe, expect, it } from 'vitest'
import type { Nota } from '../../types'
import { ultimasNotas } from '../model/predict'
import { ajustesEfectivos, notasEfectivas, parsearNota, PERIODO_HIPOTETICO } from './escenario'

const reales: Nota[] = [
  { materia: 'A', periodo: '2024-1', nota: 2.0 },
  { materia: 'A', periodo: '2024-2', nota: 3.5 },
  { materia: 'B', periodo: '2024-1', nota: 4.0 },
]

describe('escenario = reales + ajustes', () => {
  it('sin ajustes devuelve las notas reales tal cual', () => {
    expect(notasEfectivas(reales, {})).toBe(reales)
  })

  it('el ajuste reemplaza el intento vigente y conserva su periodo', () => {
    const e = notasEfectivas(reales, { A: 4.84 })
    expect(e).toContainEqual({ materia: 'A', periodo: '2024-2', nota: 4.8 })
    expect(e).toContainEqual({ materia: 'A', periodo: '2024-1', nota: 2.0 })
    expect(ultimasNotas(e).get('A')).toBe(4.8)
  })

  it('nunca modifica las notas reales (fuente de verdad)', () => {
    const copia = JSON.parse(JSON.stringify(reales))
    notasEfectivas(reales, { A: 5, B: 0 })
    expect(reales).toEqual(copia)
  })

  it('una materia sin intento recibe una nota hipotética', () => {
    const e = notasEfectivas(reales, { C: 3.2 })
    expect(e).toContainEqual({ materia: 'C', periodo: PERIODO_HIPOTETICO, nota: 3.2 })
    expect(ultimasNotas(e).get('C')).toBe(3.2)
  })

  it('descarta los ajustes que igualan la nota real', () => {
    expect(ajustesEfectivos(reales, { A: 3.5, B: 3.0, C: 2 })).toEqual({ B: 3.0, C: 2 })
  })
})

describe('validación de notas escritas', () => {
  it('acepta 0, 5, coma, punto y decimales', () => {
    expect(parsearNota('0')).toBe(0)
    expect(parsearNota('5.0')).toBe(5)
    expect(parsearNota('4,5')).toBe(4.5)
    expect(parsearNota(' 3.75 ')).toBe(3.75)
  })

  it('rechaza fuera de rango, texto y vacío', () => {
    for (const t of ['-1', '5.1', 'abc', '', '  ', '3,5,1', '1e1', '.']) expect(parsearNota(t)).toBeNull()
  })
})
