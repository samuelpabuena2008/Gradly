// Tipos del contrato compartido (data/). Si cambian aquí, cambian también en model/ y api/.

export interface Materia {
  id: string
  nombre: string
  semestre: number
  creditos: number
}

/** Arista dirigida: `de` es prerrequisito de `a`. */
export interface Arista {
  de: string
  a: string
}

export interface Malla {
  programa: string
  version: string
  nota_aprobacion: number
  materias: Materia[]
  prerrequisitos: Arista[]
  /** Relaciones entre materias del mismo área que no son prerrequisito oficial. */
  aristas_blandas: Arista[]
}

/** Una fila de la tabla de notas: materia, periodo, nota (escala 0–5). */
export interface Nota {
  materia: string
  periodo: string
  nota: number
}

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
