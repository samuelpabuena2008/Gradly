// Contrato con model/: la red debe dar lo mismo en TypeScript y en Python
// (model/tests/test_red.py corre los mismos casos de data/fixtures/red_caso_conocido.json).

import { describe, expect, it } from 'vitest'
import type { Malla, Modelo, Nota } from '../../types'
import caso from '../../../../data/fixtures/red_caso_conocido.json'
import pesosJson from '../../../../data/pesos.json'
import { predecirMateria, ultimasNotas } from './predict'
import { predecirMateriaRed, salidaRed } from './red'

const malla = caso.malla as Malla
const modelo = caso.modelo as Modelo
const decimales = -Math.log10(caso.tolerancia)

describe('red neuronal (mismo caso que Python)', () => {
  for (const c of caso.casos) {
    it(c.nombre, () => {
      const p = predecirMateriaRed(c.materia, malla, modelo, ultimasNotas(c.notas as Nota[]))!
      const e = c.esperado
      expect(p.nota).toBeCloseTo(e.nota, decimales)
      expect(p.rango[0]).toBeCloseTo(e.rango[0], decimales)
      expect(p.rango[1]).toBeCloseTo(e.rango[1], decimales)
      expect(p.probNoAprobar).toBeCloseTo(e.probNoAprobar, decimales)
      expect(p.semaforo).toBe(e.semaforo)
      expect(p.porQue.map((x) => x.materia)).toEqual(e.porQue.map((x) => x.materia))
      p.porQue.forEach((x, i) => expect(x.aporte).toBeCloseTo(e.porQue[i].aporte, decimales))
    })
  }

  it('con entradas en 0 la salida es tanh(b1)·W2 + b2', () => {
    const red = { previas: ['A'], W1: [[2]], b1: [0.5], W2: [3], b2: 1, sigma: 0.4 }
    expect(salidaRed(red, [0])).toBeCloseTo(Math.tanh(0.5) * 3 + 1, 10)
  })

  it('sin red para la materia usa la regresión', () => {
    const notas = new Map([['CAL1', 4.0]])
    expect(predecirMateriaRed('CAL2', malla, modelo, notas)).toEqual(predecirMateria('CAL2', malla, modelo, notas))
  })

  it('data/pesos.json trae una red por cada materia con regresión, con las dimensiones correctas', () => {
    const pesos = pesosJson as unknown as Modelo
    expect(Object.keys(pesos.red!.cursos).sort()).toEqual(Object.keys(pesos.cursos).sort())
    for (const red of Object.values(pesos.red!.cursos)) {
      expect(red.W1.length).toBe(red.previas.length)
      red.W1.forEach((fila) => expect(fila.length).toBe(red.b1.length))
      expect(red.W2.length).toBe(red.b1.length)
    }
  })
})
