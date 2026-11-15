// Pruebas de la lógica de «datos del usuario» (Fase 5): validación, fusión, lectura de archivos,
// proyección. Cubre las filas relevantes de la tabla de casos borde de §8.

import { describe, expect, it } from 'vitest'
import malla from '../../../../data/malla_sistemas.json'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import type { Malla, Nota, Prediccion } from '../../types'
import { MAX_BYTES, describirErrorPdf, validarArchivo } from './archivo'
import { ErrorLectura, leerArchivo, leerTexto } from './lectura'
import {
  agregarNota,
  aFilasRevision,
  fusionarNotas,
  notasDeRevision,
  periodoActual,
  validarFilas,
  validarNotaTexto,
  validarPeriodo,
  type FilaRevision,
} from './notas'
import { cambiosDisponibilidad, deltasPredicciones, resumirEscenario } from './proyeccion'

const m = malla as Malla

describe('validarNotaTexto', () => {
  it.each([
    ['0.0', 0],
    ['0', 0],
    ['5.0', 5],
    ['5', 5],
    ['4,5', 4.5],
    ['3.75', 3.75],
    [' 3.5 ', 3.5],
  ])('acepta y normaliza «%s»', (texto, esperado) => {
    expect(validarNotaTexto(texto)).toEqual({ ok: true, valor: esperado })
  })
  it.each([['-1'], ['5.1'], ['abc'], [''], ['   '], ['3..5'], ['NaN'], ['1e1'], ['5,01']])('rechaza «%s» con un mensaje claro', (texto) => {
    const r = validarNotaTexto(texto)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.length).toBeGreaterThan(10)
  })
})

describe('validarPeriodo', () => {
  it.each(['2025-1', '2024-2', '2026-3'])('acepta %s', (p) => expect(validarPeriodo(p).ok).toBe(true))
  it.each(['', '2025', '2025-4', '25-1', '2025-0', '2025/1', 'abcd-1', '2025-12'])('rechaza «%s»', (p) => expect(validarPeriodo(p).ok).toBe(false))
  it('periodoActual: primer semestre de enero a junio, segundo el resto', () => {
    expect(periodoActual(new Date(2026, 0, 10))).toBe('2026-1')
    expect(periodoActual(new Date(2026, 5, 30))).toBe('2026-1')
    expect(periodoActual(new Date(2026, 10, 15))).toBe('2026-2')
  })
})

describe('fusionarNotas y agregarNota', () => {
  const a: Nota[] = [
    { materia: 'MAT1031', periodo: '2024-1', nota: 2.0 },
    { materia: 'MAT1101', periodo: '2024-1', nota: 3.0 },
  ]
  it('combinar: el intento nuevo de la misma materia y periodo reemplaza al viejo, sin duplicar', () => {
    const r = fusionarNotas(a, [
      { materia: 'MAT1031', periodo: '2024-1', nota: 3.4 },
      { materia: 'MAT1031', periodo: '2024-2', nota: 4.0 },
    ])
    expect(r).toHaveLength(3)
    expect(r.find((n) => n.materia === 'MAT1031' && n.periodo === '2024-1')?.nota).toBe(3.4)
  })
  it('combinar conserva los intentos de otros periodos (el más reciente cuenta en el modelo)', () => {
    const r = fusionarNotas(a, [{ materia: 'MAT1031', periodo: '2025-1', nota: 4.1 }])
    expect(r.filter((n) => n.materia === 'MAT1031')).toHaveLength(2)
  })
  it('no muta las entradas', () => {
    const copia = JSON.parse(JSON.stringify(a))
    fusionarNotas(a, [{ materia: 'MAT1031', periodo: '2024-1', nota: 5 }])
    expect(a).toEqual(copia)
  })
  it('agregarNota: nueva, duplicado exacto y actualización', () => {
    expect(agregarNota(a, { materia: 'IST0010', periodo: '2024-1', nota: 4 }).resultado).toBe('agregada')
    const dup = agregarNota(a, { materia: 'MAT1031', periodo: '2024-1', nota: 2.0 })
    expect(dup.resultado).toBe('duplicada')
    expect(dup.notas).toBe(a)
    const act = agregarNota(a, { materia: 'MAT1031', periodo: '2024-1', nota: 3.0 })
    expect(act.resultado).toBe('actualizada')
    expect(act.notas).toHaveLength(2)
  })
})

