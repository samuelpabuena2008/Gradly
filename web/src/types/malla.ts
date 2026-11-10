// Frente 1 (Datos). Debe coincidir con data/schemas/malla.schema.json.

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
