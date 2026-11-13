// Predicción con un modelo fijo: el resultado se calcula en papel.

import { describe, expect, it } from 'vitest'
import type { Malla, Modelo, Nota, Prediccion } from '../../types'
import {
  materiasDisponibles,
  normalCdf,
  predecirMateria,
  predecirSiguientes,
  recomendarContenidosCruzados,
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
  tipo: 'regresion_nivel',
  sigma_global: 0.6,
  k_nivel: 1,
  medias: { CAL1: 3.6, ALGLIN: 3.4, CAL2: 3.2, ED: 3.1 },
  cursos: {
    ED: { b: -0.1, beta: 1.1, sigma: 0.5, pesos: { CAL2: 0.6, ALGLIN: 0.2 } },
  },
}

// CAL1 = 4.0, ALGLIN = 3.5, CAL2 = 2.5  →  desviaciones +0,4, +0,1 y −0,7
// nivel a = (0,4 + 0,1 − 0,7) / (3 + 1) = −0,05
const notas = ultimasNotas([
  { materia: 'CAL1', periodo: '2025-1', nota: 4.0 },
  { materia: 'ALGLIN', periodo: '2025-1', nota: 3.5 },
  { materia: 'CAL2', periodo: '2025-2', nota: 2.5 },
])

// Malla con un cuello de botella: CUELLO recibe de S1, S2 y PREV_A, y abre OBJ1, OBJ2 y OBJ3.
// Es el nodo con más intermediación y más grado de salida, así que su factor de centralidad es 2.
const mallaCuello: Malla = {
  programa: 'cuello',
  version: 'prueba',
  nota_aprobacion: 3.0,
  materias: [
    { id: 'PREV_A', nombre: 'Previa A', semestre: 1, creditos: 3 },
    { id: 'PREV_B', nombre: 'Previa B', semestre: 1, creditos: 3 },
    { id: 'S1', nombre: 'Fuente 1', semestre: 1, creditos: 2 },
    { id: 'S2', nombre: 'Fuente 2', semestre: 1, creditos: 2 },
    { id: 'CUELLO', nombre: 'Cuello', semestre: 2, creditos: 4 },
    { id: 'OBJ1', nombre: 'Objetivo 1', semestre: 3, creditos: 3 },
    { id: 'OBJ2', nombre: 'Objetivo 2', semestre: 3, creditos: 3 },
    { id: 'OBJ3', nombre: 'Objetivo 3', semestre: 3, creditos: 3 },
  ],
  prerrequisitos: [
    { de: 'PREV_A', a: 'CUELLO' },
    { de: 'S1', a: 'CUELLO' },
    { de: 'S2', a: 'CUELLO' },
    { de: 'PREV_B', a: 'OBJ1' },
    { de: 'CUELLO', a: 'OBJ1' },
    { de: 'CUELLO', a: 'OBJ2' },
    { de: 'CUELLO', a: 'OBJ3' },
  ],
  aristas_blandas: [],
}

const prediccionesCuello: Prediccion[] = [
  {
    materia: 'CUELLO',
    nota: 3.1,
    rango: [2.6, 3.6],
    probNoAprobar: 0.3,
    semaforo: 'amarillo',
    porQue: [{ materia: 'PREV_A', aporte: -0.3 }],
    usaModelo: true,
  },
  {
    materia: 'OBJ1',
    nota: 3.0,
    rango: [2.5, 3.5],
    probNoAprobar: 0.35,
    semaforo: 'amarillo',
    porQue: [{ materia: 'PREV_B', aporte: -0.4 }],
    usaModelo: true,
  },
]

// Malla con contenidos puente: PREV_A, PREV_B y PREV_C alimentan OBJ con temas puntuales.
const mallaCruzada: Malla = {
  programa: 'cruzada',
  version: 'prueba',
  nota_aprobacion: 3.0,
  materias: [
    { id: 'PREV_A', nombre: 'Previa A', semestre: 1, creditos: 3 },
    { id: 'PREV_B', nombre: 'Previa B', semestre: 1, creditos: 3 },
    { id: 'PREV_C', nombre: 'Previa C', semestre: 1, creditos: 3 },
    { id: 'PREV_D', nombre: 'Previa D', semestre: 1, creditos: 3 },
    { id: 'OBJ', nombre: 'Objetivo', semestre: 2, creditos: 4 },
  ],
  prerrequisitos: [
    { de: 'PREV_A', a: 'OBJ' },
    { de: 'PREV_B', a: 'OBJ' },
  ],
  aristas_blandas: [],
  contenidos_cruzados: [
    { de: 'PREV_A', a: 'OBJ', temas: ['Tema A1'] },
    { de: 'PREV_B', a: 'OBJ', temas: ['Tema B1', 'Tema B2'] },
    { de: 'PREV_C', a: 'OBJ', temas: ['Tema C1'] },
  ],
}

