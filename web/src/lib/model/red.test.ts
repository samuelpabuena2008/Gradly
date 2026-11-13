// Contrato con model/: la red debe dar lo mismo en TypeScript y en Python
// (model/tests/test_red.py corre los mismos casos de data/fixtures/red_caso_conocido.json).

import { describe, expect, it } from 'vitest'
import type { Malla, Modelo, Nota } from '../../types'
import caso from '../../../../data/fixtures/red_caso_conocido.json'
import pesosJson from '../../../../data/pesos.json'
import { predecirMateria, notasVigentes, predecirSiguientes, tipoRecomendado, ultimasNotas } from './predict'
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

// Con CAL2 aprobada la única materia disponible es ED, la que sí tiene red en el fixture.
const aprobadas: Nota[] = [
  { materia: 'CAL1', periodo: '2025-1', nota: 4.0 },
  { materia: 'ALGLIN', periodo: '2025-1', nota: 3.5 },
  { materia: 'CAL2', periodo: '2025-2', nota: 3.5 },
]

// Con CAL2 reprobada la única materia disponible es CAL2, sin red en el fixture.
const reprobada: Nota[] = [
  { materia: 'CAL1', periodo: '2025-1', nota: 4.0 },
  { materia: 'ALGLIN', periodo: '2025-1', nota: 3.5 },
  { materia: 'CAL2', periodo: '2025-2', nota: 2.5 },
]

describe('predecirSiguientes con red neuronal', () => {
  it("con tipo 'red' usa la red para la materia que la tiene", () => {
    const predicciones = predecirSiguientes(malla, modelo, aprobadas, 'red')
    expect(predicciones.map((p) => p.materia)).toEqual(['ED'])
    expect(predicciones[0]).toEqual(predecirMateriaRed('ED', malla, modelo, ultimasNotas(aprobadas)))
  })

  it("con tipo 'red' la nota, el rango y el por qué difieren de la regresión", () => {
    const red = predecirSiguientes(malla, modelo, aprobadas, 'red')[0]
    const regresion = predecirSiguientes(malla, modelo, aprobadas, 'regresion')[0]
    // Regresión: 3,1 + nivel 0,2 = 3,3. Red: ȳ + tanh(x·W1 + b1)·W2 + b2 ≈ 3,44.
    expect(regresion.nota).toBeCloseTo(3.3, 6)
    expect(red.nota).toBeCloseTo(3.4428, 3)
    expect(red.rango).not.toEqual(regresion.rango)
    expect(red.porQue).not.toEqual(regresion.porQue)
  })

  it('sin tipo usa la regresión (comportamiento anterior intacto)', () => {
    const porDefecto = predecirSiguientes(malla, modelo, aprobadas)
    expect(porDefecto).toEqual([predecirMateria('ED', malla, modelo, ultimasNotas(aprobadas))])
    expect(predecirSiguientes(malla, modelo, aprobadas, 'regresion')).toEqual(porDefecto)
  })

  it("con tipo 'red' cae en la regresión si la materia no tiene red", () => {
    const predicciones = predecirSiguientes(malla, modelo, reprobada, 'red')
    expect(predicciones.map((p) => p.materia)).toEqual(['CAL2'])
    expect(predicciones[0]).toEqual(predecirMateria('CAL2', malla, modelo, ultimasNotas(reprobada)))
  })

  it('sin notas no predice con ninguno de los dos modelos', () => {
    expect(predecirSiguientes(malla, modelo, [], 'red')).toEqual([])
    expect(predecirSiguientes(malla, modelo, [], 'regresion')).toEqual([])
  })
})

describe('tipoRecomendado', () => {
  it('respeta el modelo recomendado por la validación cruzada', () => {
    const conRed = { ...modelo, validacion: { recomendado: 'red' } } as unknown as Modelo
    expect(tipoRecomendado(conRed)).toBe('red')
  })

  it('sin validación o con un valor desconocido usa la regresión', () => {
    expect(tipoRecomendado(modelo)).toBe('regresion')
    const desconocido = { ...modelo, validacion: { recomendado: 'otro' } } as unknown as Modelo
    expect(tipoRecomendado(desconocido)).toBe('regresion')
  })

  it('data/pesos.json recomienda la regresión', () => {
    expect(tipoRecomendado(pesosJson as unknown as Modelo)).toBe('regresion')
  })
})

describe('notasVigentes', () => {
  it('deja el intento más reciente de cada materia, con su periodo', () => {
    const vigentes = notasVigentes([
      { materia: 'CAL2', periodo: '2025-2', nota: 2.5 },
      { materia: 'CAL1', periodo: '2025-1', nota: 4.0 },
      { materia: 'CAL2', periodo: '2026-1', nota: 3.4 },
    ])
    expect([...vigentes.keys()].sort()).toEqual(['CAL1', 'CAL2'])
    expect(vigentes.get('CAL2')).toEqual({ materia: 'CAL2', periodo: '2026-1', nota: 3.4 })
  })

  it('sin notas devuelve un mapa vacío', () => {
    expect(notasVigentes([]).size).toBe(0)
  })
})
