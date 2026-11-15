import { describe, expect, it } from 'vitest'
import malla from '../../../../data/malla_sistemas.json'
import type { Malla } from '../../types'
import { ordenTopologico } from '../graph/dag'
import { simularFuerzas } from './fuerzas'
import { layoutSemestres } from './layoutMalla'

const m = malla as Malla
const ids = m.materias.map((x) => x.id)
const aristas = [...m.prerrequisitos, ...m.aristas_blandas]
const inicial = layoutSemestres(m, ordenTopologico(m)).centros

describe('simularFuerzas', () => {
  const r = simularFuerzas(ids, aristas, inicial, { radio: () => 50 })

  it('devuelve posiciones finitas para todas las materias', () => {
    expect(r.size).toBe(ids.length)
    for (const p of r.values()) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('es determinista', () => {
    expect([...simularFuerzas(ids, aristas, inicial, { radio: () => 50 })]).toEqual([...r])
  })

  it('separa las materias (ningún par queda prácticamente encima de otro)', () => {
    const ps = [...r.values()]
    let minimo = Infinity
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) minimo = Math.min(minimo, Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y))
    expect(minimo).toBeGreaterThan(40)
  })

  it('acerca las materias conectadas más que el promedio', () => {
    const d = (a: string, b: string) => Math.hypot(r.get(a)!.x - r.get(b)!.x, r.get(a)!.y - r.get(b)!.y)
    const conectadas = m.prerrequisitos.reduce((s, e) => s + d(e.de, e.a), 0) / m.prerrequisitos.length
    let total = 0
    let n = 0
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        total += d(ids[i], ids[j])
        n++
      }
    expect(conectadas).toBeLessThan(total / n)
  })

  it('no falla con un grafo vacío ni con puntos coincidentes', () => {
    expect(simularFuerzas([], [], new Map()).size).toBe(0)
    const mismos = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 0 }],
    ])
    const s = simularFuerzas(['a', 'b'], [{ de: 'a', a: 'b' }], mismos, { iteraciones: 50 })
    expect(Number.isFinite(s.get('a')!.x)).toBe(true)
    expect(s.get('a')).not.toEqual(s.get('b'))
  })
})