describe('revisión de filas', () => {
  const f = (materia: string, periodo: string, nota: string, id = 1): FilaRevision => ({ id, materia, periodo, nota })

  it('materia desconocida, periodo inválido y nota fuera de rango dan error por fila sin lanzar', () => {
    const v = validarFilas([f('XXX9999', '2025-1', '3'), f('MAT1031', '2025-9', '3', 2), f('MAT1031', '2025-1', '7', 3), f('', '2025-1', '3', 4)], m)
    expect(v.map((x) => x.problemas.some((p) => p.tipo === 'error'))).toEqual([true, true, true, true])
    expect(v.every((x) => x.nota === undefined)).toBe(true)
    expect(notasDeRevision(v)).toEqual([])
  })
  it('normaliza el código a mayúsculas y la nota con coma', () => {
    const v = validarFilas([f(' mat1031 ', '2025-1', '4,5')], m)
    expect(v[0].nota).toEqual({ materia: 'MAT1031', periodo: '2025-1', nota: 4.5 })
  })
  it('una fila repetida exacta avisa y se cuenta una sola vez', () => {
    const v = validarFilas([f('MAT1031', '2025-1', '3', 1), f('MAT1031', '2025-1', '3.0', 2)], m)
    expect(v[1].repetida).toBe(true)
    expect(notasDeRevision(v)).toHaveLength(1)
  })
  it('misma materia y periodo con otra nota: avisa y manda la última', () => {
    const v = validarFilas([f('MAT1031', '2025-1', '2', 1), f('MAT1031', '2025-1', '3.5', 2)], m)
    expect(v[1].problemas[0].tipo).toBe('aviso')
    expect(notasDeRevision(v)).toEqual([{ materia: 'MAT1031', periodo: '2025-1', nota: 3.5 }])
  })
  it('la plantilla de ejemplo se revisa sin errores', async () => {
    const { parsearNotasCsv } = await import('../import/csv')
    const v = validarFilas(aFilasRevision(parsearNotasCsv(plantilla).notas), m)
    expect(v.every((x) => x.problemas.length === 0)).toBe(true)
  })
})

