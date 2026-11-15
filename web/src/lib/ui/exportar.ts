// Exportar las notas con el formato de data/plantilla_notas.csv (materia,periodo,nota).

import type { Nota } from '../../types'

/** 3 → «3.0», 4.5 → «4.5», 3.75 → «3.75» (punto decimal, como la plantilla). */
function formatearNota(n: number): string {
  return n.toFixed(2).replace(/0$/, '')
}

export function notasACsv(notas: Nota[]): string {
  const filas = notas.map((n) => `${n.materia},${n.periodo},${formatearNota(n.nota)}`)
  return ['materia,periodo,nota', ...filas].join('\n') + '\n'
}

/** Descarga un archivo de texto generado en el navegador (no sale nada a la red). */
export function descargarTexto(nombre: string, contenido: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
