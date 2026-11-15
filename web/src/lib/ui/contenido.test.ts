// Pruebas de la lógica de UI de la Fase 4: historial, comparación de modelos, vecindad,
// predicciones, algoritmo de Kahn, métricas y desglose de la fórmula.

import { describe, expect, it } from 'vitest'
import malla from '../../../../data/malla_sistemas.json'
import pesos from '../../../../data/pesos.json'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import type { Malla, Modelo, Nota, Prediccion } from '../../types'
import { ordenTopologico } from '../graph/dag'
import { parsearNotasCsv } from '../import/csv'
import { predecirMateria, predecirSiguientes, ultimasNotas } from '../model/predict'
import { compararModelos } from './comparar'
import { descomponerRegresion } from './descomposicion'
import { historialIntentos } from './intentos'
import { pasosKahn } from './kahn'
import { leerMetricas } from './metricas'
import { cargaSugerida, CREDITOS_CARGA_ORIENTATIVA, filtrarPredicciones, ordenarPredicciones, resumirPredicciones } from './predicciones'
import { layoutVecindario, vecindario } from './vecindario'

const m = malla as Malla
const modelo = pesos as unknown as Modelo
const notas: Nota[] = parsearNotasCsv(plantilla).notas
const mapa = ultimasNotas(notas)

describe('historialIntentos', () => {
  const reales: Nota[] = [
    { materia: 'A', periodo: '2025-1', nota: 2.1 },
    { materia: 'B', periodo: '2024-1', nota: 4 },
    { materia: 'A', periodo: '2024-1', nota: 1.5 },
    { materia: 'A', periodo: '2025-2', nota: 3.4 },
  ]
  it('ordena por periodo y marca como vigente el más reciente', () => {
    const h = historialIntentos(reales, 'A', 3)
    expect(h.map((i) => i.periodo)).toEqual(['2024-1', '2025-1', '2025-2'])
    expect(h.map((i) => i.aprobado)).toEqual([false, false, true])
    expect(h.map((i) => i.vigente)).toEqual([false, false, true])
  })
  it('vacío si la materia nunca se cursó', () => {
    expect(historialIntentos(reales, 'Z', 3)).toEqual([])
  })
  it('con el mismo periodo gana el último que llegó', () => {
    const h = historialIntentos(
      [
        { materia: 'A', periodo: '2025-1', nota: 2 },
        { materia: 'A', periodo: '2025-1', nota: 3.5 },
      ],
      'A',
      3,
    )
    expect(h.at(-1)).toMatchObject({ nota: 3.5, vigente: true })
  })
})

describe('compararModelos', () => {
  it('llama a cada modelo por separado y calcula la diferencia red − regresión', () => {
    const disponibles = predecirSiguientes(m, modelo, notas, 'regresion')
    expect(disponibles.length).toBeGreaterThan(0)
    const c = compararModelos(disponibles[0].materia, m, modelo, mapa)
    expect(c.regresion).not.toBeNull()
    expect(c.red).not.toBeNull()
    expect(c.diferencia).toBeCloseTo(c.red!.nota - c.regresion!.nota, 10)
  })
  it('sin red en el modelo, la red es null (no se compara un modelo consigo mismo)', () => {
    const sinRed = { ...modelo, red: undefined } as Modelo
    const c = compararModelos('MAT1121', m, sinRed, mapa)
    expect(c.red).toBeNull()
    expect(c.diferencia).toBeNull()
    expect(c.semaforosDistintos).toBe(false)
  })
  it('sin notas no hay predicciones (null, nunca NaN)', () => {
    const c = compararModelos('MAT1121', m, modelo, new Map())
    expect(c.regresion).toBeNull()
    expect(c.diferencia).toBeNull()
  })
})

describe('vecindario', () => {
  it('trae prerrequisitos y dependientes a distancia 1 y 2, con nivel con signo', () => {
    const v = vecindario(m, 'MAT1121', 2)
    expect(v.niveles.get('MAT1121')).toBe(0)
    for (const e of m.prerrequisitos) {
      if (e.a === 'MAT1121') expect(v.niveles.get(e.de)).toBe(-1)
      if (e.de === 'MAT1121') expect(v.niveles.get(e.a)).toBe(1)
    }
    for (const e of v.aristas) {
      expect(v.niveles.has(e.de) && v.niveles.has(e.a)).toBe(true)
    }
  })
  it('una materia sin vecinos queda sola y el layout no falla', () => {
    const solo: Malla = { ...m, prerrequisitos: [], aristas_blandas: [] }
    const v = vecindario(solo, 'MAT1121')
    expect([...v.niveles.keys()]).toEqual(['MAT1121'])
    const l = layoutVecindario(v)
    expect(l.puntos.size).toBe(1)
    expect(Number.isFinite(l.ancho) && Number.isFinite(l.alto)).toBe(true)
  })
  it('no solapa materias dentro de una misma columna', () => {
    for (const mat of m.materias) {
      const l = layoutVecindario(vecindario(m, mat.id, 2))
      const porX = new Map<number, number[]>()
      for (const p of l.puntos.values()) porX.set(p.x, [...(porX.get(p.x) ?? []), p.y])
      for (const ys of porX.values()) {
        const o = [...ys].sort((a, b) => a - b)
        for (let i = 1; i < o.length; i++) expect(o[i] - o[i - 1]).toBeGreaterThanOrEqual(40)
      }
    }
  })
})

function pred(materia: string, nota: number, prob: number, semaforo: Prediccion['semaforo']): Prediccion {
  return { materia, nota, rango: [nota - 0.4, nota + 0.4], probNoAprobar: prob, semaforo, porQue: [], usaModelo: true }
}

