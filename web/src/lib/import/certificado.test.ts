import { describe, expect, it } from 'vitest'
import type { Malla } from '../../types'
import mallaSistemas from '../../../../data/malla_sistemas.json'
import {
  esTextoCertificado,
  extraerTextoPdf,
  importarCertificadoPdf,
  parsearTextoCertificado,
} from './certificado'

const malla = mallaSistemas as unknown as Malla

/** Texto del certificado de tres semestres, tal como lo entrega la universidad. */
const CERTIFICADO = `Código de Verificación: IDPVRW5VYK0UEDEW8FAV
Fecha: 21/09/2026 3:53:54 p. m.
Nombre: ORTIZ VIZCAINO MAIKEL ENRIQUE
Nivel: Educación Superior Pregrado
Programa: Ingeniería de Sistemas y Computación
Modalidad: Semestral

Periodo Académico: Primer semestre 2025
Promedio Periodo Académico: 4,04
Asignatura Nombre asignatura CRD Nota HRS Semanales HRS Semestrales
MAT 1031 ALGEBRA LINEAL 3 3.4 3 48
IST 2088 ALGORITMIA Y PROGRAMACIÓN I 3 4.3 4 64
MAT 1101 CALCULO I 5 4.0 6 96
CAS 3020 COMPETENCIA COMUNICATIVA I 3 4.2 3 48
IGL 4905 EXIGENCIA INGLES IV 0 4.1 4 64
IST 0010 INT A LA ING. DE SISTEMAS 1 4.9 1 16
Totales: 15 21 336

Periodo Académico: Segundo semestre 2025
Promedio Periodo Académico: 4,61
Asignatura Nombre asignatura CRD Nota HRS Semanales HRS Semestrales
IST 2089 ALGORITMIA Y PROGRAMACIÓN II 3 5.0 4 64
HIS 7130 AMERICA PREHISPANICA 3 4.4 3 48
MAT 1111 CALCULO II 4 4.6 4 64
CAS 3030 COMPETENCIA COMUNICATIVA II 3 4.5 3 48
IGL 4910 EXIGENCIA INGLES V 0 4.1 4 64
FIS 1023 FÍSICA MECANICA 4 4.6 5 80
Totales: 17 23 368

Periodo Académico: Primer semestre 2026
Promedio Periodo Académico: 4,30
Asignatura Nombre asignatura CRD Nota HRS Semanales HRS Semestrales
MAT 1121 CALCULO 3 4 4.5 4 64
CSV 0061 ECOLOGIA URBANA 3 4.7 3 48
IST 4021 ESTRUCTURA DE DATOS I-IS 3 4.7 4 64
IGL 4915 EXIGENCIA INGLES VI 0 4.5 4 64
FIS 1043 FISICA CALOR ONDAS 4 3.5 5 80
IST 2110 PROGRAMACION ORIENTADA OBJETOS 3 4.3 4 64
Totales: 17 24 384`

/** Las 15 notas del certificado, en el orden en que aparecen. */
const ESPERADAS = [
  { materia: 'MAT1031', periodo: '2025-1', nota: 3.4 },
  { materia: 'IST2088', periodo: '2025-1', nota: 4.3 },
  { materia: 'MAT1101', periodo: '2025-1', nota: 4.0 },
  { materia: 'CAS3020', periodo: '2025-1', nota: 4.2 },
  { materia: 'IST0010', periodo: '2025-1', nota: 4.9 },
  { materia: 'IST2089', periodo: '2025-2', nota: 5.0 },
  { materia: 'ELG1140', periodo: '2025-2', nota: 4.4 },
  { materia: 'MAT1111', periodo: '2025-2', nota: 4.6 },
  { materia: 'CAS3030', periodo: '2025-2', nota: 4.5 },
  { materia: 'FIS1023', periodo: '2025-2', nota: 4.6 },
  { materia: 'MAT1121', periodo: '2026-1', nota: 4.5 },
  { materia: 'ELG1150', periodo: '2026-1', nota: 4.7 },
  { materia: 'IST4021', periodo: '2026-1', nota: 4.7 },
  { materia: 'FIS1043', periodo: '2026-1', nota: 3.5 },
  { materia: 'IST2110', periodo: '2026-1', nota: 4.3 },
]

const RUTA_PDF = decodeURIComponent(
  new URL('../../../../3er Sem. Certificado notas.pdf', import.meta.url).pathname,
)

