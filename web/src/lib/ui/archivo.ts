// Comprobaciones previas a leer un archivo y mensajes accionables cuando algo sale mal.

import type { Validacion } from './notas'

/** Tamaño máximo aceptado. Un certificado de notas normal pesa unos cientos de KB. */
export const MAX_BYTES = 10 * 1024 * 1024

export type FormatoArchivo = 'pdf' | 'texto'

export interface ArchivoBasico {
  name: string
  size: number
  type?: string
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

export function validarArchivo(a: ArchivoBasico): Validacion<FormatoArchivo> {
  const nombre = a.name.toLowerCase()
  const esPdf = nombre.endsWith('.pdf') || a.type === 'application/pdf'
  const esTexto = /\.(csv|txt)$/.test(nombre) || (a.type ?? '').startsWith('text/') || a.type === 'application/vnd.ms-excel'

  if (!esPdf && !esTexto) {
    return {
      ok: false,
      error: `Gradly lee certificados de notas en PDF y tablas en CSV, y «${a.name}» no es ninguno de los dos. Descarga el certificado en PDF desde el portal de la universidad o usa la plantilla CSV.`,
    }
  }
  if (a.size === 0) return { ok: false, error: `El archivo «${a.name}» está vacío. Revisa que sea el correcto e inténtalo de nuevo.` }
  if (a.size > MAX_BYTES) {
    return {
      ok: false,
      error: `«${a.name}» pesa ${mb(a.size)} y el límite es ${mb(MAX_BYTES)}. Un certificado de notas normal pesa mucho menos: puede que sea otro documento.`,
    }
  }
  return { ok: true, valor: esPdf ? 'pdf' : 'texto' }
}

export interface ErrorMostrable {
  titulo: string
  detalle: string
}

/** Traduce los errores técnicos del lector de PDF a una explicación con una acción posible. */
export function describirErrorPdf(errores: string[]): ErrorMostrable {
  const texto = errores.join(' ')
  if (/no parece un certificado/i.test(texto)) {
    return {
      titulo: 'Este PDF no parece un certificado de notas de Uninorte',
      detalle:
        'Puede ser otro documento, o un PDF escaneado (una foto sin texto que Gradly no puede leer). Descarga el Certificado de Notas oficial en PDF desde el portal de la universidad e inténtalo de nuevo; si prefieres, copia el texto o usa un CSV.',
    }
  }
  if (/no es un pdf/i.test(texto)) {
    return {
      titulo: 'El archivo no es un PDF válido',
      detalle: 'Aunque termine en .pdf, su contenido no corresponde a un PDF. Descárgalo de nuevo desde el portal.',
    }
  }
  return {
    titulo: 'No pudimos leer este PDF',
    detalle:
      'Está dañado, protegido con contraseña o tiene un formato que Gradly no entiende. Descarga el certificado otra vez sin contraseña, o copia su texto y pégalo aquí.',
  }
}
