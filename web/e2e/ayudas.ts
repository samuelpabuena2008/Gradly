// Ayudas compartidas por las pruebas E2E: abrir la app, cargar el ejemplo, omitir el recorrido y auditar con axe.

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'

export const esMovil = (info: TestInfo): boolean => info.project.name === 'movil'

/** Errores de consola y de página acumulados: las pruebas exigen que queden en cero. */
export function vigilarConsola(page: Page): string[] {
  const problemas: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problemas.push(`${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => problemas.push(`excepción: ${e.message}`))
  return problemas
}

/** Abre la app y espera a que termine el arranque (splash real) y aparezca la bienvenida. */
export async function abrirApp(page: Page, ruta = '/'): Promise<void> {
  await page.goto(ruta)
  await expect(page.getByRole('heading', { name: /Mira tu carrera como un grafo/ })).toBeVisible({ timeout: 20_000 })
}

/** Pulsa «Ver con notas de ejemplo» y espera a que la malla muestre las notas. */
export async function cargarEjemplo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Ver con notas de ejemplo/ }).first().click()
  await expect(page.getByText(/Cargué \d+ notas de ejemplo/)).toBeVisible()
}

/** El recorrido guiado se ofrece solo; esta ayuda lo omite si aparece. */
export async function omitirRecorrido(page: Page): Promise<void> {
  const omitir = page.getByRole('button', { name: 'Omitir el recorrido' })
  try {
    await omitir.waitFor({ state: 'visible', timeout: 3000 })
    await omitir.click()
    await omitir.waitFor({ state: 'detached' })
  } catch {
    // no apareció: nada que omitir
  }
}

/** Abre la app, carga el ejemplo y omite el recorrido: punto de partida de casi todos los flujos. */
export async function conEjemplo(page: Page, ruta = '/'): Promise<void> {
  await abrirApp(page, ruta)
  await cargarEjemplo(page)
  await omitirRecorrido(page)
}

/** Navega por hash sin recargar (las vistas viven en `#/…`). */
export async function irAHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
}

/** Auditoría de accesibilidad: cero violaciones serias o críticas (WCAG 2.2 AA). */
export async function auditarAxe(page: Page, contexto: string): Promise<void> {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const detalle = graves
    .map((v) => `[${v.impact}] ${v.id}: ${v.help}\n${v.nodes.slice(0, 3).map((n) => `    ${n.target.join(' ')}\n    ${n.failureSummary?.split('\n').slice(0, 2).join(' | ')}`).join('\n')}`)
    .join('\n')
  // Se compara el texto (no el arreglo) para que el informe de fallos sea corto y legible.
  expect(detalle, `Violaciones de accesibilidad en «${contexto}»`).toBe('')
}
