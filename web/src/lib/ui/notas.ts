// Validación y fusión de notas del usuario (importación, formulario manual y revisión previa).

import type { Malla, Nota } from '../../types'
import { fmtNotaCorta } from './formato'

export type Validacion<T> = { ok: true; valor: T } | { ok: false; error: string }

/** Periodo académico: año, guion y semestre 1, 2 o 3 (intersemestral). */
export const PERIODO_RE = /^\d{4}-[123]$/

export function validarPeriodo(texto: string): Validacion<string> {
  const p = texto.trim()
  if (p === '') return { ok: false, error: 'Escribe el periodo, por ejemplo 2025-1.' }
  if (!PERIODO_RE.test(p)) return { ok: false, error: 'El periodo debe verse como 2025-1 (año, guion y semestre 1, 2 o 3).' }
  return { ok: true, valor: p }
}

/** Acepta coma o punto decimal y la escala 0–5. `3.75` se conserva tal cual. */
export function validarNotaTexto(texto: string): Validacion<number> {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return { ok: false, error: 'Escribe la nota, por ejemplo 3.5.' }
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(limpio)) return { ok: false, error: 'La nota debe ser un número, por ejemplo 3.5 o 3,5.' }
  const n = Number(limpio)
  if (!Number.isFinite(n) || n < 0 || n > 5) return { ok: false, error: 'La nota debe estar entre 0.0 y 5.0.' }
  return { ok: true, valor: n }
}

/** Periodo que corresponde a hoy: enero–junio es el primer semestre, el resto el segundo. */
export function periodoActual(fecha: Date = new Date()): string {
  return `${fecha.getFullYear()}-${fecha.getMonth() < 6 ? 1 : 2}`
}

export const claveNota = (n: Pick<Nota, 'materia' | 'periodo'>): string => `${n.materia}|${n.periodo}`

/**
 * Combina notas ya cargadas con notas nuevas. Un mismo intento (materia + periodo) aparece una sola
 * vez y manda el nuevo; los intentos de otros periodos se conservan (el más reciente cuenta).
 */
export function fusionarNotas(actuales: Nota[], nuevas: Nota[]): Nota[] {
  const porClave = new Map<string, Nota>()
  for (const n of [...actuales, ...nuevas]) porClave.set(claveNota(n), n)
  // Mantiene el orden de llegada de la primera aparición de cada intento.
  return [...porClave.values()]
}

export type ResultadoAgregar = 'agregada' | 'actualizada' | 'duplicada'

/** Agrega una nota evitando duplicados exactos. Con la misma materia y periodo y otra nota, actualiza. */
export function agregarNota(notas: Nota[], nueva: Nota): { notas: Nota[]; resultado: ResultadoAgregar } {
  const existente = notas.find((n) => claveNota(n) === claveNota(nueva))
  if (!existente) return { notas: [...notas, nueva], resultado: 'agregada' }
  if (existente.nota === nueva.nota) return { notas, resultado: 'duplicada' }
  return { notas: notas.map((n) => (n === existente ? nueva : n)), resultado: 'actualizada' }
}

// ---------------------------------------------------------------------------
// Tabla de revisión antes de confirmar la importación
// ---------------------------------------------------------------------------

/** Fila editable de la revisión: todo como texto, tal como lo escribe el usuario. */
export interface FilaRevision {
  id: number
  materia: string
  periodo: string
  nota: string
}

export interface ProblemaFila {
  tipo: 'error' | 'aviso'
  texto: string
}

export interface FilaValidada {
  fila: FilaRevision
  /** La nota lista para importar; `undefined` si la fila tiene errores. */
  nota?: Nota
  problemas: ProblemaFila[]
  /** Repite exactamente una fila anterior: no se cuenta dos veces. */
  repetida: boolean
}

export function aFilasRevision(notas: Nota[]): FilaRevision[] {
  return notas.map((n, i) => ({ id: i + 1, materia: n.materia, periodo: n.periodo, nota: fmtNotaCorta(n.nota) }))
}

/** Valida cada fila contra la malla y contra las demás filas. Nunca lanza: los problemas se reportan por fila. */
export function validarFilas(filas: FilaRevision[], malla: Malla): FilaValidada[] {
  const ids = new Set(malla.materias.map((m) => m.id))
  const vistas = new Map<string, FilaRevision>()
  const claveCompleta = (n: Nota) => `${claveNota(n)}|${n.nota}`
  const completas = new Set<string>()

  return filas.map((f) => {
    const problemas: ProblemaFila[] = []
    const materia = f.materia.trim().toUpperCase()
    const periodo = validarPeriodo(f.periodo)
    const nota = validarNotaTexto(f.nota)

    if (materia === '') problemas.push({ tipo: 'error', texto: 'Falta el código de la materia.' })
    else if (!ids.has(materia)) problemas.push({ tipo: 'error', texto: `La materia ${materia} no está en la malla: se omite esta fila.` })
    if (!periodo.ok) problemas.push({ tipo: 'error', texto: periodo.error })
    if (!nota.ok) problemas.push({ tipo: 'error', texto: nota.error })

    if (problemas.some((p) => p.tipo === 'error') || !periodo.ok || !nota.ok) {
      return { fila: f, problemas, repetida: false }
    }

    const valida: Nota = { materia, periodo: periodo.valor, nota: nota.valor }
    const completa = claveCompleta(valida)
    let repetida = false
    if (completas.has(completa)) {
      repetida = true
      problemas.push({ tipo: 'aviso', texto: 'Esta fila repite otra igual: se cuenta una sola vez.' })
    } else if (vistas.has(claveNota(valida))) {
      problemas.push({ tipo: 'aviso', texto: 'Hay otra fila para esta materia y periodo con otra nota: manda esta, que es la última.' })
    }
    completas.add(completa)
    vistas.set(claveNota(valida), f)
    return { fila: f, nota: valida, problemas, repetida }
  })
}

/** Notas que se importarían: filas válidas (sin repetidas), fusionadas por materia y periodo. */
export function notasDeRevision(validadas: FilaValidada[]): Nota[] {
  return fusionarNotas(
    [],
    validadas.filter((v) => v.nota && !v.repetida).map((v) => v.nota!),
  )
}
