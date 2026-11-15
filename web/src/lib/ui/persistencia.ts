// Persistencia OPCIONAL de las notas en localStorage. Está apagada por defecto: las notas viven solo
// en memoria hasta que el usuario la activa en Ajustes, y siempre se pueden borrar desde ahí.
// Si el almacenamiento está bloqueado o lleno, la app sigue funcionando y las notas no persisten.

import type { Nota } from '../../types'
import { borrarClave, guardarJson, leerJson } from './almacenamiento'
import { PERIODO_RE } from './notas'

export const CLAVE_PERSISTIR = 'gradly:persistir'
export const CLAVE_NOTAS = 'gradly:notas'

export function persistenciaActiva(): boolean {
  return leerJson<unknown>(CLAVE_PERSISTIR, false) === true
}

export function fijarPersistencia(activa: boolean): void {
  if (activa) guardarJson(CLAVE_PERSISTIR, true)
  else {
    borrarClave(CLAVE_PERSISTIR)
    borrarClave(CLAVE_NOTAS)
  }
}

/** Guarda las notas; devuelve `false` si no se pudo (almacenamiento lleno o bloqueado). */
export function guardarNotas(notas: Nota[]): boolean {
  return guardarJson(CLAVE_NOTAS, notas)
}

/** Lee las notas guardadas descartando cualquier entrada con forma inválida. */
export function leerNotasGuardadas(): Nota[] {
  const crudo = leerJson<unknown>(CLAVE_NOTAS, [])
  if (!Array.isArray(crudo)) return []
  return crudo.filter(
    (n): n is Nota =>
      typeof n === 'object' &&
      n !== null &&
      typeof (n as Nota).materia === 'string' &&
      typeof (n as Nota).periodo === 'string' &&
      PERIODO_RE.test((n as Nota).periodo) &&
      typeof (n as Nota).nota === 'number' &&
      Number.isFinite((n as Nota).nota) &&
      (n as Nota).nota >= 0 &&
      (n as Nota).nota <= 5,
  )
}

/** Borra las notas guardadas (no cambia si la persistencia está activa). */
export function borrarNotasGuardadas(): void {
  borrarClave(CLAVE_NOTAS)
}
