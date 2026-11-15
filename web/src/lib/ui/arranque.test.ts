import { describe, expect, it } from 'vitest'
import mallaSistemas from '../../../../data/malla_sistemas.json'
import pesos from '../../../../data/pesos.json'
import { cargarDatos, ErrorArranque, ETAPAS } from './arranque'

const rapido = { minimoPorEtapaMs: 0 }

describe('arranque', () => {
  it('carga la malla oficial, la valida y precalcula el análisis de grafos', async () => {
    const etapas: number[] = []
    const d = await cargarDatos((i) => etapas.push(i), {
      ...rapido,
      cargarMalla: async () => mallaSistemas,
      cargarModelo: async () => pesos,
    })
    expect(etapas).toEqual(ETAPAS.map((_, i) => i))
    expect(d.malla.materias).toHaveLength(50)
    expect(d.orden).toHaveLength(50)
    expect(d.camino).toHaveLength(9)
    expect(d.materiaPorId.get('MAT1101')?.nombre).toMatch(/Cálculo I/)
    expect(Object.keys(d.intermediacion)).toHaveLength(50)
    expect(['regresion', 'red']).toContain(d.recomendado)
  })

  it('una malla con ciclo produce un error de arranque claro', async () => {
    const conCiclo = {
      ...mallaSistemas,
      materias: [
        { id: 'AAA1', nombre: 'A', semestre: 1, creditos: 3 },
        { id: 'BBB2', nombre: 'B', semestre: 2, creditos: 3 },
      ],
      prerrequisitos: [
        { de: 'AAA1', a: 'BBB2' },
        { de: 'BBB2', a: 'AAA1' },
      ],
      aristas_blandas: [],
    }
    const error = await cargarDatos(undefined, {
      ...rapido,
      cargarMalla: async () => conCiclo,
      cargarModelo: async () => pesos,
    }).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorArranque)
    expect(error.titulo).toMatch(/prerrequisitos/)
    expect(error.detalle).toMatch(/ciclo/)
  })

  it('JSON inválido o ausente no deja la app en blanco', async () => {
    const e1 = await cargarDatos(undefined, {
      ...rapido,
      cargarMalla: async () => ({ materias: [] }),
      cargarModelo: async () => pesos,
    }).catch((e) => e)
    expect(e1).toBeInstanceOf(ErrorArranque)

    const e2 = await cargarDatos(undefined, {
      ...rapido,
      cargarMalla: async () => mallaSistemas,
      cargarModelo: async () => ({ medias: 3 }),
    }).catch((e) => e)
    expect(e2).toBeInstanceOf(ErrorArranque)
    expect(e2.detalle).toMatch(/medias/)

    const e3 = await cargarDatos(undefined, {
      ...rapido,
      cargarMalla: async () => {
        throw new Error('sin red')
      },
    }).catch((e) => e)
    expect(e3).toBeInstanceOf(ErrorArranque)
    expect(e3.detalle).toMatch(/sin red/)
  })

  it('cada etapa respeta el tiempo mínimo para evitar parpadeo', async () => {
    const t0 = performance.now()
    await cargarDatos(undefined, {
      minimoPorEtapaMs: 40,
      cargarMalla: async () => mallaSistemas,
      cargarModelo: async () => pesos,
    })
    expect(performance.now() - t0).toBeGreaterThanOrEqual(5 * 40 - 15)
  })
})
