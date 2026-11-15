import { describe, expect, it } from 'vitest'
import malla from '../../../../data/malla_sistemas.json'
import type { Malla } from '../../types'
import { ordenTopologico } from '../graph/dag'
import { COLUMNA, FILA, columnasIniciales, contarCruces, interpolar, layoutSemestres } from './layoutMalla'

const m = malla as Malla
const orden = ordenTopologico(m)

describe('layoutSemestres', () => {
  const layout = layoutSemestres(m, orden)

  it('ubica todas las materias, cada una en la columna de su semestre', () => {
    expect(layout.centros.size).toBe(m.materias.length)
    for (const materia of m.materias) {
      const c = layout.centros.get(materia.id)!
      expect(c.x).toBe((materia.semestre - 1) * COLUMNA)
      expect(Number.isFinite(c.y)).toBe(true)
    }
  })

  it('no solapa materias dentro de un semestre', () => {
    for (const ids of layout.columnas.values()) {
      const ys = ids.map((id) => layout.centros.get(id)!.y).sort((a, b) => a - b)
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(FILA)
    }
  })

  it('cruza menos (o igual) que el orden topológico sin ajustar', () => {
    const inicial = new Map<string, { x: number; y: number }>()
    for (const [sem, ids] of columnasIniciales(m, orden)) {
      ids.forEach((id, i) => inicial.set(id, { x: (sem - 1) * COLUMNA, y: (i - (ids.length - 1) / 2) * FILA }))
    }
    expect(contarCruces(m.prerrequisitos, layout.centros)).toBeLessThanOrEqual(contarCruces(m.prerrequisitos, inicial))
  })

  it('es determinista', () => {
    expect([...layoutSemestres(m, orden).centros]).toEqual([...layout.centros])
  })

  it('da un encabezado por semestre, en orden', () => {
    expect(layout.encabezados.map((e) => e.semestre)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('contarCruces', () => {
  it('cuenta una X y no cuenta aristas que comparten extremo', () => {
    const c = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 10, y: 10 }],
      ['c', { x: 0, y: 10 }],
      ['d', { x: 10, y: 0 }],
    ])
    expect(contarCruces([{ de: 'a', a: 'b' }, { de: 'c', a: 'd' }], c)).toBe(1)
    expect(contarCruces([{ de: 'a', a: 'b' }, { de: 'a', a: 'd' }], c)).toBe(0)
  })
})

describe('interpolar', () => {
  it('va de una disposición a otra', () => {
    const a = new Map([['x', { x: 0, y: 0 }]])
    const b = new Map([['x', { x: 10, y: -20 }]])
    expect(interpolar(a, b, 0).get('x')).toEqual({ x: 0, y: 0 })
    expect(interpolar(a, b, 0.5).get('x')).toEqual({ x: 5, y: -10 })
    expect(interpolar(a, b, 2).get('x')).toEqual({ x: 10, y: -20 })
  })
})
