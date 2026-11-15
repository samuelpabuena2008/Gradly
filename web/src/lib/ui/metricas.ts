// Lectura defensiva de las métricas que model/ exporta en data/pesos.json (`metricas`, `validacion`).
// La interfaz nunca las inventa: si un dato falta, queda en `undefined` y la vista lo omite.

import type { Modelo } from '../../types'

export interface MetricasPorModelo {
  mae?: number
  precisionRiesgo?: number
  recallRiesgo?: number
}

export interface Intervalo {
  diferencia: number
  ic95: [number, number]
}

export interface FilaSemaforo {
  n: number
  /** Fracción que de verdad reprobó entre quienes recibieron este color. */
  reprobaron: number
}

export interface Calibracion {
  coberturaRango?: number
  auc?: number
  semaforo: Partial<Record<'verde' | 'amarillo' | 'rojo', FilaSemaforo>>
}

export interface MetricasModelo {
  baseline: MetricasPorModelo
  regresion: MetricasPorModelo
  red: MetricasPorModelo
  validacion: {
    tipo?: string
    notasEvaluadas?: number
    regresionVsBaseline?: Intervalo
    redVsRegresion?: Intervalo
    calibracionRegresion?: Calibracion
    calibracionRed?: Calibracion
    recomendado?: string
  }
  nEstudiantes?: number
  fuente?: string
  versionMalla?: string
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const texto = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)

function porModelo(x: unknown): MetricasPorModelo {
  if (!esObjeto(x)) return {}
  return { mae: num(x.mae), precisionRiesgo: num(x.precision_riesgo), recallRiesgo: num(x.recall_riesgo) }
}

function intervalo(x: unknown): Intervalo | undefined {
  if (!esObjeto(x)) return undefined
  const diferencia = num(x.diferencia)
  const ic = Array.isArray(x.ic95) ? x.ic95.map(num) : []
  if (diferencia === undefined || ic.length !== 2 || ic[0] === undefined || ic[1] === undefined) return undefined
  return { diferencia, ic95: [ic[0], ic[1]] }
}

function calibracion(x: unknown): Calibracion | undefined {
  if (!esObjeto(x)) return undefined
  const semaforo: Calibracion['semaforo'] = {}
  if (esObjeto(x.semaforo)) {
    for (const color of ['verde', 'amarillo', 'rojo'] as const) {
      const fila = x.semaforo[color]
      if (esObjeto(fila)) {
        const n = num(fila.n)
        const reprobaron = num(fila.reprobaron)
        if (n !== undefined && reprobaron !== undefined) semaforo[color] = { n, reprobaron }
      }
    }
  }
  return { coberturaRango: num(x.cobertura_rango), auc: num(x.auc_riesgo), semaforo }
}

/** Devuelve las métricas del modelo, o `null` si `pesos.json` no trae `metricas` ni `validacion`. */
export function leerMetricas(modelo: Modelo): MetricasModelo | null {
  const crudo = modelo as unknown as Record<string, unknown>
  if (!esObjeto(crudo.metricas) && !esObjeto(crudo.validacion)) return null
  const m = esObjeto(crudo.metricas) ? crudo.metricas : {}
  const v = esObjeto(crudo.validacion) ? crudo.validacion : {}
  const dif = esObjeto(v.diferencia_mae) ? v.diferencia_mae : {}
  const cal = esObjeto(v.calibracion) ? v.calibracion : {}
  return {
    baseline: porModelo(m.baseline),
    regresion: porModelo(m.regresion),
    red: porModelo(m.red),
    validacion: {
      tipo: texto(v.tipo),
      notasEvaluadas: num(v.notas_evaluadas),
      regresionVsBaseline: intervalo(dif.regresion_vs_baseline),
      redVsRegresion: intervalo(dif.red_vs_regresion),
      calibracionRegresion: calibracion(cal.regresion),
      calibracionRed: calibracion(cal.red),
      recomendado: texto(v.recomendado),
    },
    nEstudiantes: num(crudo.n_estudiantes),
    fuente: texto(crudo.fuente),
    versionMalla: texto(crudo.version_malla),
  }
}
