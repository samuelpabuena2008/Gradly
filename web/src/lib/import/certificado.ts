// Importa el certificado de notas oficial de la Universidad del Norte.
// Acepta el PDF tal como lo entrega la universidad o el texto copiado de él.
// Todo se procesa en el navegador: el archivo nunca sale del equipo.

import type { Malla, Nota } from '../../types'

export interface ResultadoCertificado {
  notas: Nota[]
  errores: string[]
  avisos: string[]
}

/** Cursos de 0 créditos que la malla no incluye (exigencias de idiomas). */
const EXIGENCIAS = /^IGL/

/** Electivas que la malla guarda con un código ELG*, pero que el certificado trae con su código real. */
const ELECTIVAS: { id: string; codigos: RegExp; nombres: RegExp }[] = [
  { id: 'ELG1140', codigos: /^HIS/, nombres: /HISTORIA/ },
  { id: 'ELG1150', codigos: /^(CSV|BIO)/, nombres: /ECOLOGIA|BIOLOGIA/ },
  { id: 'ELG1160', codigos: /^FIL/, nombres: /FILOSOFIA/ },
  { id: 'ELG1170', codigos: /^ETI/, nombres: /ETICA/ },
  { id: 'ELG1130', codigos: /^HUM/, nombres: /HUMANIDADES/ },
  { id: 'ELG1190', codigos: /^SOC/, nombres: /SOCIEDAD|SOCIALES/ },
  { id: 'ELG1180', codigos: /^CAR/, nombres: /CARIBE/ },
]

/** Una fila de la tabla del certificado ya separada en sus columnas. */
interface FilaCertificado {
  codigo: string
  nombre: string
  creditos: number
  nota: number
}

// ---------------------------------------------------------------------------
// Texto del certificado
// ---------------------------------------------------------------------------

/** Quita tildes y pasa a minúsculas para comparar sin depender de la ortografía. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** ¿El texto pegado corresponde a un certificado de notas y no a un CSV? */
export function esTextoCertificado(texto: string): boolean {
  const t = normalizar(texto)
  const tienePeriodo = /periodo\s+academico/.test(t)
  const tieneSemestre = /\b(primer|segundo|tercer)\s+semestre\b|\bintersemestral\b|\bverano\b/.test(t)
  const tieneTabla = /asignatura/.test(t) && /\bcrd\b/.test(t) && /\bnota\b/.test(t)
  return (tienePeriodo && tieneSemestre) || (tieneTabla && tienePeriodo)
}

const NOMBRE_SEMESTRE: Record<string, string> = { primer: '1', segundo: '2', tercer: '3' }

/**
 * Periodo (AAAA-S) que anuncia una línea del certificado.
 * `Primer semestre 2025` → `2025-1`, `Segundo semestre 2025` → `2025-2`,
 * `Intersemestral 2025` / `Tercer semestre 2025` / `Verano 2025` → `2025-3`.
 */
function periodoDeLinea(linea: string): string {
  const t = normalizar(linea)
  const directo = /periodo\s+academico\s*:?\s*(\d{4})-([1-3])/.exec(t)
  if (directo) return `${directo[1]}-${directo[2]}`

  const semestre = /\b(primer|segundo|tercer)\s+semestre\s+(?:de\s+)?(\d{4})/.exec(t)
  if (semestre) return `${semestre[2]}-${NOMBRE_SEMESTRE[semestre[1]]}`

  const otro = /\b(?:intersemestral|verano)\s+(?:de\s+)?(\d{4})/.exec(t)
  if (otro) return `${otro[1]}-3`

  return ''
}

/** Código, nombre y notas de una fila: `MAT 1031 ALGEBRA LINEAL 3 3.4 3 48`. */
const RE_FILA = /^([A-Za-z]{2,4})\s+(\d{3,4})\s+(.+)\s+(\d{1,2})\s+([\d.,]+)\s+(\d{1,2})\s+(\d{1,3})$/

