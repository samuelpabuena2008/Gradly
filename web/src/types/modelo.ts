// Frente 3 (Modelo). Debe coincidir con data/schemas/pesos.schema.json.

export interface ModeloCurso {
  /** Ajuste de la materia sobre su media. */
  b: number
  /** Cuánto pesa el nivel del estudiante en esta materia. */
  beta: number
  /** Error típico de la predicción (desviación de los residuos en validación). */
  sigma: number
  /** Peso de cada materia ancestro en la malla sobre esta. */
  pesos: Record<string, number>
}

/** Modelo exportado por model/ en data/pesos.json. */
export interface Modelo {
  tipo: string
  sigma_global: number
  /** Encoge el nivel del estudiante hacia 0 cuando tiene pocas notas. */
  k_nivel: number
  /** Media de cada materia de la malla. */
  medias: Record<string, number>
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
  /** false si no hay pesos para esta materia y se usó su media más el nivel del estudiante. */
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