/** Acceso a `node:fs` sin depender de `@types/node` en el proyecto web. */
type FsMinimo = {
  existsSync: (ruta: string) => boolean
  readFileSync: (ruta: string) => Uint8Array
}

async function leerPdf(): Promise<Uint8Array | null> {
  const fs = (await import('node:fs' as string)) as unknown as FsMinimo
  return fs.existsSync(RUTA_PDF) ? fs.readFileSync(RUTA_PDF) : null
}

describe('esTextoCertificado', () => {
  it('reconoce el certificado y descarta un CSV', () => {
    expect(esTextoCertificado(CERTIFICADO)).toBe(true)
    expect(esTextoCertificado('materia,periodo,nota\nCAL1,2025-1,3.8')).toBe(false)
  })

  it('no confunde un CSV con encabezados de la malla con un certificado', () => {
    const csv = 'materia,periodo,nota\nMAT1031,2025-1,3.4\nIST2088,2025-1,4.3'
    expect(esTextoCertificado(csv)).toBe(false)
  })

  it('deja intacta la lectura de CSV: un CSV sigue pasando por parsearNotasCsv', async () => {
    const { parsearNotasCsv } = await import('./csv')
    const csv = 'materia,periodo,nota\nMAT1031,2025-1,3.4\n'
    expect(esTextoCertificado(csv)).toBe(false)
    expect(parsearNotasCsv(csv).notas).toEqual([{ materia: 'MAT1031', periodo: '2025-1', nota: 3.4 }])
  })
})

describe('parsearTextoCertificado', () => {
  it('lee los tres periodos y omite las exigencias de 0 créditos sin reportarlas como error', () => {
    const r = parsearTextoCertificado(CERTIFICADO, malla)
    expect(r.errores).toEqual([])
    expect(r.notas).toEqual(ESPERADAS)
    expect(r.avisos.some((a) => a.includes('3 cursos de 0 créditos'))).toBe(true)
  })

  it('ubica las electivas en su cupo ELG* de la malla y lo avisa', () => {
    const r = parsearTextoCertificado(CERTIFICADO, malla)
    expect(r.notas.filter((n) => n.materia.startsWith('ELG')).map((n) => n.materia)).toEqual([
      'ELG1140',
      'ELG1150',
    ])
    expect(r.avisos.some((a) => a.includes('HIS7130 → ELG1140'))).toBe(true)
    expect(r.avisos.some((a) => a.includes('CSV0061 → ELG1150'))).toBe(true)
  })

  it('sin malla conserva los códigos del certificado y no inventa avisos de mapeo', () => {
    const r = parsearTextoCertificado(CERTIFICADO)
    expect(r.notas.map((n) => n.materia)).toContain('HIS7130')
    expect(r.notas.map((n) => n.materia)).toContain('CSV0061')
    expect(r.avisos.some((a) => a.includes('electivas'))).toBe(false)
  })

  it('traduce intersemestral y verano al periodo 3', () => {
    const texto = [
      'Periodo Académico: Intersemestral 2025',
      'MAT 1031 ALGEBRA LINEAL 3 3,4 3 48',
      'Periodo Académico: Verano 2026',
      'MAT 1101 CALCULO I 5 4,0 6 96',
      'Periodo Académico: Tercer semestre 2026',
      'MAT 1111 CALCULO II 4 4,6 4 64',
    ].join('\n')
    expect(parsearTextoCertificado(texto).notas).toEqual([
      { materia: 'MAT1031', periodo: '2025-3', nota: 3.4 },
      { materia: 'MAT1101', periodo: '2026-3', nota: 4.0 },
      { materia: 'MAT1111', periodo: '2026-3', nota: 4.6 },
    ])
  })

  it('aplica la errata de Física Electricidad y avisa de las materias que no están en la malla', () => {
    const texto = [
      'Periodo Académico: Primer semestre 2026',
      'FIS 1043 FISICA ELECTRICIDAD 4 4.1 5 80',
      'MAT 9999 MATERIA INVENTADA 3 4.0 3 48',
    ].join('\n')
    const r = parsearTextoCertificado(texto, malla)
    expect(r.notas).toEqual([{ materia: 'FIS1033', periodo: '2026-1', nota: 4.1 }])
    expect(r.avisos.some((a) => a.includes('MAT9999'))).toBe(true)
    expect(r.errores).toEqual([])
  })

  it('reporta notas fuera de 0–5 y filas sin periodo', () => {
    const texto = [
      'MAT 1031 ALGEBRA LINEAL 3 3.4 3 48',
      'Periodo Académico: Primer semestre 2025',
      'MAT 1101 CALCULO I 5 9.9 6 96',
      'CAS 3020 COMPETENCIA COMUNICATIVA I 3 4.2 3 48',
    ].join('\n')
    const r = parsearTextoCertificado(texto)
    expect(r.notas).toEqual([{ materia: 'CAS3020', periodo: '2025-1', nota: 4.2 }])
    expect(r.errores).toEqual([
      'MAT1031: no se encontró el periodo académico',
      'MAT1101: la nota debe estar entre 0 y 5',
    ])
  })

  it('avisa cuando el texto no trae ningún curso', () => {
    const r = parsearTextoCertificado('Periodo Académico: Primer semestre 2025')
    expect(r.notas).toEqual([])
    expect(r.errores).toEqual(['No se encontraron cursos en el certificado'])
  })
})

