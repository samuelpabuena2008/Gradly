// Lectura de archivos y texto pegado: todo ocurre en el navegador, nada se envía a ningún servidor.
// Los lectores pesados (PDF) se cargan bajo demanda. Cualquier fallo se convierte en un `ErrorLectura`
// con un mensaje claro: la importación nunca rompe la interfaz.

import type { Malla, Nota } from '../../types'
import { describirErrorPdf, validarArchivo, type ErrorMostrable } from './archivo'

export type Origen = 'pdf' | 'csv' | 'texto' | 'ejemplo'

export interface Lectura {
  origen: Origen
  nombre?: string
  notas: Nota[]
  /** Problemas que impidieron leer filas del archivo. */
  errores: string[]
  /** Cosas que el lector hizo por su cuenta (electivas mapeadas, exigencias de inglés ignoradas…). */
  avisos: string[]
}

export class ErrorLectura extends Error implements ErrorMostrable {
  constructor(
    public titulo: string,
    public detalle: string,
  ) {
    super(titulo)
    this.name = 'ErrorLectura'
  }
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Lee texto pegado o de un CSV. Detecta si es el texto de un certificado de notas. */
export async function leerTexto(texto: string, malla: Malla, origen: Origen = 'texto', nombre?: string): Promise<Lectura> {
  if (texto.trim() === '') {
    throw new ErrorLectura('No hay nada que leer', 'Pega el texto del certificado o una tabla con las columnas materia,periodo,nota.')
  }
  try {
    const { esTextoCertificado, parsearTextoCertificado } = await import('../import/certificado')
    if (esTextoCertificado(texto)) {
      const r = parsearTextoCertificado(texto, malla)
      return { origen, nombre, notas: r.notas, errores: r.errores, avisos: r.avisos }
    }
    const { parsearNotasCsv } = await import('../import/csv')
    const r = parsearNotasCsv(texto)
    return { origen, nombre, notas: r.notas, errores: r.errores, avisos: [] }
  } catch (e) {
    throw new ErrorLectura('No pudimos interpretar el texto', `Revisa que tenga el formato esperado. Detalle técnico: ${mensaje(e)}`)
  }
}

export async function leerArchivo(archivo: File, malla: Malla): Promise<Lectura> {
  const valido = validarArchivo(archivo)
  if (!valido.ok) throw new ErrorLectura('No podemos leer este archivo', valido.error)

  if (valido.valor === 'pdf') {
    let buffer: ArrayBuffer
    try {
      buffer = await archivo.arrayBuffer()
    } catch (e) {
      throw new ErrorLectura('No pudimos abrir el archivo', `El navegador no pudo leerlo (${mensaje(e)}). Inténtalo de nuevo.`)
    }
    try {
      const { importarCertificadoPdf } = await import('../import/certificado')
      const r = await importarCertificadoPdf(buffer, malla)
      if (r.notas.length === 0 && r.errores.length > 0) throw describirError(r.errores)
      return { origen: 'pdf', nombre: archivo.name, notas: r.notas, errores: r.errores, avisos: r.avisos }
    } catch (e) {
      if (e instanceof ErrorLectura) throw e
      const d = describirErrorPdf([mensaje(e)])
      throw new ErrorLectura(d.titulo, `${d.detalle} (Detalle técnico: ${mensaje(e)})`)
    }
  }

  let texto: string
  try {
    texto = await archivo.text()
  } catch (e) {
    throw new ErrorLectura('No pudimos abrir el archivo', `El navegador no pudo leerlo (${mensaje(e)}). Inténtalo de nuevo.`)
  }
  // Un archivo «de texto» con caracteres nulos es en realidad binario (otro formato con extensión .csv).
  if (texto.includes('\u0000')) {
    throw new ErrorLectura('Este archivo no es una tabla de texto', `«${archivo.name}» parece un archivo binario. Gradly lee CSV con las columnas materia,periodo,nota.`)
  }
  return leerTexto(texto, malla, 'csv', archivo.name)
}

function describirError(errores: string[]): ErrorLectura {
  const d = describirErrorPdf(errores)
  return new ErrorLectura(d.titulo, d.detalle)
}
