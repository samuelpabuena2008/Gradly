// Flujos de error de la importación: la app nunca se rompe, explica qué pasó y sigue usable.

import { expect, test, type Page } from '@playwright/test'
import { abrirApp, cargarEjemplo, omitirRecorrido, vigilarConsola } from './ayudas'

const CSV_ENTRADA = 'Elegir un archivo CSV'
const PDF_ENTRADA = 'Elegir el certificado de notas en PDF'

async function subir(page: Page, entrada: string, nombre: string, contenido: string | Buffer, mimeType: string) {
  await page.getByLabel(entrada).setInputFiles({ name: nombre, mimeType, buffer: Buffer.from(contenido) })
}

/** Cierra el diálogo de error y comprueba que la app sigue usable cargando el ejemplo. */
async function seguirUsable(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await cargarEjemplo(page)
  await expect(page.getByRole('contentinfo', { name: 'Estado' }).getByText('15 notas')).toBeVisible()
}

test.describe('importación con errores', () => {
  test('un archivo que no es PDF ni CSV: mensaje accionable y la app sigue usable', async ({ page }) => {
    const consola = vigilarConsola(page)
    await abrirApp(page)
    await subir(page, CSV_ENTRADA, 'foto.png', 'no importa', 'image/png')

    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('heading', { name: 'No podemos leer este archivo' })).toBeVisible()
    await expect(dialogo).toContainText('«foto.png» no es ninguno de los dos')
    await expect(dialogo).toContainText('usa la plantilla CSV')

    await seguirUsable(page)
    expect(consola).toEqual([])
  })

  test('un PDF corrupto: dice que está dañado y qué hacer', async ({ page }) => {
    const consola = vigilarConsola(page)
    await abrirApp(page)
    await subir(page, PDF_ENTRADA, 'certificado.pdf', 'esto no es un pdf, solo texto plano', 'application/pdf')

    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('heading', { name: /PDF/ })).toBeVisible({ timeout: 15_000 })
    await expect(dialogo).toContainText(/Descárgalo de nuevo|Descarga el certificado otra vez/)
    expect(await dialogo.textContent()).not.toMatch(/undefined|NaN|\[object/)

    await seguirUsable(page)
    expect(consola).toEqual([])
  })

  test('un archivo de más de 10 MB se rechaza con su tamaño', async ({ page }) => {
    await abrirApp(page)
    await subir(page, CSV_ENTRADA, 'enorme.csv', Buffer.alloc(11 * 1024 * 1024, 'a'), 'text/csv')
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toContainText('«enorme.csv» pesa 11.0 MB y el límite es 10.0 MB')
    await seguirUsable(page)
  })

  test('un CSV con la cabecera mala explica qué columnas faltan', async ({ page }) => {
    await abrirApp(page)
    await subir(page, CSV_ENTRADA, 'mal.csv', 'asignatura;semestre;resultado\nAlgebra;2024-1;4.0\n', 'text/csv')
    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('heading', { name: 'No encontramos notas en este archivo' })).toBeVisible()
    await expect(dialogo).toContainText(/materia/)
    await seguirUsable(page)
  })

  test('volver a elegir el mismo archivo funciona (el input se reinicia)', async ({ page }) => {
    await abrirApp(page)
    for (let i = 0; i < 2; i++) {
      await subir(page, CSV_ENTRADA, 'foto.png', 'x', 'image/png')
      await expect(page.getByRole('dialog').getByRole('heading', { name: 'No podemos leer este archivo' })).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Entendido' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })

  test('filas inválidas se avisan una a una; solo las buenas entran, y con 1–2 notas se avisa la incertidumbre', async ({ page }) => {
    await abrirApp(page)
    const csv = ['materia,periodo,nota', 'MAT1031,2024-1,4.5', 'XXX9999,2024-1,3.0', 'MAT1101,2024-1,abc', 'IST2088,2024-1,5.1'].join('\r\n')
    await subir(page, CSV_ENTRADA, 'mezcla.csv', '﻿' + csv, 'text/csv') // con BOM y CRLF

    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('button', { name: 'Confirmar y ver mi malla' })).toBeEnabled()
    // Cada fila problemática queda señalada (código desconocido, nota ilegible y nota fuera de rango).
    await expect(dialogo.locator('[aria-invalid="true"]').first()).toBeVisible()
    await dialogo.getByRole('button', { name: 'Confirmar y ver mi malla' }).click()

    const barra = page.getByRole('contentinfo', { name: 'Estado' })
    await expect(barra.getByText('1 nota', { exact: true })).toBeVisible()
    await omitirRecorrido(page)

    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Predicciones' }).click()
    await expect(page.getByText(/Con pocas notas la estimación es más incierta/)).toBeVisible()
    expect(await page.locator('body').textContent()).not.toMatch(/NaN|undefined|Infinity/)
  })

  test('arrastrar y soltar un archivo muestra el aviso y lo lee', async ({ page }) => {
    await abrirApp(page)
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer()
      dt.items.add(new File(['materia,periodo,nota\nMAT1031,2024-1,4.5\n'], 'soltado.csv', { type: 'text/csv' }))
      return dt
    })
    await page.dispatchEvent('body', 'dragenter', { dataTransfer })
    await expect(page.getByText('Suelta tu certificado aquí')).toBeVisible()
    await page.dispatchEvent('body', 'drop', { dataTransfer })
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Confirmar y ver mi malla' })).toBeVisible()
  })
})