/** Inicio de una fila: código de departamento y número de asignatura. */
const RE_INICIO = /^[A-Za-z]{2,4}\s+\d{3,4}\b/

function leerFila(linea: string): FilaCertificado | null {
  const m = RE_FILA.exec(linea)
  if (!m) return null
  return {
    codigo: `${m[1].toUpperCase()}${m[2]}`,
    nombre: m[3].trim(),
    creditos: Number(m[4]),
    nota: Number(m[5].replace(',', '.')),
  }
}

/** Código ELG* de la malla que corresponde a una electiva del certificado. */
function mapearElectiva(codigo: string, nombre: string, ids: Set<string>): string | null {
  const n = normalizar(nombre)
  for (const electiva of ELECTIVAS) {
    if (!ids.has(electiva.id)) continue
    if (electiva.codigos.test(codigo) || electiva.nombres.test(n)) return electiva.id
  }
  return null
}

/**
 * Lee las notas de un certificado de notas de Uninorte (texto del PDF o copiado a mano).
 * Los cursos de 0 créditos se omiten sin reportarlos como error y las electivas se
 * ubican en su cupo ELG* de la malla cuando `malla` se provee.
 */
export function parsearTextoCertificado(texto: string, malla?: Malla): ResultadoCertificado {
  const notas: Nota[] = []
  const errores: string[] = []
  const omitidos: string[] = []
  const mapeadas: string[] = []
  const ignoradas: string[] = []
  const ids = malla ? new Set(malla.materias.map((m) => m.id)) : null
  let periodo = ''
  let vistas = 0

  const lineas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim())

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    if (!linea) continue

    const anunciado = periodoDeLinea(linea)
    if (anunciado) {
      periodo = anunciado
      continue
    }

    // Algunos visores parten el nombre de la asignatura en dos renglones.
    let candidata = linea
    if (!leerFila(linea) && RE_INICIO.test(linea) && lineas[i + 1]) {
      const unida = `${linea} ${lineas[i + 1]}`
      if (leerFila(unida)) {
        candidata = unida
        i++
      }
    }

    const fila = leerFila(candidata)
    if (!fila) continue
    vistas++

    const etiqueta = `${fila.codigo} (${fila.nombre})`

    if (!periodo) {
      errores.push(`${fila.codigo}: no se encontró el periodo académico`)
      continue
    }
    if (fila.creditos === 0 || EXIGENCIAS.test(fila.codigo)) {
      omitidos.push(etiqueta)
      continue
    }
    if (!Number.isFinite(fila.nota) || fila.nota < 0 || fila.nota > 5) {
      errores.push(`${fila.codigo}: la nota debe estar entre 0 y 5`)
      continue
    }

    // Errata conocida: el diagrama oficial rotula Física Electricidad como FIS 1043.
    let id = fila.codigo
    if (id === 'FIS1043' && /electricidad/.test(normalizar(fila.nombre))) id = 'FIS1033'

    if (ids && !ids.has(id)) {
      const electiva = mapearElectiva(fila.codigo, fila.nombre, ids)
      if (!electiva) {
        ignoradas.push(etiqueta)
        continue
      }
      mapeadas.push(`${fila.codigo} → ${electiva}`)
      id = electiva
    }

    notas.push({ materia: id, periodo, nota: fila.nota })
  }

  const avisos: string[] = []
  if (omitidos.length > 0) {
    avisos.push(
      `Se omitieron ${omitidos.length} cursos de 0 créditos porque no hacen parte de la malla: ${omitidos.join(', ')}`,
    )
  }
  if (mapeadas.length > 0) {
    avisos.push(`Se ubicaron ${mapeadas.length} electivas en su cupo de la malla: ${mapeadas.join(', ')}`)
  }
  if (ignoradas.length > 0) {
    avisos.push(`Cursos que no están en la malla y se ignoraron: ${ignoradas.join(', ')}`)
  }
  if (vistas === 0) {
    errores.push('No se encontraron cursos en el certificado')
  } else if (notas.length === 0 && errores.length === 0 && ignoradas.length === 0) {
    errores.push('No se pudo leer ninguna nota del certificado')
  }

  return { notas, errores, avisos }
}

