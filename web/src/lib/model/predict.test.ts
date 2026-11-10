// Predicción con un modelo fijo: el resultado se calcula en papel.

import { describe, expect, it } from 'vitest'
import type { Malla, Modelo, Nota } from '../../types'
import {
  materiasDisponibles,
  normalCdf,
  predecirMateria,
  predecirSiguientes,
  recomendarEnfoque,
  ultimasNotas,
} from './predict'

const malla: Malla = {
  programa: 'mini',
  version: 'prueba',
  nota_aprobacion: 3.0,
  materias: [
    { id: 'CAL1', nombre: 'Cálculo I', semestre: 1, creditos: 4 },
    { id: 'ALGLIN', nombre: 'Álgebra Lineal', semestre: 1, creditos: 3 },
    { id: 'CAL2', nombre: 'Cálculo II', semestre: 2, creditos: 4 },
    { id: 'ED', nombre: 'Ecuaciones', semestre: 3, creditos: 3 },
  ],
  prerrequisitos: [
    { de: 'CAL1', a: 'CAL2' },
    { de: 'CAL2', a: 'ED' },
  ],
  aristas_blandas: [{ de: 'ALGLIN', a: 'ED' }],
}

const modelo: Modelo = {
  tipo: 'regresion_lineal',
  sigma_global: 0.6,
  cursos: {
    ED: { b: -0.2, sigma: 0.5, pesos: { CAL2: 0.6, ALGLIN: 0.2 } },
  },
}

// CAL1 = 4.0, CAL2 = 2.5, ALGLIN = 3.5  →  ȳ = 10 / 3 = 3.333…
const notas = ultimasNotas([
  { materia: 'CAL1', periodo: '2025-1', nota: 4.0 },
  { materia: 'ALGLIN', periodo: '2025-1', nota: 3.5 },
  { materia: 'CAL2', periodo: '2025-2', nota: 2.5 },
])

describe('normalCdf', () => {
  it('Φ(0) = 0,5 y Φ(1,96) ≈ 0,975', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3)
  })
})

describe('predecirMateria', () => {
  it('calcula la fórmula a mano', () => {
    // ŷ = 3,333 − 0,2 + 0,6·(2,5 − 3,333) + 0,2·(3,5 − 3,333) = 2,667
    const p = predecirMateria('ED', malla, modelo, notas)!
    expect(p.nota).toBeCloseTo(8 / 3, 6)
    expect(p.rango[0]).toBeCloseTo(8 / 3 - 0.5, 6)
    expect(p.rango[1]).toBeCloseTo(8 / 3 + 0.5, 6)
    // P(no aprobar) = Φ((3 − 2,667) / 0,5) = Φ(0,667) ≈ 0,748
    expect(p.probNoAprobar).toBeCloseTo(0.7475, 3)
    expect(p.semaforo).toBe('rojo')
    expect(p.usaModelo).toBe(true)
  })

  it('el "por qué" pone primero la materia que más pesa', () => {
    const p = predecirMateria('ED', malla, modelo, notas)!
    expect(p.porQue[0].materia).toBe('CAL2')
    expect(p.porQue[0].aporte).toBeCloseTo(-0.5, 6)
  })

  it('sin pesos para la materia usa el promedio (baseline)', () => {
    const p = predecirMateria('CAL2', malla, modelo, notas)!
    expect(p.nota).toBeCloseTo(10 / 3, 6)
    expect(p.usaModelo).toBe(false)
    expect(p.rango[1] - p.nota).toBeCloseTo(0.6, 6) // usa sigma_global
  })

  it('sin notas no predice', () => {
    expect(predecirMateria('ED', malla, modelo, new Map())).toBeNull()
  })
})

describe('materias disponibles', () => {
  it('CAL2 reprobada (2,5): se puede repetir, ED queda bloqueada', () => {
    expect(materiasDisponibles(malla, notas)).toEqual(['CAL2'])
  })

  it('con CAL2 aprobada se abre ED', () => {
    const conCal2 = new Map(notas).set('CAL2', 3.2)
    expect(materiasDisponibles(malla, conCal2)).toEqual(['ED'])
  })
})

describe('ultimasNotas', () => {
  it('si repitió una materia, cuenta el intento más reciente', () => {
    const repetida: Nota[] = [
      { materia: 'CAL2', periodo: '2025-2', nota: 2.5 },
      { materia: 'CAL2', periodo: '2026-1', nota: 3.4 },
    ]
    expect(ultimasNotas(repetida).get('CAL2')).toBe(3.4)
  })
})

describe('recomendarEnfoque', () => {
  it('sugiere repasar la materia que más baja una predicción en riesgo', () => {
    const lista = [
      { materia: 'CAL1', periodo: '2025-1', nota: 4.0 },
      { materia: 'ALGLIN', periodo: '2025-1', nota: 3.5 },
      { materia: 'CAL2', periodo: '2025-2', nota: 3.0 },
    ]
    const predicciones = predecirSiguientes(malla, modelo, lista)
    expect(predicciones.map((p) => p.materia)).toEqual(['ED'])
    expect(recomendarEnfoque(predicciones)[0].materia).toBe('CAL2')
  })
})
