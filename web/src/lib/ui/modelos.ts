// Utilidades de interfaz sobre los modelos de predicción.

import type { Modelo } from '../../types'
import type { TipoModelo } from '../model/predict'

export const NOMBRE_MODELO: Record<TipoModelo, string> = {
  regresion: 'Regresión',
  red: 'Red neuronal (MLP)',
}

/** ¿`pesos.json` trae red neuronal? Si no, la opción Red se deshabilita. */
export function tieneRed(modelo: Modelo): boolean {
  return Boolean(modelo.red && modelo.red.cursos && Object.keys(modelo.red.cursos).length > 0)
}

/** El otro modelo (para alternar con un clic). */
export const otroModelo = (tipo: TipoModelo): TipoModelo => (tipo === 'regresion' ? 'red' : 'regresion')
