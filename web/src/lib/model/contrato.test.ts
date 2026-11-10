// Contrato con model/: la web debe resolver los casos de data/fixtures igual que Python
// (model/tests/test_contrato_prediccion.py corre los mismos casos).

import { describe, expect, it } from 'vitest'
import type { Malla, Modelo, Nota } from '../../types'
import caso from '../../../../data/fixtures/prediccion_caso_conocido.json'
import { predecirMateria, UMBRALES, ultimasNotas } from './predict'

const malla = caso.malla as Malla
const modelo = caso.modelo as Modelo
const decimales = -Math.log10(caso.tolerancia)

describe('contrato de predicción (mismo caso que Python)', () => {
  it('usa los mismos umbrales del semáforo', () => {
    expect(UMBRALES).toEqual(caso.umbrales)
  })

  for (const c of caso.casos) {
    it(c.nombre, () => {
      const p = predecirMateria(c.materia, malla, modelo, ultimasNotas(c.notas as Nota[]))!
      const e = c.esperado
      expect(p.nota).toBeCloseTo(e.nota, decimales)
      expect(p.rango[0]).toBeCloseTo(e.rango[0], decimales)
      expect(p.rango[1]).toBeCloseTo(e.rango[1], decimales)
      expect(p.probNoAprobar).toBeCloseTo(e.probNoAprobar, decimales)
      expect(p.semaforo).toBe(e.semaforo)
      expect(p.usaModelo).toBe(e.usaModelo)
      expect(p.porQue.map((x) => x.materia)).toEqual(e.porQue.map((x) => x.materia))
      p.porQue.forEach((x, i) => expect(x.aporte).toBeCloseTo(e.porQue[i].aporte, decimales))
    })
  }
})