describe('validarArchivo', () => {
  it('acepta PDF y CSV, rechaza otros formatos con un mensaje que dice qué hacer', () => {
    expect(validarArchivo({ name: 'certificado.PDF', size: 1000 })).toEqual({ ok: true, valor: 'pdf' })
    expect(validarArchivo({ name: 'notas.csv', size: 1000, type: 'text/csv' })).toEqual({ ok: true, valor: 'texto' })
    const otro = validarArchivo({ name: 'tarea.docx', size: 1000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    expect(otro.ok).toBe(false)
    if (!otro.ok) expect(otro.error).toMatch(/PDF.*CSV/)
  })
  it('rechaza archivos vacíos y de más de 10 MB', () => {
    expect(validarArchivo({ name: 'a.csv', size: 0 }).ok).toBe(false)
    const grande = validarArchivo({ name: 'a.pdf', size: MAX_BYTES + 1 })
    expect(grande.ok).toBe(false)
    if (!grande.ok) expect(grande.error).toMatch(/10\.0 MB/)
    expect(validarArchivo({ name: 'a.pdf', size: MAX_BYTES }).ok).toBe(true)
  })
  it('describirErrorPdf traduce los errores técnicos', () => {
    expect(describirErrorPdf(['El PDF no parece un certificado de notas de la Universidad del Norte']).titulo).toMatch(/no parece un certificado/)
    expect(describirErrorPdf(['No se pudo leer el PDF: El archivo no es un PDF']).titulo).toMatch(/no es un PDF válido/)
    expect(describirErrorPdf(['algo raro']).titulo).toMatch(/No pudimos leer este PDF/)
  })
})

describe('leerTexto y leerArchivo', () => {
  const archivo = (contenido: BlobPart, nombre: string, type = '') => new File([contenido], nombre, { type })

  it('CSV con BOM y saltos de línea CRLF', async () => {
    const r = await leerTexto('﻿materia,periodo,nota\r\nMAT1031,2025-1,3.0\r\nMAT1101,2025-1,3.2\r\n', m, 'csv')
    expect(r.notas).toHaveLength(2)
    expect(r.errores).toEqual([])
  })
  it('CSV con separador «;» y coma decimal', async () => {
    const r = await leerTexto('materia;periodo;nota\nMAT1031;2025-1;3,5\n', m, 'csv')
    expect(r.notas).toEqual([{ materia: 'MAT1031', periodo: '2025-1', nota: 3.5 }])
  })
  it('CSV con la cabecera mala explica qué columnas faltan', async () => {
    const r = await leerTexto('a,b,c\n1,2,3\n', m, 'csv')
    expect(r.notas).toEqual([])
    expect(r.errores[0]).toMatch(/Faltan columnas/)
  })
  it('CSV vacío o solo espacios: no lanza una excepción rara', async () => {
    await expect(leerTexto('   \n', m)).rejects.toBeInstanceOf(ErrorLectura)
    const r = await leerTexto('materia,periodo,nota\n', m, 'csv')
    expect(r.notas).toEqual([])
  })
  it('un PDF corrupto (no es un PDF) da un mensaje claro y accionable', async () => {
    await expect(leerArchivo(archivo('esto no es un pdf', 'certificado.pdf', 'application/pdf'), m)).rejects.toMatchObject({
      titulo: expect.stringMatching(/no es un PDF válido/),
    })
  })
  it('un PDF sin texto de certificado (o escaneado) dice que no parece un certificado', async () => {
    await expect(leerArchivo(archivo('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF', 'foto.pdf', 'application/pdf'), m)).rejects.toMatchObject({
      titulo: expect.stringMatching(/no parece un certificado/),
    })
  })
  it('un archivo que no es CSV ni PDF se rechaza sin leerlo', async () => {
    await expect(leerArchivo(archivo('x', 'foto.png', 'image/png'), m)).rejects.toMatchObject({ titulo: 'No podemos leer este archivo' })
  })
  it('un archivo de más de 10 MB se rechaza con el tamaño en el mensaje', async () => {
    const grande = { name: 'enorme.pdf', size: MAX_BYTES + 5, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File
    await expect(leerArchivo(grande, m)).rejects.toMatchObject({ detalle: expect.stringMatching(/10\.0 MB/) })
  })
  it('un .csv con contenido binario se detecta', async () => {
    await expect(leerArchivo(archivo('ab\u0000cd', 'raro.csv', 'text/csv'), m)).rejects.toMatchObject({ titulo: expect.stringMatching(/no es una tabla/) })
  })
  it('un CSV válido se lee entero', async () => {
    const r = await leerArchivo(archivo(plantilla, 'notas.csv', 'text/csv'), m)
    expect(r.origen).toBe('csv')
    expect(r.notas.length).toBeGreaterThan(10)
    expect(r.nombre).toBe('notas.csv')
  })
})

describe('proyección: deltas, disponibilidad y resumen', () => {
  const p = (materia: string, nota: number, semaforo: Prediccion['semaforo'] = 'verde'): Prediccion => ({
    materia,
    nota,
    rango: [nota - 0.3, nota + 0.3],
    probNoAprobar: semaforo === 'rojo' ? 0.7 : 0.05,
    semaforo,
    porQue: [],
    usaModelo: true,
  })
  const base = [p('A', 3.0, 'amarillo'), p('B', 4.0), p('C', 2.5, 'rojo')]
  const escenario = [p('A', 3.4, 'verde'), p('B', 4.02), p('C', 2.2, 'rojo'), p('D', 3.8)]

  it('deltas: ignora ruido, marca nuevas y ordena por tamaño del cambio', () => {
    const d = deltasPredicciones(base, escenario)
    expect(d.map((x) => x.materia)).toEqual(['A', 'C', 'D'])
    expect(d.find((x) => x.materia === 'B')).toBeUndefined()
    expect(d.find((x) => x.materia === 'D')).toMatchObject({ nueva: true, delta: null, antes: null })
    expect(d.find((x) => x.materia === 'A')?.delta).toBeCloseTo(0.4, 10)
    const cambiados = d.filter((x) => !x.nueva)
    expect(Math.abs(cambiados[0].delta!)).toBeGreaterThanOrEqual(Math.abs(cambiados[1].delta!))
  })
  it('sin escenario no hay deltas', () => {
    expect(deltasPredicciones(base, base)).toEqual([])
  })
  it('materias que se desbloquean o dejan de estar disponibles', () => {
    expect(cambiosDisponibilidad(base, escenario)).toEqual({ nuevas: ['D'], perdidas: [] })
    expect(cambiosDisponibilidad(escenario, base)).toEqual({ nuevas: [], perdidas: ['D'] })
  })
  it('resumen antes → después', () => {
    const r = resumirEscenario({ promedio: 3.5, predicciones: base }, { promedio: 3.6, predicciones: escenario })
    expect(r.promedio).toEqual({ antes: 3.5, despues: 3.6 })
    expect(r.rojo).toEqual({ antes: 1, despues: 1 })
    expect(r.disponibles).toEqual({ antes: 3, despues: 4 })
  })
})