const prediccionEnRiesgo: Prediccion = {
  materia: 'OBJ',
  nota: 2.7,
  rango: [2.2, 3.2],
  probNoAprobar: 0.6,
  semaforo: 'rojo',
  porQue: [
    { materia: 'PREV_A', aporte: -0.2 },
    { materia: 'PREV_B', aporte: -0.5 },
  ],
  usaModelo: true,
}

describe('normalCdf', () => {
  it('Φ(0) = 0,5 y Φ(1,96) ≈ 0,975', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3)
  })
})

describe('predecirMateria', () => {
  it('calcula la fórmula a mano', () => {
    // z(CAL2) = −0,7 + 0,05 = −0,65   z(ALGLIN) = 0,1 + 0,05 = 0,15
    // ŷ = 3,1 − 0,1 + 1,1·(−0,05) + 0,6·(−0,65) + 0,2·(0,15) = 2,585
    const p = predecirMateria('ED', malla, modelo, notas)!
    expect(p.nota).toBeCloseTo(2.585, 6)
    expect(p.rango[0]).toBeCloseTo(2.085, 6)
    expect(p.rango[1]).toBeCloseTo(3.085, 6)
    // P(no aprobar) = Φ((3 − 2,585) / 0,5) = Φ(0,83) ≈ 0,797
    expect(p.probNoAprobar).toBeCloseTo(0.7967, 3)
    expect(p.semaforo).toBe('rojo')
    expect(p.usaModelo).toBe(true)
  })

  it('el "por qué" pone primero la materia que más pesa', () => {
    const p = predecirMateria('ED', malla, modelo, notas)!
    expect(p.porQue[0].materia).toBe('CAL2')
    expect(p.porQue[0].aporte).toBeCloseTo(-0.39, 6)
  })

  it('sin pesos para la materia usa su media más el nivel del estudiante', () => {
    const p = predecirMateria('CAL2', malla, modelo, notas)!
    expect(p.nota).toBeCloseTo(3.2 - 0.05, 6)
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

  it('sin malla ordena solo por el aporte, sin pesar la centralidad', () => {
    // PREV_B baja más que PREV_A, así que sin malla va primero.
    expect(recomendarEnfoque(prediccionesCuello).map((e) => e.materia)).toEqual(['PREV_B', 'PREV_A'])
    expect(recomendarEnfoque(prediccionesCuello)[0].impacto).toBeCloseTo(-0.4, 6)
  })

  it('con malla prioriza la materia que alimenta un cuello de botella del DAG', () => {
    // CUELLO tiene la mayor intermediación y el mayor grado de salida: factor 2.
    // PREV_A = −0,3 · 2 = −0,6 pasa por delante de PREV_B = −0,4 · 1 = −0,4.
    const lista = recomendarEnfoque(prediccionesCuello, mallaCuello)
    expect(lista.map((e) => e.materia)).toEqual(['PREV_A', 'PREV_B'])
    expect(lista[0].impacto).toBeCloseTo(-0.6, 6)
    expect(lista[1].impacto).toBeCloseTo(-0.4, 6)
  })
})

describe('recomendarContenidosCruzados', () => {
  it('devuelve los temas de las previas que bajan la nota, de mayor a menor impacto', () => {
    const contenidos = recomendarContenidosCruzados(prediccionEnRiesgo, mallaCruzada)
    expect(contenidos.map((c) => c.previa)).toEqual(['PREV_B', 'PREV_A'])
    expect(contenidos.map((c) => c.aporte)).toEqual([-0.5, -0.2])
    expect(contenidos[0].temas).toEqual(['Tema B1', 'Tema B2'])
  })

  it('no sugiere nada si la materia va en verde', () => {
    expect(recomendarContenidosCruzados({ ...prediccionEnRiesgo, semaforo: 'verde' }, mallaCruzada)).toEqual([])
  })

  it('ignora previas con aporte positivo o sin contenidos cruzados', () => {
    // PREV_C suma a favor y PREV_D no tiene contenidos puente hacia OBJ.
    const contenidos = recomendarContenidosCruzados(
      {
        ...prediccionEnRiesgo,
        porQue: [
          { materia: 'PREV_C', aporte: 0.3 },
          { materia: 'PREV_D', aporte: -0.9 },
          { materia: 'PREV_A', aporte: -0.2 },
        ],
      },
      mallaCruzada,
    )
    expect(contenidos.map((c) => c.previa)).toEqual(['PREV_A'])
  })

  it('no sugiere nada si la malla no trae contenidos cruzados', () => {
    expect(recomendarContenidosCruzados(prediccionEnRiesgo, { ...mallaCruzada, contenidos_cruzados: [] })).toEqual([])
  })
})
