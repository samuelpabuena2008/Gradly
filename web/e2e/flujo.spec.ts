// Flujo completo en escritorio: primera carga → splash → bienvenida → notas de ejemplo → nodos coloreados →
// clic en un nodo → pestaña de materia → alternar modelo → simular → restaurar → exportar CSV → borrar con deshacer.

import { expect, test } from '@playwright/test'
import { abrirApp, cargarEjemplo, omitirRecorrido, vigilarConsola } from './ayudas'

test('de la primera carga a borrar con deshacer', async ({ page }) => {
  const consola = vigilarConsola(page)

  // 1. Primera carga: el splash es real y deja paso a la bienvenida.
  await page.goto('/', { waitUntil: 'commit' })
  await expect(page.locator('#splash-inicial, .splash').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /Mira tu carrera como un grafo/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.splash')).toHaveCount(0)

  // 2. Sin notas: la barra de estado dice la verdad y la privacidad se ve de frente.
  const barra = page.getByRole('contentinfo', { name: 'Estado' })
  await expect(barra.getByText('0 notas')).toBeVisible()
  await expect(barra.getByText('Tus notas no salen de este navegador')).toBeVisible()

  // 3. Notas de ejemplo: los nodos se colorean (aprobadas y semáforo).
  await cargarEjemplo(page)
  await omitirRecorrido(page)
  await expect(barra.getByText('15 notas')).toBeVisible()
  await expect(page.locator('.nodo-aprobada').first()).toBeVisible()
  await expect(page.locator('.nodo-verde').first()).toBeVisible()
  await expect(page.locator('.nodo-amarillo').first()).toBeVisible()
  await expect(page.locator('.nodo-rojo').first()).toBeVisible()
  const promedioReal = (await barra.getByText(/^Promedio/).textContent())?.trim()
  expect(promedioReal).toMatch(/Promedio\s*\d\.\d{2}/)

  // 4. Clic en un nodo: se selecciona y el inspector muestra su detalle y su predicción.
  const nodo = page.locator('.react-flow__node[data-id="MAT4011"]')
  await nodo.locator('.nodo-figura').click()
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(inspector.getByRole('heading', { name: 'Ecuaciones Diferenciales' })).toBeVisible()
  await expect(inspector.getByText('Nota esperada')).toBeVisible()
  await expect(inspector.getByText('Es una estimación, no una sentencia.')).toBeVisible()

  // 5. Doble clic: se abre su pestaña, con su propia URL profunda.
  await nodo.locator('.nodo-figura').dblclick()
  await expect(page).toHaveURL(/#\/materia\/MAT4011$/)
  await expect(page.getByRole('tab', { name: /Ecuaciones Diferenciales/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { level: 1, name: 'Ecuaciones Diferenciales' })).toBeVisible()
  expect(page.url()).not.toMatch(/nota|4\.0|3\.1/i) // nunca hay notas en la URL

  // 6. Alternar el modelo: Predicciones ofrece Regresión y Red neuronal.
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Predicciones' }).click()
  await expect(page.getByRole('radio', { name: /Regresión/ })).toBeChecked()
  await page.getByRole('radio', { name: /Red neuronal/ }).check()
  await expect(page.getByRole('radio', { name: /Red neuronal/ })).toBeChecked()
  await expect(barra.getByRole('button', { name: /Modelo activo: Red neuronal/ })).toBeVisible()
  await page.getByRole('radio', { name: /Regresión/ }).check()
  await expect(barra.getByRole('button', { name: /Modelo activo: Regresión/ })).toBeVisible()

  // 7. Simular: cambiar una nota de un escenario no toca las notas reales y se puede restaurar.
  await page.getByRole('tab', { name: 'Simulador' }).click()
  const campo = page.getByRole('textbox', { name: 'Nota simulada de Competencias Comunicativas I', exact: true })
  await campo.fill('1,5')
  await campo.press('Enter')
  const banner = page.getByRole('region', { name: 'Escenario hipotético' })
  await expect(banner).toBeVisible()
  await expect(banner.getByText('Estás viendo un escenario hipotético')).toBeVisible()
  await expect(barra.getByText('Escenario hipotético')).toBeVisible()
  const promedioSimulado = (await barra.getByText(/^Promedio/).textContent())?.trim()
  expect(promedioSimulado).not.toBe(promedioReal)

  // 8. Restaurar: todo vuelve a lo real, y las notas importadas nunca se perdieron.
  await banner.getByRole('button', { name: 'Restaurar' }).click()
  await expect(banner).toHaveCount(0)
  await expect(barra.getByText(/^Promedio/)).toHaveText(promedioReal!)
  await expect(barra.getByText('15 notas')).toBeVisible()

  // 9. Exportar CSV: descarga local con el formato de la plantilla.
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Notas', exact: true }).click()
  const descarga = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toBe('gradly-notas.csv')
  const stream = await archivo.createReadStream()
  const trozos: Buffer[] = []
  for await (const t of stream) trozos.push(t as Buffer)
  const lineas = Buffer.concat(trozos).toString('utf8').trim().split('\n')
  expect(lineas[0]).toBe('materia,periodo,nota')
  expect(lineas).toHaveLength(16)

  // 10. Borrar todo: pide confirmación y se puede deshacer.
  await page.getByRole('button', { name: 'Borrar todo' }).click()
  const confirmar = page.getByRole('alertdialog')
  await expect(confirmar.getByText('¿Borrar todas tus notas?')).toBeVisible()
  await confirmar.getByRole('button', { name: 'Borrar notas' }).click()
  await expect(barra.getByText('0 notas')).toBeVisible()
  await expect(page.getByText('Tus notas se borraron.')).toBeVisible()
  // Pueden convivir avisos anteriores con su propio «Deshacer»: se usa el del aviso de borrado.
  await page.locator('.toast', { hasText: 'Tus notas se borraron.' }).getByRole('button', { name: 'Deshacer' }).click()
  await expect(barra.getByText('15 notas')).toBeVisible()

  expect(consola).toEqual([])
})

test('las notas no salen del navegador: ninguna petición lleva datos a un servidor', async ({ page, baseURL }) => {
  const externas: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    const propia = url.origin === new URL(baseURL!).origin || url.protocol === 'data:' || url.protocol === 'blob:'
    if (!propia) externas.push(r.url())
  })
  await abrirApp(page)
  await cargarEjemplo(page)
  await omitirRecorrido(page)
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Predicciones' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Próximo semestre' })).toBeVisible()
  expect(externas).toEqual([])
})

test('las preferencias del navegador son opcionales: con localStorage bloqueado la app funciona', async ({ page }) => {
  await page.addInitScript(() => {
    const falla = () => {
      throw new DOMException('bloqueado', 'SecurityError')
    }
    Object.defineProperty(window, 'localStorage', { get: falla })
  })
  const consola = vigilarConsola(page)
  await abrirApp(page)
  await cargarEjemplo(page)
  await expect(page.getByRole('contentinfo', { name: 'Estado' }).getByText('15 notas')).toBeVisible()
  expect(consola.filter((c) => !/localStorage|bloqueado/i.test(c))).toEqual([])
})
