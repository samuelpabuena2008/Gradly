// Comparación lado a lado de los dos modelos para una materia. Llama a cada predictor por separado
// (predecirMateriaRed cae en la regresión si la materia no tiene red; aquí eso no cuenta como
// «predicción de la red», para no mostrar una comparación de un modelo consigo mismo).

import type { Malla, Modelo, Prediccion } from '../../types'
import { predecirMateria } from '../model/predict'
import { predecirMateriaRed } from '../model/red'
import { tieneRed } from './modelos'

export interface Comparacion {
  regresion: Prediccion | null
  /** `null` si el modelo no trae red o no tiene red para esta materia. */
  red: Prediccion | null
  /** Red menos regresión (en puntos de nota); `null` si falta alguna. */
  diferencia: number | null
  /** ¿Los dos modelos dan semáforos distintos? */
  semaforosDistintos: boolean
}

export function compararModelos(
  materia: string,
  malla: Malla,
  modelo: Modelo,
  notas: Map<string, number>,
): Comparacion {
  const regresion = predecirMateria(materia, malla, modelo, notas)
  const hayRed = tieneRed(modelo) && Boolean(modelo.red?.cursos[materia])
  const red = hayRed ? predecirMateriaRed(materia, malla, modelo, notas) : null
  const diferencia = regresion && red ? red.nota - regresion.nota : null
  return {
    regresion,
    red,
    diferencia: diferencia !== null && Number.isFinite(diferencia) ? diferencia : null,
    semaforosDistintos: Boolean(regresion && red && regresion.semaforo !== red.semaforo),
  }
}
