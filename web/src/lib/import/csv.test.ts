import { describe, expect, it } from 'vitest'
import { parsearNotasCsv } from './csv'

describe('parsearNotasCsv', () => {
  it('lee el formato de la plantilla', () => {
    const r = parsearNotasCsv('materia,periodo,nota\nCAL1,2025-1,3.8\nCAL2,2025-2,2.9\n')
    expect(r.errores).toEqual([])
    expect(r.notas).toEqual([
      { materia: 'CAL1', periodo: '2025-1', nota: 3.8 },
      { materia: 'CAL2', periodo: '2025-2', nota: 2.9 },
    ])
  })

  it('acepta punto y coma, coma decimal, BOM y columnas en otro orden', () => {
    const r = parsearNotasCsv('﻿nota;materia;periodo\r\n3,5;cal1;2025-1\r\n')
    expect(r.notas).toEqual([{ materia: 'CAL1', periodo: '2025-1', nota: 3.5 }])
  })

  it('reporta notas fuera de 0–5 sin perder las demás filas', () => {
    const r = parsearNotasCsv('materia,periodo,nota\nCAL1,2025-1,6\nCAL2,2025-2,abc\nLOG,2025-1,4')
    expect(r.notas).toHaveLength(1)
    expect(r.errores).toEqual([
      'Fila 2: la nota debe estar entre 0 y 5',
      'Fila 3: la nota debe estar entre 0 y 5',
    ])
  })

  it('avisa si falta una columna', () => {
    const r = parsearNotasCsv('materia,nota\nCAL1,4')
    expect(r.errores).toEqual(['Faltan columnas: periodo'])
  })
})