// ---------------------------------------------------------------------------
// Lectura del PDF (100% en el navegador)
// ---------------------------------------------------------------------------

interface ItemTexto {
  x: number
  y: number
  texto: string
  /** Tamaño de la fuente en puntos, para estimar el ancho del trozo. */
  tamano: number
}

interface ObjetoPdf {
  num: number
  /** Primer byte del cuerpo, justo después de `N 0 obj`. */
  inicio: number
  /** Byte donde empieza `endobj`. */
  fin: number
}

/** Convierte bytes a texto 1:1 (cada byte es un carácter), útil para recorrer la estructura. */
function latin1(bytes: Uint8Array): string {
  let salida = ''
  const bloque = 8192
  for (let i = 0; i < bytes.length; i += bloque) {
    salida += String.fromCharCode(...bytes.subarray(i, i + bloque))
  }
  return salida
}

const DECODIFICADOR_ANSI = new TextDecoder('windows-1252')

function decodificarAnsi(bytes: number[]): string {
  return DECODIFICADOR_ANSI.decode(new Uint8Array(bytes))
}

/** Descomprime un flujo FlateDecode. Prueba primero el formato zlib y luego el crudo. */
async function inflar(datos: Uint8Array): Promise<Uint8Array | null> {
  // Copia a un `ArrayBuffer` propio: `DecompressionStream` no acepta vistas sobre `SharedArrayBuffer`.
  const entrada = new Uint8Array(datos)
  for (const formato of ['deflate', 'deflate-raw'] as const) {
    try {
      const flujo = new DecompressionStream(formato)
      // Hay que consumir la salida antes de escribir: si no, el flujo se bloquea por contrapresión.
      const lectura = new Response(flujo.readable).arrayBuffer()
      const escritor = flujo.writable.getWriter()
      await escritor.write(entrada)
      await escritor.close()
      return new Uint8Array(await lectura)
    } catch {
      // Prueba el siguiente formato.
    }
  }
  return null
}

/** Recorre los objetos del PDF saltando el contenido de los flujos. */
function leerObjetos(crudo: string): ObjetoPdf[] {
  // Un PDF puede traer varias versiones del mismo objeto (actualizaciones incrementales):
  // gana siempre la última, que es la que define el documento vigente.
  const porNumero = new Map<number, ObjetoPdf>()
  const re = /(\d+)\s+0\s+obj/g
  let m: RegExpExecArray | null
  while ((m = re.exec(crudo))) {
    const num = Number(m[1])
    const fin = crudo.indexOf('endobj', m.index)
    if (fin < 0) break
    porNumero.set(num, { num, inicio: m.index + m[0].length, fin })
    re.lastIndex = fin + 'endobj'.length
  }
  return [...porNumero.values()]
}

/** Diccionario y datos crudos de un objeto con flujo, si lo tiene. */
function leerStream(
  bytes: Uint8Array,
  crudo: string,
  objeto: ObjetoPdf,
): { dict: string; datos: Uint8Array } | null {
  const cuerpo = crudo.slice(objeto.inicio, objeto.fin)
  const m = /<<([\s\S]*?)>>\s*stream\r?\n/.exec(cuerpo)
  if (!m) return null

  const inicioDatos = objeto.inicio + m.index + m[0].length

  // `/Length` es la fuente confiable: el salto de línea previo a `endstream` no cuenta.
  const declarado = /\/Length\s+(\d+)/.exec(m[1])
  if (declarado) {
    const fin = inicioDatos + Number(declarado[1])
    if (fin <= bytes.length) return { dict: m[1], datos: bytes.subarray(inicioDatos, fin) }
  }

  const finStream = crudo.indexOf('endstream', inicioDatos)
  if (finStream < 0) return null

  let fin = finStream
  if (crudo[fin - 1] === '\n') fin--
  if (crudo[fin - 1] === '\r') fin--

  return { dict: m[1], datos: bytes.subarray(inicioDatos, fin) }
}

