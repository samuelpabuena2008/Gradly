// Lee la tabla de notas (materia, periodo, nota) desde un CSV.
// Acepta coma o punto y coma como separador, y coma decimal ("3,5") cuando el separador es ";".

import type { Nota } from '../../types'

export interface ResultadoCsv {
  notas: Nota[]
  errores: string[]
}

const COLUMNAS = ['materia', 'periodo', 'nota'] as const

export function parsearNotasCsv(texto: string): ResultadoCsv {
  const lineas = texto
    .replace(/^﻿/, '') // BOM que agrega Excel
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lineas.length === 0) return { notas: [], errores: ['El archivo está vacío'] }

  const separador = lineas[0].includes(';') ? ';' : ','
  const encabezado = lineas[0].split(separador).map((c) => c.trim().toLowerCase())
  const indice = Object.fromEntries(COLUMNAS.map((c) => [c, encabezado.indexOf(c)]))
  const faltan = COLUMNAS.filter((c) => indice[c] < 0)
  if (faltan.length > 0) {
    return { notas: [], errores: [`Faltan columnas: ${faltan.join(', ')}`] }
  }

  const notas: Nota[] = []
  const errores: string[] = []
  lineas.slice(1).forEach((linea, i) => {
    const celdas = linea.split(separador).map((c) => c.trim())
    const fila = i + 2
    const materia = celdas[indice.materia]?.toUpperCase()
    const periodo = celdas[indice.periodo]
    const nota = Number(celdas[indice.nota]?.replace(',', '.'))

    if (!materia || !periodo) {
      errores.push(`Fila ${fila}: falta materia o periodo`)
    } else if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
      errores.push(`Fila ${fila}: la nota debe estar entre 0 y 5`)
    } else {
      notas.push({ materia, periodo, nota })
    }
  })
  return { notas, errores }
}
