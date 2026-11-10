// Pruebas con resultado conocido: malla pequeña calculada a mano (data/malla_prueba.json).
//
//   A ──► B ──► D ──► E
//    └──► C ──┘
//   F (aislada)

import { describe, expect, it } from 'vitest'
import type { Malla } from '../../types'
import mallaPrueba from '../../../../data/malla_prueba.json'
import mallaSistemas from '../../../../data/malla_sistemas.json'
import {
  caminoMasLargo,
  descendientes,
  gradoSalida,
  intermediacion,
  ordenTopologico,
  predecesores,
} from './dag'

const malla = mallaPrueba as Malla

describe('orden topológico', () => {
  it('respeta todos los prerrequisitos', () => {
    const orden = ordenTopologico(malla)
    expect(orden).toHaveLength(6)
    for (const { de, a } of malla.prerrequisitos) {
      expect(orden.indexOf(de)).toBeLessThan(orden.indexOf(a))
    }
  })

  it('detecta un ciclo', () => {
    const conCiclo: Malla = {
      ...malla,
      prerrequisitos: [...malla.prerrequisitos, { de: 'E', a: 'A' }],
    }
    expect(() => ordenTopologico(conCiclo)).toThrow(/ciclo/)
  })

  it('la malla de Sistemas no tiene ciclos (ni con aristas blandas)', () => {
    expect(() => ordenTopologico(mallaSistemas as Malla, true)).not.toThrow()
  })
})

describe('camino más largo', () => {
  it('tiene 4 materias: A → (B o C) → D → E', () => {
    const camino = caminoMasLargo(malla)
    expect(camino).toHaveLength(4)
    expect(camino[0]).toBe('A')
    expect(['B', 'C']).toContain(camino[1])
    expect(camino.slice(2)).toEqual(['D', 'E'])
  })
})

describe('centralidad', () => {
  it('grado de salida calculado a mano', () => {
    expect(gradoSalida(malla)).toEqual({ A: 2, B: 1, C: 1, D: 1, E: 0, F: 0 })
  })

  it('intermediación calculada a mano: D = 3, B = C = 1', () => {
    expect(intermediacion(malla)).toEqual({ A: 0, B: 1, C: 1, D: 3, E: 0, F: 0 })
  })
})

describe('descendientes y predecesores', () => {
  it('si va mal en B, se afectan D y E', () => {
    expect(descendientes(malla, 'B')).toEqual(['D', 'E'])
  })

  it('A abre todo menos F', () => {
    expect(descendientes(malla, 'A')).toEqual(['B', 'C', 'D', 'E'])
  })

  it('D tiene como prerrequisitos a B y C', () => {
    expect(predecesores(malla, 'D').sort()).toEqual(['B', 'C'])
  })
})
