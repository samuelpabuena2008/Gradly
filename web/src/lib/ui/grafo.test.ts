import { describe, expect, it } from 'vitest'
import malla from '../../../../data/malla_sistemas.json'
import type { Malla } from '../../types'
import { caminoMasLargo, intermediacion, ordenTopologico } from '../graph/dag'
import {
  RADIO,
  aristasDeCamino,
  construirVecindad,
  cuellosDeBotella,
  describirNodo,
  navegar,
  radioNodo,
  vecinos,
  type ContextoNavegacion,
} from './grafo'
import { layoutSemestres } from './layoutMalla'

const m = malla as Malla
const inter = intermediacion(m)
const orden = ordenTopologico(m)
const vecindad = construirVecindad(m, false)

describe('vecindad', () => {
  it('incluye la materia, sus prerrequisitos y sus dependientes', () => {
    const e = m.prerrequisitos[0]
    expect(vecinos(vecindad, e.a).has(e.de)).toBe(true)
    expect(vecinos(vecindad, e.de).has(e.a)).toBe(true)
    expect(vecinos(vecindad, e.a).has(e.a)).toBe(true)
  })

  it('con aristas blandas suma relaciones', () => {
    const conBlandas = construirVecindad(m, true)
    const b = m.aristas_blandas[0]
    expect(conBlandas.siguientes.get(b.de)).toContain(b.a)
  })
})

describe('cuellosDeBotella', () => {
  it('devuelve las 5 de mayor intermediación, de mayor a menor', () => {
    const top = cuellosDeBotella(inter)
    expect(top).toHaveLength(5)
    for (let i = 1; i < top.length; i++) expect(inter[top[i - 1]]).toBeGreaterThanOrEqual(inter[top[i]])
  })

  it('ignora valores no finitos o cero', () => {
    expect(cuellosDeBotella({ a: 0, b: NaN, c: 2 })).toEqual(['c'])
  })
})

describe('aristasDeCamino', () => {
  it('une materias consecutivas de la cadena crítica', () => {
    const camino = caminoMasLargo(m)
    const s = aristasDeCamino(camino)
    expect(s.size).toBe(camino.length - 1)
    expect(s.has(`${camino[0]}->${camino[1]}`)).toBe(true)
  })
})

describe('radioNodo', () => {
  const max = Math.max(...Object.values(inter))
  it('queda dentro de los límites en todos los modos', () => {
    for (const materia of m.materias) {
      for (const modo of ['creditos', 'intermediacion', 'uniforme'] as const) {
        const r = radioNodo(materia, modo, inter, max)
        expect(r).toBeGreaterThanOrEqual(RADIO.min)
        expect(r).toBeLessThanOrEqual(RADIO.max)
      }
    }
  })

  it('crece con los créditos y no se rompe sin intermediación', () => {
    const base = m.materias[0]
    expect(radioNodo({ ...base, creditos: 4 }, 'creditos', inter, max)).toBeGreaterThan(radioNodo({ ...base, creditos: 2 }, 'creditos', inter, max))
    expect(radioNodo(base, 'intermediacion', {}, 0)).toBe(RADIO.min)
  })
})

describe('navegar', () => {
  const layout = layoutSemestres(m, orden)
  const ctx: ContextoNavegacion = {
    vecindad,
    centros: layout.centros,
    columnas: layout.columnas,
    semestreDe: new Map(m.materias.map((x) => [x.id, x.semestre])),
    orden,
    visible: () => true,
  }

  it('sin selección empieza por la primera del orden topológico', () => {
    expect(navegar('ArrowRight', null, ctx)).toBe(orden[0])
  })

  it('← va a un prerrequisito y → a un dependiente', () => {
    const e = m.prerrequisitos[0]
    expect(vecindad.previas.get(e.a)).toContain(navegar('ArrowLeft', e.a, ctx))
    expect(vecindad.siguientes.get(e.de)).toContain(navegar('ArrowRight', e.de, ctx))
  })

  it('↑ ↓ se mueven dentro del semestre y se quedan en los bordes', () => {
    const col = layout.columnas.get(1)!
    expect(navegar('ArrowDown', col[0], ctx)).toBe(col[1])
    expect(navegar('ArrowUp', col[0], ctx)).toBe(col[0])
  })

  it('sin prerrequisitos visibles se queda donde está', () => {
    const raiz = orden[0]
    expect(navegar('ArrowLeft', raiz, ctx)).toBe(raiz)
  })

  it('salta materias ocultas', () => {
    const col = layout.columnas.get(1)!
    const oculta = col[1]
    const c2 = { ...ctx, visible: (id: string) => id !== oculta }
    expect(navegar('ArrowDown', col[0], c2)).toBe(col[2])
  })
})

describe('describirNodo', () => {
  it('describe el estado sin NaN ni undefined', () => {
    const materia = m.materias[0]
    const textos = [
      describirNodo(materia, { tipo: 'aprobada', nota: 4.2 }, vecindad),
      describirNodo(materia, { tipo: 'reprobada', nota: 2.5 }, vecindad),
      describirNodo(materia, { tipo: 'bloqueada' }, vecindad),
      describirNodo(
        materia,
        { tipo: 'disponible', prediccion: { materia: materia.id, nota: 3.4, rango: [3, 3.8], probNoAprobar: 0.3, semaforo: 'amarillo', porQue: [], usaModelo: true } },
        vecindad,
      ),
    ]
    expect(textos[0]).toContain('Aprobada con 4.2')
    expect(textos[3]).toContain('Conviene reforzar')
    for (const t of textos) expect(t).not.toMatch(/NaN|undefined/)
  })
})
