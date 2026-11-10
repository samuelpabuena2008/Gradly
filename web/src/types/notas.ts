// Frente 1 (Datos). Formato de data/plantilla_notas.csv.

/** Una fila de la tabla de notas: materia, periodo (AAAA-S), nota (escala 0–5). */
export interface Nota {
  materia: string
  periodo: string
  nota: number
}
