// @vitest-environment jsdom
// Store de datos del usuario: notasReales vs ajustes, acciones de edición y persistencia OPCIONAL.

import { beforeEach, describe, expect, it } from 'vitest'
import type { Nota } from '../types'
import { CLAVE_NOTAS, CLAVE_PERSISTIR, borrarNotasGuardadas, guardarNotas, leerNotasGuardadas, persistenciaActiva } from '../lib/ui/persistencia'
import { useApp } from './app'

const reales: Nota[] = [
  { materia: 'MAT1031', periodo: '2025-1', nota: 3.0 },
  { materia: 'MAT1101', periodo: '2025-1', nota: 3.2 },
]

beforeEach(() => {
  window.localStorage.clear()
  useApp.setState(useApp.getInitialState(), true)
})

describe('notasReales y ajustes', () => {
  it('los ajustes nunca modifican las notas reales', () => {
    useApp.getState().reemplazarNotas(reales)
    const antes = JSON.stringify(useApp.getState().notasReales)
    useApp.getState().fijarAjuste('MAT1031', 4.8)
    useApp.getState().fijarAjuste('IST0010', 3.9)
    expect(JSON.stringify(useApp.getState().notasReales)).toBe(antes)
    useApp.getState().restaurarAjustes()
    expect(useApp.getState().ajustes).toEqual({})
    expect(JSON.stringify(useApp.getState().notasReales)).toBe(antes)
  })

  it('cambiar las notas reales descarta el escenario (ya no corresponde)', () => {
    useApp.getState().reemplazarNotas(reales)
    useApp.getState().fijarAjuste('MAT1031', 4.8)
    useApp.getState().combinarNotas([{ materia: 'IST0010', periodo: '2025-1', nota: 4 }])
    expect(useApp.getState().ajustes).toEqual({})
  })

  it('combinarNotas: el mismo intento lo reemplaza el nuevo y se conservan los demás', () => {
    useApp.getState().reemplazarNotas(reales)
    useApp.getState().combinarNotas([
      { materia: 'MAT1031', periodo: '2025-1', nota: 4.1 },
      { materia: 'IST0010', periodo: '2025-1', nota: 4.5 },
    ])
    const n = useApp.getState().notasReales
    expect(n).toHaveLength(3)
    expect(n.find((x) => x.materia === 'MAT1031')?.nota).toBe(4.1)
  })

  it('agregar, editar y quitar notas son acciones explícitas', () => {
    expect(useApp.getState().agregarNota({ materia: 'MAT1031', periodo: '2025-1', nota: 3 })).toBe('agregada')
    expect(useApp.getState().agregarNota({ materia: 'MAT1031', periodo: '2025-1', nota: 3 })).toBe('duplicada')
    expect(useApp.getState().agregarNota({ materia: 'MAT1031', periodo: '2025-1', nota: 3.6 })).toBe('actualizada')
    useApp.getState().editarNota('MAT1031', '2025-1', 4.2)
    expect(useApp.getState().notasReales).toEqual([{ materia: 'MAT1031', periodo: '2025-1', nota: 4.2 }])
    useApp.getState().quitarNota('MAT1031', '2025-1')
    expect(useApp.getState().notasReales).toEqual([])
  })

  it('un duplicado exacto no cambia la referencia de las notas', () => {
    useApp.getState().agregarNota({ materia: 'MAT1031', periodo: '2025-1', nota: 3 })
    const antes = useApp.getState().notasReales
    useApp.getState().agregarNota({ materia: 'MAT1031', periodo: '2025-1', nota: 3 })
    expect(useApp.getState().notasReales).toBe(antes)
  })
})

describe('persistencia opt-in de las notas', () => {
  it('apagada por defecto: las notas nunca llegan a localStorage', () => {
    expect(useApp.getState().persistirNotas).toBe(false)
    useApp.getState().reemplazarNotas(reales)
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toBeNull()
    expect(persistenciaActiva()).toBe(false)
  })

  it('al activarla guarda las notas y las sigue guardando; al desactivarla las borra', () => {
    useApp.getState().reemplazarNotas(reales)
    useApp.getState().fijarPersistirNotas(true)
    expect(persistenciaActiva()).toBe(true)
    expect(leerNotasGuardadas()).toEqual(reales)
    useApp.getState().agregarNota({ materia: 'IST0010', periodo: '2025-1', nota: 4.5 })
    expect(leerNotasGuardadas()).toHaveLength(3)
    useApp.getState().fijarPersistirNotas(false)
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toBeNull()
    expect(window.localStorage.getItem(CLAVE_PERSISTIR)).toBeNull()
  })

  it('borrar todas las notas con la persistencia activa borra también lo guardado', () => {
    useApp.getState().reemplazarNotas(reales)
    useApp.getState().fijarPersistirNotas(true)
    useApp.getState().borrarNotas()
    expect(window.localStorage.getItem(CLAVE_NOTAS)).toBeNull()
  })

  it('los ajustes hipotéticos nunca se guardan', () => {
    useApp.getState().reemplazarNotas(reales)
    useApp.getState().fijarPersistirNotas(true)
    useApp.getState().fijarAjuste('MAT1031', 5)
    expect(leerNotasGuardadas()).toEqual(reales)
  })

  it('al leer descarta entradas corruptas y tolera datos que no son una lista', () => {
    window.localStorage.setItem(
      CLAVE_NOTAS,
      JSON.stringify([...reales, { materia: 'X', periodo: 'mal', nota: 3 }, { materia: 'Y', periodo: '2025-1', nota: 9 }, null, 'basura']),
    )
    expect(leerNotasGuardadas()).toEqual(reales)
    window.localStorage.setItem(CLAVE_NOTAS, '{no es json')
    expect(leerNotasGuardadas()).toEqual([])
    window.localStorage.setItem(CLAVE_NOTAS, JSON.stringify({ a: 1 }))
    expect(leerNotasGuardadas()).toEqual([])
  })

  it('si localStorage está bloqueado o lleno, la app sigue funcionando', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('lleno', 'QuotaExceededError')
    }
    try {
      expect(() => useApp.getState().fijarPersistirNotas(true)).not.toThrow()
      expect(() => useApp.getState().reemplazarNotas(reales)).not.toThrow()
      expect(guardarNotas(reales)).toBe(false)
      expect(useApp.getState().notasReales).toEqual(reales)
    } finally {
      Storage.prototype.setItem = original
    }
    borrarNotasGuardadas()
  })
})