/** Referencias a los flujos de contenido de cada página, en orden. */
function paginas(objetos: ObjetoPdf[], crudo: string): number[][] {
  const refs: number[][] = []
  for (const objeto of objetos) {
    const cuerpo = crudo.slice(objeto.inicio, objeto.fin)
    if (!/\/Type\s*\/Page(?!s)/.test(cuerpo)) continue
    const contenido = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(cuerpo)
    if (!contenido) continue
    refs.push([...contenido[1].matchAll(/(\d+)\s+0\s+R/g)].map((m) => Number(m[1])))
  }
  return refs
}

/** Texto Unicode de una cadena hexadecimal UTF-16BE. */
function hexAString(hex: string): string {
  const limpio = hex.replace(/\s+/g, '')
  let salida = ''
  for (let i = 0; i + 4 <= limpio.length; i += 4) {
    salida += String.fromCharCode(parseInt(limpio.slice(i, i + 4), 16))
  }
  return salida
}

/** Tabla CID → Unicode declarada por los flujos `ToUnicode` del PDF. */
function leerCmap(texto: string): Map<string, string> {
  const mapa = new Map<string, string>()

  for (const bloque of texto.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const par of bloque[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      mapa.set(par[1].toUpperCase().padStart(4, '0'), hexAString(par[2]))
    }
  }

  for (const bloque of texto.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const rangos = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g
    for (const rango of bloque[1].matchAll(rangos)) {
      const desde = parseInt(rango[1], 16)
      const hasta = parseInt(rango[2], 16)
      if (rango[3]) {
        const base = parseInt(rango[3], 16)
        for (let c = desde; c <= hasta && c - desde < 512; c++) {
          mapa.set(c.toString(16).toUpperCase().padStart(4, '0'), String.fromCodePoint(base + c - desde))
        }
      } else if (rango[4]) {
        const destinos = [...rango[4].matchAll(/<([0-9A-Fa-f]+)>/g)].map((d) => hexAString(d[1]))
        destinos.forEach((destino, k) => {
          if (desde + k <= hasta) {
            mapa.set((desde + k).toString(16).toUpperCase().padStart(4, '0'), destino)
          }
        })
      }
    }
  }

  return mapa
}

/** Lee una cadena literal `( ... )` respetando escapes y paréntesis anidados. */
function leerLiteral(texto: string, inicio: number): { texto: string; fin: number } {
  const bytes: number[] = []
  const simples: Record<string, number> = {
    n: 10,
    r: 13,
    t: 9,
    b: 8,
    f: 12,
    '(': 40,
    ')': 41,
    '\\': 92,
  }
  let i = inicio + 1
  let profundidad = 1

  while (i < texto.length) {
    const c = texto[i]
    if (c === '\\') {
      const siguiente = texto[i + 1]
      if (siguiente in simples) {
        bytes.push(simples[siguiente])
        i += 2
        continue
      }
      if (siguiente >= '0' && siguiente <= '7') {
        let octal = ''
        let j = i + 1
        while (j < texto.length && j < i + 4 && texto[j] >= '0' && texto[j] <= '7') {
          octal += texto[j]
          j++
        }
        bytes.push(parseInt(octal, 8))
        i = j
        continue
      }
      i += 2
      continue
    }
    if (c === '(') {
      profundidad++
      bytes.push(40)
      i++
      continue
    }
    if (c === ')') {
      profundidad--
      if (profundidad === 0) return { texto: decodificarAnsi(bytes), fin: i + 1 }
      bytes.push(41)
      i++
      continue
    }
    bytes.push(c.charCodeAt(0))
    i++
  }

  return { texto: decodificarAnsi(bytes), fin: i }
}

