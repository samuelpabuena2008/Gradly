// Móvil (390×844, táctil): barra inferior, hoja de detalle, lista de materias, objetivos de 44 px
// y ninguna vista con scroll horizontal de página (tampoco al 200 % de zoom).

import { expect, test, type Page } from '@playwright/test'
import { abrirApp, irAHash, omitirRecorrido, vigilarConsola } from './ayudas'

const sinScrollHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)

/** Controles visibles que miden menos de 44 px (los íconos informativos amplían su zona de toque con ::after). */
const controlesPequenos = (page: Page) =>
  page.evaluate(() => {
    const SEL = 'button, a[href], [role="tab"], [role="treeitem"], input:not([type="hidden"]), select, textarea, summary'
    const salida: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(SEL)) {
      // La atribución de React Flow es un enlace de licencia de la biblioteca, no un control de la app.
      if (el.closest('[inert], .solo-lectores, svg, .react-flow__attribution') || el.matches('.kpi-info, .modelo-info')) continue
      const caja = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest('label') ?? el) : el
      const r = caja.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue
      if (el.tagName === 'A' && el.closest('p, li') && cs.display === 'inline') continue
      if (r.width < 43.5 || r.height < 43.5) {
        salida.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.className?.toString().split(' ')[0] ?? ''} «${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}»`)
      }
    }
    return salida
  })

test('flujo táctil: ejemplo → lista → hoja de detalle → página de la materia → Más → Modelo', async ({ page }) => {
  const consola = vigilarConsola(page)
  await abrirApp(page)

  // Móvil no usa el ribbon lateral: la navegación es una barra inferior.
  await expect(page.locator('.ribbon')).toHaveCount(0)
  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  await expect(nav.getByRole('button', { name: 'Malla' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Notas' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Predicciones' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Más' })).toBeVisible()
  expect(await sinScrollHorizontal(page)).toBe(true)

  await page.getByRole('button', { name: /Ver con notas de ejemplo/ }).first().tap()
  await expect(page.getByText(/Cargué \d+ notas de ejemplo/)).toBeVisible()
  await omitirRecorrido(page)

  // El grafo táctil es incómodo: se ofrece la lista por semestre.
  await page.getByRole('button', { name: 'Lista', exact: true }).tap()
  const fila = page.getByRole('treeitem', { name: /Ecuaciones Diferenciales/ })
  await expect(fila).toBeVisible()

  // Tocar una materia abre la hoja inferior con su detalle (y la deja a la vista sobre la hoja).
  await fila.tap()
  const hoja = page.getByRole('dialog', { name: 'Inspector' })
  await expect(hoja).toBeVisible()
  await expect(hoja.getByRole('heading', { name: 'Ecuaciones Diferenciales' })).toBeVisible()
  await expect(hoja.getByText('Es una estimación, no una sentencia.')).toBeVisible()
  await expect(fila).toBeInViewport()
  const cajaFila = (await fila.boundingBox())!
  const cajaHoja = (await hoja.boundingBox())!
  expect(cajaFila.y + cajaFila.height).toBeLessThanOrEqual(cajaHoja.y + 1) // la fila elegida no queda tapada

  // Deslizar el asa hacia abajo cierra la hoja; un arrastre corto no.
  const asa = page.locator('.cajon-asa')
  let b = (await asa.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 12, { steps: 3 })
  await page.mouse.up()
  await expect(hoja).toBeVisible()
  b = (await asa.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 200, { steps: 8 })
  await page.mouse.up()
  await expect(hoja).toHaveCount(0)

  // De nuevo abierta, «Abrir página» cierra la hoja y muestra la página completa de la materia.
  await fila.tap()
  await hoja.getByRole('button', { name: 'Abrir página de la materia' }).tap()
  await expect(page).toHaveURL(/#\/materia\/MAT4011$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Ecuaciones Diferenciales' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Inspector' })).toHaveCount(0)
  expect(await sinScrollHorizontal(page)).toBe(true)

  // «Más» abre una hoja; elegir el modelo la cierra y navega.
  await nav.getByRole('button', { name: 'Más' }).tap()
  await page.getByRole('dialog', { name: 'Más opciones' }).getByRole('button', { name: /Cómo piensa Gradly/ }).tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo piensa Gradly' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'Más' })).toHaveAttribute('aria-expanded', 'false')

  expect(consola).toEqual([])
})

test('ninguna vista tiene scroll horizontal y todos los controles miden 44 px o más', async ({ page }) => {
  await abrirApp(page)
  await page.getByRole('button', { name: /Ver con notas de ejemplo/ }).first().tap()
  await omitirRecorrido(page)

  const vistas: { nombre: string; preparar: () => Promise<void> }[] = [
    { nombre: 'malla (grafo)', preparar: async () => irAHash(page, '#/malla') },
    {
      nombre: 'malla (lista)',
      preparar: async () => {
        await irAHash(page, '#/malla')
        await page.getByRole('button', { name: 'Lista', exact: true }).tap()
      },
    },
    { nombre: 'notas', preparar: async () => irAHash(page, '#/notas') },
    { nombre: 'predicciones', preparar: async () => irAHash(page, '#/predicciones') },
    { nombre: 'laboratorio', preparar: async () => irAHash(page, '#/laboratorio') },
    { nombre: 'modelo', preparar: async () => irAHash(page, '#/modelo') },
    { nombre: 'materia', preparar: async () => irAHash(page, '#/materia/MAT4011') },
  ]
  for (const v of vistas) {
    await v.preparar()
    await page.waitForTimeout(500)
    expect(await sinScrollHorizontal(page), `scroll horizontal en «${v.nombre}»`).toBe(true)
    expect(await controlesPequenos(page), `controles < 44 px en «${v.nombre}»`).toEqual([])
  }
})

test('al 200 % de zoom (viewport de 640 px) el layout sigue intacto', async ({ page }) => {
  // 200 % de zoom sobre una ventana de 1280 px equivale a 640 px de ancho CSS.
  await page.setViewportSize({ width: 640, height: 400 })
  await abrirApp(page)
  await page.getByRole('button', { name: /Ver con notas de ejemplo/ }).first().tap()
  await omitirRecorrido(page)
  for (const hash of ['#/malla', '#/notas', '#/predicciones', '#/modelo', '#/laboratorio']) {
    await irAHash(page, hash)
    await page.waitForTimeout(400)
    expect(await sinScrollHorizontal(page), `scroll horizontal en ${hash} al 200 %`).toBe(true)
  }
  // La barra inferior sigue alcanzable.
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Más' })).toBeVisible()
})