describe('importarCertificadoPdf', () => {
  it('extrae las 15 notas del certificado real de tres semestres', async () => {
    const pdf = await leerPdf()
    if (!pdf) return // El PDF es un archivo del usuario y puede no estar en el clon.
    const r = await importarCertificadoPdf(pdf, malla)
    expect(r.errores).toEqual([])
    expect(r.notas).toEqual(ESPERADAS)
  })

  it('lee un PDF sintético con un flujo FlateDecode y texto por caracteres', async () => {
    const r = await importarCertificadoPdf(pdfSintetico(CERTIFICADO))
    expect(r.errores).toEqual([])
    expect(r.notas).toHaveLength(15)
    expect(r.notas[0]).toEqual({ materia: 'MAT1031', periodo: '2025-1', nota: 3.4 })
  })

  it('reporta un archivo que no es PDF', async () => {
    const r = await importarCertificadoPdf(new TextEncoder().encode('materia,periodo,nota'))
    expect(r.notas).toEqual([])
    expect(r.errores).toEqual(['No se pudo leer el PDF: El archivo no es un PDF'])
  })
})

describe('extraerTextoPdf', () => {
  it('reconstruye cada renglón del certificado', async () => {
    const pdf = await leerPdf()
    if (!pdf) return
    const texto = await extraerTextoPdf(pdf)
    expect(texto).toContain('MAT 1031 ALGEBRA LINEAL 3 3.4 3 48')
    expect(texto).toContain('IST 2110 PROGRAMACION ORIENTADA OBJETOS 3 4.3 4 64')
  })
})

/**
 * Arma un PDF mínimo con una página y el texto dibujado carácter por carácter,
 * como lo hace el certificado de la universidad. El flujo va sin comprimir para
 * que la prueba no dependa de una implementación de deflate y cada carácter se
 * escribe como un solo byte (WinAnsi), igual que en el PDF real.
 */
function pdfSintetico(texto: string): Uint8Array {
  const lineas = texto.split('\n')
  const operaciones: string[] = []
  lineas.forEach((linea, i) => {
    const y = 700 - i * 12
    operaciones.push('BT', '/F0 8 Tf', `40 ${y} Td`)
    for (const caracter of linea) {
      const escapado = caracter === '(' || caracter === ')' || caracter === '\\' ? `\\${caracter}` : caracter
      operaciones.push(`[(${escapado})-6.5] TJ`)
    }
    operaciones.push('ET')
  })

  const contenido = bytesLatin1(operaciones.join('\n'))
  const partes: Uint8Array[] = []
  const empujar = (t: string) => partes.push(bytesLatin1(t))

  empujar('%PDF-1.4\n')
  empujar('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  empujar('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  empujar('3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n')
  empujar(`4 0 obj\n<< /Length ${contenido.length} >>\nstream\n`)
  partes.push(contenido)
  empujar('\nendstream\nendobj\n')
  empujar('trailer\n<< /Root 1 0 R >>\n%%EOF\n')

  const total = partes.reduce((suma, parte) => suma + parte.length, 0)
  const salida = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) {
    salida.set(parte, offset)
    offset += parte.length
  }
  return salida
}

/** Codifica texto como bytes de un solo octeto (WinAnsi), como en un PDF real. */
function bytesLatin1(texto: string): Uint8Array {
  const salida = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) salida[i] = texto.charCodeAt(i) & 0xff
  return salida
}
