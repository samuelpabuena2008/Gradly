import { describe, expect, it } from 'vitest'
import type { Malla, Prediccion } from '../../types'
import { describirNivel, estadoMateria, valorMateria } from './estado'

const malla = { nota_aprobacion: 3, materias: [] } as unknown as Malla
const pred = { materia: 'C', nota: 3.74, rango: [3, 4], probNoAprobar: 0.1, semaforo: 'verde', porQue: [], usaModelo: true } as Prediccion

describe('estadoMateria', () => {
  const notas = new Map([['A', 4.2], ['B', 2.1]])
  const preds = new Map([['C', pred]])

  it('aprobada, reprobada, disponible y bloqueada', () => {
    expect(estadoMateria('A', malla, notas, preds)).toEqual({ tipo: 'aprobada', nota: 4.2 })
    expect(estadoMateria('B', malla, notas, preds)).toEqual({ tipo: 'reprobada', nota: 2.1 })
    expect(estadoMateria('C', malla, notas, preds).tipo).toBe('disponible')
    expect(estadoMateria('D', malla, notas, preds)).toEqual({ tipo: 'bloqueada' })
  })

  it('3,0 justo aprueba', () => {
    expect(estadoMateria('X', malla, new Map([['X', 3]]), new Map()).tipo).toBe('aprobada')
  })

  it('valorMateria nunca produce NaN ni undefined', () => {
    expect(valorMateria({ tipo: 'aprobada', nota: 4.25 })).toBe('4.3')
    expect(valorMateria({ tipo: 'disponible', prediccion: pred })).toBe('3.7')
    expect(valorMateria({ tipo: 'bloqueada' })).toBeNull()
    expect(valorMateria({ tipo: 'disponible', prediccion: { ...pred, nota: NaN } })).toBeNull()
  })
})

describe('describirNivel', () => {
  it('traduce el nivel a lenguaje claro y tolera NaN', () => {
    expect(describirNivel(0)).toBe('Nivel cerca del promedio')
    expect(describirNivel(0.5)).toBe('Nivel muy por encima del promedio')
    expect(describirNivel(-0.2)).toBe('Nivel por debajo del promedio')
    expect(describirNivel(NaN)).toBe('Nivel por estimar')
  })
})
