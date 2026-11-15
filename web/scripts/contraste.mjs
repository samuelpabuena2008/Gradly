// Verifica el contraste (WCAG 2.2) de los pares texto/fondo de src/styles/tokens.css.
// Uso: node scripts/contraste.mjs      (sale con código 1 si algún par obligatorio falla)

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const aqui = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(aqui, '../src/styles/tokens.css'), 'utf8')

/** Lee los tokens hexadecimales (--nombre: #rrggbb). */
const tokens = {}
for (const [, nombre, hex] of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[nombre] = hex

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const fondos = ['bg-canvas', 'bg-app', 'bg-panel', 'bg-raised', 'bg-hover']

// [primer plano, fondos, mínimo, descripción]
const pares = [
  ['text', fondos, 4.5, 'texto principal'],
  ['text-muted', fondos, 4.5, 'texto secundario'],
  ['text-faint', ['bg-canvas', 'bg-app', 'bg-panel'], 4.5, 'placeholder y apoyo'],
  ['accent-soft', fondos, 4.5, 'enlaces y acentos de texto'],
  ['ok', fondos, 4.5, 'semáforo verde (texto)'],
  ['warn', fondos, 4.5, 'semáforo amarillo (texto)'],
  ['risk', fondos, 4.5, 'semáforo rojo (texto)'],
  ['on-accent', ['accent-deep'], 4.5, 'texto sobre botón de acento'],
  ['accent', ['bg-canvas', 'bg-app', 'bg-panel'], 3, 'borde de foco / elementos gráficos (WCAG 1.4.11)'],
  ['line-strong', ['bg-canvas', 'bg-app', 'bg-panel'], 1.5, 'divisores (decorativos, sin mínimo AA)'],
]

let fallos = 0
for (const [fg, bgs, minimo, descripcion] of pares) {
  for (const bg of bgs) {
    if (!tokens[fg] || !tokens[bg]) {
      console.error(`Falta el token --${!tokens[fg] ? fg : bg}`)
      fallos++
      continue
    }
    const c = contraste(tokens[fg], tokens[bg])
    const ok = c >= minimo
    if (!ok) fallos++
    console.log(
      `${ok ? 'OK   ' : 'FALLA'} ${c.toFixed(2).padStart(5)}:1  (mín ${minimo})  --${fg} sobre --${bg}  · ${descripcion}`,
    )
  }
}
console.log(fallos === 0 ? '\nTodos los pares cumplen.' : `\n${fallos} par(es) no cumplen.`)
process.exit(fallos === 0 ? 0 : 1)