describe('predicciones: orden, filtro y KPIs', () => {
  const preds = [pred('MAT1121', 3.1, 0.45, 'amarillo'), pred('FIS1043', 2.4, 0.8, 'rojo'), pred('IST2110', 4.2, 0.02, 'verde')]
  const semestreDe = (id: string) => m.materias.find((x) => x.id === id)!.semestre

  it('ordena por riesgo, nota y semestre sin mutar la entrada', () => {
    const copia = [...preds]
    expect(ordenarPredicciones(preds, 'riesgo', semestreDe).map((p) => p.materia)).toEqual(['FIS1043', 'MAT1121', 'IST2110'])
    expect(ordenarPredicciones(preds, 'nota', semestreDe).map((p) => p.materia)).toEqual(['FIS1043', 'MAT1121', 'IST2110'])
    const porSem = ordenarPredicciones(preds, 'semestre', semestreDe).map((p) => semestreDe(p.materia))
    expect(porSem).toEqual([...porSem].sort((a, b) => a - b))
    expect(preds).toEqual(copia)
  })
  it('filtra por semáforo', () => {
    expect(filtrarPredicciones(preds, 'todos')).toHaveLength(3)
    expect(filtrarPredicciones(preds, 'rojo').map((p) => p.materia)).toEqual(['FIS1043'])
  })
  it('resume conteos, promedio y carga sugerida sin pasar del tope', () => {
    const r = resumirPredicciones(preds, m)
    expect([r.verde, r.amarillo, r.rojo, r.total]).toEqual([1, 1, 1, 3])
    expect(r.notaPromedio).toBeCloseTo((3.1 + 2.4 + 4.2) / 3, 10)
    expect(r.carga.creditos).toBeLessThanOrEqual(CREDITOS_CARGA_ORIENTATIVA)
  })
  it('sin predicciones: promedio null y carga vacía', () => {
    const r = resumirPredicciones([], m)
    expect(r.notaPromedio).toBeNull()
    expect(r.carga).toEqual({ materias: [], creditos: 0 })
  })
  it('la carga sugerida respeta el tope aunque haya muchas materias', () => {
    const todas = m.materias.map((x) => pred(x.id, 3.5, 0.1, 'verde'))
    const c = cargaSugerida(todas, m, 12)
    expect(c.creditos).toBeLessThanOrEqual(12)
    expect(c.materias.length).toBeGreaterThan(0)
  })
})

describe('pasosKahn', () => {
  const pasos = pasosKahn(m)
  it('termina con el mismo orden que ordenTopologico', () => {
    expect(pasos.at(-1)!.orden).toEqual(ordenTopologico(m))
  })
  it('el paso 0 es el estado inicial y cada paso saca exactamente una materia', () => {
    expect(pasos[0].sale).toBeNull()
    expect(pasos).toHaveLength(m.materias.length + 1)
    pasos.slice(1).forEach((p, i) => {
      expect(p.sale).toBe(p.orden[i])
      expect(p.orden).toHaveLength(i + 1)
    })
  })
  it('las materias liberadas entran a la cola con grado de entrada 0', () => {
    for (const p of pasos.slice(1)) {
      for (const l of p.liberadas) {
        expect(p.entrada[l]).toBe(0)
        expect(p.cola.includes(l) || p.orden.includes(l)).toBe(true)
      }
    }
    expect(Object.values(pasos.at(-1)!.entrada).every((g) => g === 0)).toBe(true)
  })
})

describe('leerMetricas', () => {
  it('lee las métricas reales de pesos.json', () => {
    const mt = leerMetricas(modelo)!
    expect(mt.regresion.mae).toBeCloseTo((pesos as any).metricas.regresion.mae, 10)
    expect(mt.validacion.calibracionRegresion?.semaforo.rojo?.n).toBeGreaterThan(0)
    expect(mt.validacion.regresionVsBaseline!.ic95[0]).toBeLessThan(mt.validacion.regresionVsBaseline!.ic95[1])
  })
  it('null si el modelo no trae métricas, y tolera datos corruptos', () => {
    expect(leerMetricas({ ...modelo, metricas: undefined, validacion: undefined } as unknown as Modelo)).toBeNull()
    const raro = leerMetricas({ metricas: { regresion: { mae: 'x' } }, validacion: { calibracion: 5 } } as unknown as Modelo)!
    expect(raro.regresion.mae).toBeUndefined()
    expect(raro.validacion.calibracionRegresion).toBeUndefined()
  })
})

describe('descomponerRegresion', () => {
  it('suma lo mismo que predecirMateria (antes de limitar a 0–5)', () => {
    const disponibles = predecirSiguientes(m, modelo, notas, 'regresion').filter((p) => p.usaModelo)
    expect(disponibles.length).toBeGreaterThan(0)
    for (const p of disponibles) {
      const d = descomponerRegresion(p.materia, modelo, mapa)!
      const esperado = predecirMateria(p.materia, m, modelo, mapa)!
      expect(Math.min(5, Math.max(0, d.bruta))).toBeCloseTo(esperado.nota, 10)
      expect(d.aporteNivel + d.aportePrevias + d.media + d.ajuste).toBeCloseTo(d.bruta, 10)
    }
  })
  it('null si la materia no tiene pesos o no hay notas', () => {
    expect(descomponerRegresion('XXX', modelo, mapa)).toBeNull()
    expect(descomponerRegresion('MAT1121', modelo, new Map())).toBeNull()
  })
})
