// Accesibilidad con axe: cero violaciones serias o críticas en cada vista y en cada modal,
// en escritorio (1440×900) y en móvil (390×844).

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { abrirApp, auditarAxe, conEjemplo, esMovil, irAHash, vigilarConsola } from './ayudas'

/** En móvil las opciones secundarias viven en la hoja «Más»; en escritorio, en el ribbon. */
async function abrirDesdeMas(page: Page, info: TestInfo, nombreMovil: string, nombreEscritorio: string) {
  if (esMovil(info)) {
    await page.getByRole('button', { name: 'Más', exact: true }).click()
    await page.getByRole('button', { name: nombreMovil }).click()
  } else {
    // Algunos botones existen también en la barra de pestañas: se usa el del ribbon.
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: nombreEscritorio, exact: true }).click()
  }
}

test.describe('axe · vistas', () => {
  test('bienvenida (sin notas)', async ({ page }) => {
    const consola = vigilarConsola(page)
    await abrirApp(page)
    await auditarAxe(page, 'bienvenida')
    expect(consola).toEqual([])
  })

  test('malla con notas', async ({ page }) => {
    await conEjemplo(page)
    await auditarAxe(page, 'malla')
  })

  test('malla: panel de ajustes del grafo abierto', async ({ page }) => {
    await conEjemplo(page)
    await page.getByRole('button', { name: 'Ajustes del grafo' }).click()
    await auditarAxe(page, 'malla con el panel del grafo')
  })

  test('notas', async ({ page }) => {
    await conEjemplo(page)
    await irAHash(page, '#/notas')
    await expect(page.getByRole('heading', { level: 2, name: 'Tus notas' })).toBeVisible()
    await auditarAxe(page, 'notas')
  })

  test('predicciones', async ({ page }) => {
    await conEjemplo(page)
    await irAHash(page, '#/predicciones')
    await expect(page.getByRole('heading', { level: 2, name: 'Próximo semestre' })).toBeVisible()
    await auditarAxe(page, 'predicciones')
  })

  test('laboratorio de grafos', async ({ page }) => {
    await conEjemplo(page)
    await irAHash(page, '#/laboratorio')
    await expect(page.getByRole('heading', { level: 1, name: /Laboratorio/ })).toBeVisible()
    await auditarAxe(page, 'laboratorio')
  })

  test('modelo', async ({ page }) => {
    await conEjemplo(page)
    await irAHash(page, '#/modelo')
    await expect(page.getByRole('heading', { name: 'Cómo piensa Gradly' })).toBeVisible()
    await auditarAxe(page, 'modelo')
  })

  test('página de materia', async ({ page }) => {
    await conEjemplo(page)
    await irAHash(page, '#/materia/MAT4011')
    await expect(page.getByRole('heading', { level: 1, name: 'Ecuaciones Diferenciales' })).toBeVisible()
    await auditarAxe(page, 'materia')
  })
})

test.describe('axe · paneles y modales', () => {
  test('inspector o detalle: pestañas Detalle, Simulador y Análisis', async ({ page }, info) => {
    await conEjemplo(page)
    if (esMovil(info)) {
      await page.getByRole('button', { name: 'Lista', exact: true }).click()
      await page.getByRole('treeitem', { name: /Ecuaciones Diferenciales/ }).click()
    } else {
      await page.getByRole('treeitem', { name: /Ecuaciones Diferenciales/ }).click()
    }
    for (const tab of ['Detalle', 'Simulador', 'Análisis']) {
      await page.getByRole('tab', { name: tab }).click()
      await auditarAxe(page, `inspector · ${tab}`)
    }
  })

  test('ayuda y atajos', async ({ page }, info) => {
    await conEjemplo(page)
    await abrirDesdeMas(page, info, 'Ayuda y glosario', 'Ayuda y atajos')
    await expect(page.getByRole('dialog')).toBeVisible()
    await auditarAxe(page, 'diálogo de ayuda')
  })

  test('ajustes y privacidad', async ({ page }, info) => {
    await conEjemplo(page)
    await abrirDesdeMas(page, info, 'Ajustes y privacidad', 'Ajustes')
    await expect(page.getByRole('dialog')).toBeVisible()
    await auditarAxe(page, 'diálogo de ajustes')
  })

  test('paleta de comandos', async ({ page }, info) => {
    await conEjemplo(page)
    await abrirDesdeMas(page, info, 'Buscar y acciones', 'Paleta de comandos')
    await expect(page.getByRole('dialog')).toBeVisible()
    await auditarAxe(page, 'paleta de comandos')
  })

  test('pegar texto', async ({ page }) => {
    await abrirApp(page)
    await page.getByRole('button', { name: /Pegar texto/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await auditarAxe(page, 'diálogo de pegar texto')
  })

  test('confirmación de borrar todo', async ({ page }) => {
    await conEjemplo(page)
    await irAHash(page, '#/notas')
    await page.getByRole('button', { name: 'Borrar todo' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await auditarAxe(page, 'confirmación de borrado')
  })

  test('recorrido guiado', async ({ page }) => {
    await abrirApp(page)
    await page.getByRole('button', { name: /Ver con notas de ejemplo/ }).first().click()
    await expect(page.getByRole('dialog', { name: 'Recorrido guiado' })).toBeVisible()
    await auditarAxe(page, 'recorrido guiado')
  })

  test('hoja «Más» (solo móvil)', async ({ page }, info) => {
    test.skip(!esMovil(info), 'La hoja «Más» solo existe en móvil')
    await conEjemplo(page)
    await page.getByRole('button', { name: 'Más', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Más opciones' })).toBeVisible()
    await auditarAxe(page, 'hoja Más')
  })
})