/** Texto de una cadena hexadecimal según el tipo de fuente activa. */
function leerHex(hex: string, fuente: string, esTipo0: (f: string) => boolean, cmap: Map<string, string>): string {
  const limpio = hex.replace(/\s+/g, '')
  if (esTipo0(fuente) && cmap.size > 0) {
    let salida = ''
    for (let i = 0; i + 4 <= limpio.length; i += 4) {
      salida += cmap.get(limpio.slice(i, i + 4).toUpperCase()) ?? ''
    }
    return salida
  }
  return hexAString(limpio)
}

/**
 * Recorre un flujo de contenido y devuelve cada trozo de texto con su posición.
 * Los certificados de Uninorte dibujan cada carácter por separado dentro de
 * arreglos `TJ`, así que la posición (`Td`/`Tm`) es lo que reconstruye las filas.
 */
function extraerItems(
  contenido: string,
  esTipo0: (f: string) => boolean,
  cmap: Map<string, string>,
): ItemTexto[] {
  const items: ItemTexto[] = []
  let tx = 0
  let ty = 0
  let tamano = 0
  let fuente = ''
  let pila: (string | number)[] = []
  let i = 0

  // El texto de un mismo bloque va seguido: se acumula hasta que cambie la posición.
  let pendiente: ItemTexto | null = null

  const numeros = () => pila.filter((v): v is number => typeof v === 'number')

  const cerrar = () => {
    if (pendiente && pendiente.texto.trim()) items.push(pendiente)
    pendiente = null
  }

  const emitir = () => {
    const texto = pila
      .filter((v): v is string => typeof v === 'string' && !v.startsWith('/'))
      .join('')
    pila = []
    if (!texto) return
    if (pendiente && Math.abs(pendiente.y - ty) < 0.5) {
      pendiente.texto += texto
      return
    }
    cerrar()
    pendiente = { x: tx, y: ty, texto, tamano }
  }

  while (i < contenido.length) {
    const c = contenido[i]

    if (c === '(') {
      const literal = leerLiteral(contenido, i)
      pila.push(literal.texto)
      i = literal.fin
      continue
    }

    if (c === '<' && contenido[i + 1] !== '<') {
      const fin = contenido.indexOf('>', i)
      if (fin < 0) break
      pila.push(leerHex(contenido.slice(i + 1, fin), fuente, esTipo0, cmap))
      i = fin + 1
      continue
    }

    if (c === '[' || c === ']' || c === '>' || c === '<') {
      i++
      continue
    }

    if (c === '/') {
      let j = i + 1
      while (j < contenido.length && !/[\s/<>[\]()]/.test(contenido[j])) j++
      pila.push(contenido.slice(i, j))
      i = j
      continue
    }

    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) {
      const numero = /^[-+]?\d*\.?\d+/.exec(contenido.slice(i, i + 24))
      if (numero) {
        pila.push(Number(numero[0]))
        i += numero[0].length
        continue
      }
    }

    const operador = /^[A-Za-z*'"]+/.exec(contenido.slice(i, i + 8))
    if (operador) {
      const op = operador[0]
      i += op.length

      if (op === 'BT') {
        cerrar()
        tx = 0
        ty = 0
        pila = []
      } else if (op === 'Tf') {
        const nombre = pila.find((v): v is string => typeof v === 'string')
        const medida = numeros()[0]
        if (nombre) fuente = nombre
        if (medida !== undefined) tamano = medida
        pila = []
      } else if (op === 'Td' || op === 'TD') {
        cerrar()
        const [a, b] = numeros()
        if (a !== undefined && b !== undefined) {
          tx += a
          ty += b
        }
        pila = []
      } else if (op === 'Tm') {
        cerrar()
        const v = numeros()
        if (v.length >= 6) {
          tx = v[4]
          ty = v[5]
        }
        pila = []
      } else if (op === 'T*') {
        cerrar()
        ty -= tamano || 12
        pila = []
      } else if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
        emitir()
      } else if (op === 'ET') {
        cerrar()
        pila = []
      } else {
        pila = []
      }
      continue
    }

    i++
  }

  cerrar()
  return items
}

