// Búsqueda difusa ligera para la paleta de comandos y los buscadores (sin dependencias).

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Puntaje de coincidencia de `consulta` en `texto` (mayor = mejor; `null` = no coincide).
 * Acepta subcadenas y letras en orden (p. ej. «calc2» encuentra «Cálculo II»), ignora acentos
 * y premia coincidencias contiguas, al inicio de palabra y al inicio del texto.
 */
export function puntajeDifuso(consulta: string, texto: string): number | null {
  const q = sinAcentos(consulta).replace(/\s+/g, ' ').trim()
  if (q === '') return 0
  const t = sinAcentos(texto)
  const directo = t.indexOf(q)
  if (directo >= 0) {
    const inicioPalabra = directo === 0 || t[directo - 1] === ' '
    return 100 - directo + (inicioPalabra ? 40 : 0) + q.length
  }
  let puntaje = 0
  let pos = 0
  let racha = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const i = t.indexOf(ch, pos)
    if (i < 0) return null
    racha = i === pos ? racha + 1 : 0
    puntaje += 1 + racha * 2 + (i === 0 || t[i - 1] === ' ' ? 4 : 0)
    pos = i + 1
  }
  return puntaje
}

export function filtrarDifuso<T>(items: T[], consulta: string, texto: (item: T) => string): T[] {
  if (consulta.trim() === '') return items
  return items
    .map((item, i) => ({ item, i, p: puntajeDifuso(consulta, texto(item)) }))
    .filter((x): x is { item: T; i: number; p: number } => x.p !== null)
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.item)
}
