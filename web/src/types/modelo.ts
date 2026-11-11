// Frente 3 (Modelo). Debe coincidir con data/schemas/pesos.schema.json.

export interface ModeloCurso {
  /** Dificultad de la materia respecto al promedio del estudiante. */
  b: number
  /** Error típico de la predicción (desviación de los residuos en validación). */
  sigma: number
  /** Peso de cada materia previa sobre esta. */
  pesos: Record<string, number>
}

/** Modelo exportado por model/ en data/pesos.json. */
export interface Modelo {
  tipo: string
  sigma_global: number
  cursos: Record<string, ModeloCurso>
  /** Opcional: red neuronal por materia (alternativa a la regresión). */
  red?: { activacion: string; cursos: Record<string, RedCurso> }
}

export type Semaforo = 'verde' | 'amarillo' | 'rojo'

export interface Contribucion {
  materia: string
  /** Cuánto sube (+) o baja (−) la predicción por esta materia previa. */
  aporte: number
}

export interface Prediccion {
  materia: string
  nota: number
  rango: [number, number]
  probNoAprobar: number
  semaforo: Semaforo
  porQue: Contribucion[]
  /** false si no hay pesos para esta materia y se usó el promedio (baseline). */
  usaModelo: boolean
}

/** Red neuronal de una materia: ŷ = ȳ + tanh(x·W1 + b1)·W2 + b2, con x = nota previa − ȳ. */
export interface RedCurso {
  /** Materias previas, en el orden de las filas de W1. */
  previas: string[]
  /** previas × neuronas ocultas. */
  W1: number[][]
  b1: number[]
  W2: number[]
  b2: number
  sigma: number
}