/** Agrupa los trozos por renglón (misma altura) y los une de izquierda a derecha. */
function armarLineas(items: ItemTexto[]): string[] {
  const filas = new Map<number, ItemTexto[]>()
  for (const item of items) {
    const clave = Math.round(item.y * 10) / 10
    const fila = filas.get(clave)
    if (fila) fila.push(item)
    else filas.set(clave, [item])
  }

  return [...filas.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, fila]) =>
      fila
        .sort((a, b) => a.x - b.x)
        .map((item) => item.texto.trim())
        .filter((texto) => texto.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((linea) => linea.length > 0)
}

/** Extrae todo el texto de un PDF, en el orden en que se ve en pantalla. */
export async function extraerTextoPdf(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const crudo = latin1(bytes)
  if (!crudo.startsWith('%PDF')) throw new Error('El archivo no es un PDF')

  const objetos = leerObjetos(crudo)

  // Descomprime cada flujo una sola vez. Los flujos sin filtro se usan tal cual.
  const flujos = new Map<number, Uint8Array>()
  for (const objeto of objetos) {
    const stream = leerStream(bytes, crudo, objeto)
    if (!stream) continue
    // Las imágenes no aportan texto y son lo más pesado del archivo.
    if (/\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode|\/JBIG2Decode/.test(stream.dict)) continue
    if (!/\/FlateDecode/.test(stream.dict)) {
      flujos.set(objeto.num, stream.datos)
      continue
    }
    const datos = await inflar(stream.datos)
    if (datos) flujos.set(objeto.num, datos)
  }

  // Tablas CID → Unicode y fuentes Identity-H (las que usan cadenas hexadecimales).
  const cmap = new Map<string, string>()
  const tipo0 = new Set<number>()
  const fuentes = new Map<string, number>()

  for (const objeto of objetos) {
    const cuerpo = crudo.slice(objeto.inicio, objeto.fin)
    if (/\/Subtype\s*\/Type0/.test(cuerpo)) tipo0.add(objeto.num)
    for (const recursos of cuerpo.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)) {
      for (const ref of recursos[1].matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g)) {
        fuentes.set(ref[1], Number(ref[2]))
      }
    }
  }

  for (const datos of flujos.values()) {
    const texto = latin1(datos)
    if (!texto.includes('begincmap')) continue
    for (const [cid, unicode] of leerCmap(texto)) cmap.set(cid, unicode)
  }

  const esTipo0 = (nombre: string) => {
    const num = fuentes.get(nombre.replace(/^\//, ''))
    return num !== undefined && tipo0.has(num)
  }

  // Cada página aporta sus flujos de contenido en orden.
  let paginasPdf = paginas(objetos, crudo)
  if (paginasPdf.length === 0) {
    const contenido = [...flujos.keys()].filter((num) => {
      const texto = latin1(flujos.get(num)!)
      return texto.includes('BT') && (texto.includes('TJ') || texto.includes('Tj'))
    })
    paginasPdf = [contenido]
  }

  const lineas: string[] = []
  for (const pagina of paginasPdf) {
    const items: ItemTexto[] = []
    for (const num of pagina) {
      const datos = flujos.get(num)
      if (!datos) continue
      items.push(...extraerItems(latin1(datos), esTipo0, cmap))
    }
    lineas.push(...armarLineas(items))
  }

  return lineas.join('\n')
}

/** Lee un certificado de notas en PDF y devuelve las notas que reconoce. */
export async function importarCertificadoPdf(
  buffer: ArrayBuffer | Uint8Array,
  malla?: Malla,
): Promise<ResultadoCertificado> {
  let texto: string
  try {
    texto = await extraerTextoPdf(buffer)
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'archivo ilegible'
    return { notas: [], errores: [`No se pudo leer el PDF: ${motivo}`], avisos: [] }
  }

  if (!esTextoCertificado(texto)) {
    return {
      notas: [],
      errores: ['El PDF no parece un certificado de notas de la Universidad del Norte'],
      avisos: [],
    }
  }

  return parsearTextoCertificado(texto, malla)
}
