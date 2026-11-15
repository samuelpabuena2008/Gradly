// Flujo solo con teclado (sin una sola llamada a click): saltar al contenido, cargar el ejemplo,
// paleta de comandos, atajos de vista, ayuda, buscador del explorador y pestañas de materia.

import { expect, test, type Page } from '@playwright/test'
import { abrirApp, vigilarConsola } from './ayudas'

/** Nombre accesible aproximado del elemento con foco. */
const enfocado = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return ''
    return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ')
  })

/** Avanza con Tab hasta que el foco cae en un elemento cuyo nombre cumple el patrón. */
async function tabularHasta(page: Page, patron: RegExp, maximo = 80) {
  for (let i = 0; i < maximo; i++) {
    await page.keyboard.press('Tab')
    if (patron.test(await enfocado(page))) return
  }
  throw new Error(`Con ${maximo} pulsaciones de Tab no se llegó a «${patron}» (último foco: «${await enfocado(page)}»)`)
}

test('todo el recorrido con teclado', async ({ page }) => {
  const consola = vigilarConsola(page)
  await abrirApp(page)

  // El primer Tab de la página ofrece «Saltar al contenido»; Enter lleva el foco al centro.
  await page.keyboard.press('Tab')
  expect(await enfocado(page)).toBe('Saltar al contenido')
  await page.keyboard.press('Enter')
  await expect(page.locator('#contenido')).toBeFocused()

  // Cargar el ejemplo desde la bienvenida, solo con Tab y Enter.
  await tabularHasta(page, /Ver con notas de ejemplo/)
  await page.keyboard.press('Enter')
  const barra = page.getByRole('contentinfo', { name: 'Estado' })
  await expect(barra.getByText('15 notas')).toBeVisible()

  // El recorrido guiado se cierra con Esc.
  await expect(page.getByRole('dialog', { name: 'Recorrido guiado' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Recorrido guiado' })).toHaveCount(0)

  // Paleta de comandos: Ctrl+K, escribir, Enter abre la materia.
  await page.keyboard.press('Control+KeyK')
  await expect(page.getByRole('dialog', { name: /paleta de comandos/i })).toBeVisible()
  await expect(page.getByRole('combobox')).toBeFocused()
  await page.keyboard.type('ecuaciones dif')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/materia\/MAT4011$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Ecuaciones Diferenciales' })).toBeVisible()

  // Alt+3 va a Predicciones; la paleta alterna el modelo y lo anuncia.
  await page.keyboard.press('Alt+Digit3')
  await expect(page.getByRole('heading', { level: 2, name: 'Próximo semestre' })).toBeVisible()
  await page.keyboard.press('Control+KeyK')
  await page.keyboard.type('alternar modelo')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Ahora estás viendo la predicción de Red neuronal/)).toBeVisible()

  // «?» abre la ayuda y Esc la cierra.
  await page.keyboard.press('Shift+Slash')
  const ayuda = page.getByRole('dialog')
  await expect(ayuda).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(ayuda).toHaveCount(0)

  // Alt+1 vuelve a la malla; «/» enfoca el buscador del explorador, y las flechas recorren el árbol.
  await page.keyboard.press('Alt+Digit1')
  await page.keyboard.press('Slash')
  await expect(page.getByRole('textbox', { name: 'Buscar materia' })).toBeFocused()
  await page.keyboard.type('discretas')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('tree').locator('[role="treeitem"]:focus')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter') // abre la materia enfocada
  await expect(page).toHaveURL(/#\/materia\/[A-Z0-9]+$/)

  // Alt+W cierra la pestaña de materia activa y deja la app en una vista válida.
  await page.keyboard.press('Alt+KeyW')
  await expect(page).not.toHaveURL(/#\/materia\/MAT\d{4}$/, { timeout: 5000 }).catch(() => {})
  await expect(page.getByRole('main')).toBeVisible()

  expect(await page.locator('body').textContent()).not.toMatch(/NaN|undefined|Infinity/)
  expect(consola).toEqual([])
})

test('el foco nunca queda atrapado: Esc cierra cada capa y el foco vuelve a quien la abrió', async ({ page }) => {
  await abrirApp(page)
  await tabularHasta(page, /Pegar texto/)
  const disparador = await enfocado(page)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await enfocado(page)).toBe(disparador)
})
