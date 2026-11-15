// @vitest-environment jsdom
//
// Prueba de «mono» (fuzz de acciones): 600 acciones aleatorias, con semilla fija, sobre el espacio de
// trabajo completo. Después de CADA acción comprueba que:
//   · no hay excepciones no capturadas ni errores/advertencias en consola,
//   · no aparece NaN, undefined, Infinity ni «[object Object]» en el DOM,
//   · ninguna vista cayó en su ErrorBoundary,
//   · `notasReales` solo cambia por acciones explícitas de importación o edición,
//   · las notas y los ajustes siguen siendo válidos (escala 0–5, materias reales).
// Si falla, el mensaje trae la semilla y la secuencia completa de acciones para reproducirlo.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import type { Datos } from '../../lib/ui/arranque'
import { useApp } from '../../store/app'
import { useConfirmacion } from '../../store/confirmacion'
import { useImportacion } from '../../store/importacion'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { abrirMateria, alternarModelo, borrarTodo, cargarEjemplo, cerrarPestana, exportarCsv, irA } from './acciones'
import { Workspace } from './Workspace'
import { parsearHash, VISTAS } from '../../lib/ui/ruta'

const SEMILLA = 0xc0ffee
const N_ACCIONES = 600

/** Generador pseudoaleatorio determinista (mulberry32). */
function aleatorio(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Accion {
  nombre: string
  /** Solo estas acciones pueden cambiar `notasReales`. */
  explicita: boolean
  peso: number
  ejecutar: () => void | Promise<void>
}

let datos: Datos
let consola: string[]
let errores: string[]

beforeEach(async () => {
  reiniciarApp()
  datos = await datosDePrueba()
  consola = []
  errores = []
  vi.spyOn(console, 'error').mockImplementation((...a) => void consola.push(`error: ${a.join(' ')}`))
  vi.spyOn(console, 'warn').mockImplementation((...a) => void consola.push(`warn: ${a.join(' ')}`))
  window.addEventListener('error', (e) => errores.push(`excepción: ${e.message}`))
  // «Exportar CSV» descarga con un <a download>: jsdom no navega, así que se silencia el clic.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const teclado = (init: KeyboardEventInit) => () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

describe('prueba de mono', () => {
  it(
    `${N_ACCIONES} acciones aleatorias (semilla ${SEMILLA.toString(16)}) sin romper nada`,
    { timeout: 240_000 },
    async () => {
      const azar = aleatorio(SEMILLA)
      const entero = (n: number) => Math.floor(azar() * n)
      const elegir = <T,>(xs: readonly T[]): T => xs[entero(xs.length)]
      const ids = datos.malla.materias.map((m) => m.id)
      const periodos = ['2022-1', '2022-2', '2023-1', '2023-2', '2024-1', '2024-2', '2025-1']
      const notaAzar = () => elegir([0, 5, 3, 3.75, 4.5, 2.9, Math.round(azar() * 50) / 10])
      const app = () => useApp.getState()

      render(conProveedores(datos, <Workspace />))

      // --- acciones ---
      const acciones: Accion[] = [
        // Explícitas: son las únicas que pueden tocar las notas reales.
        { nombre: 'importar notas de ejemplo', explicita: true, peso: 3, ejecutar: () => cargarEjemplo(datos) },
        { nombre: 'borrar todas las notas', explicita: true, peso: 1, ejecutar: () => app().borrarNotas() },
        { nombre: 'pedir borrar todo y confirmar', explicita: true, peso: 1, ejecutar: () => { borrarTodo(); useConfirmacion.getState().pendiente?.alConfirmar() ; useConfirmacion.getState().cerrar() } },
        { nombre: 'agregar una nota', explicita: true, peso: 5, ejecutar: () => void app().agregarNota({ materia: elegir(ids), periodo: elegir(periodos), nota: notaAzar() }) },
        { nombre: 'combinar notas', explicita: true, peso: 1, ejecutar: () => app().combinarNotas([{ materia: elegir(ids), periodo: elegir(periodos), nota: notaAzar() }]) },
        { nombre: 'reemplazar notas', explicita: true, peso: 1, ejecutar: () => app().reemplazarNotas([{ materia: elegir(ids), periodo: elegir(periodos), nota: notaAzar() }]) },
        {
          nombre: 'editar una nota',
          explicita: true,
          peso: 2,
          ejecutar: () => {
            const n = app().notasReales[0]
            if (n) app().editarNota(n.materia, n.periodo, notaAzar())
          },
        },
        {
          nombre: 'quitar una nota',
          explicita: true,
          peso: 2,
          ejecutar: () => {
            const n = elegir(app().notasReales.length ? app().notasReales : [{ materia: ids[0], periodo: periodos[0], nota: 3 }])
            app().quitarNota(n.materia, n.periodo)
          },
        },

        // Simulador
        { nombre: 'simular una nota', explicita: false, peso: 8, ejecutar: () => app().fijarAjuste(elegir(ids), Math.round(azar() * 50) / 10) },
        { nombre: 'quitar un ajuste', explicita: false, peso: 2, ejecutar: () => app().quitarAjuste(elegir(ids)) },
        { nombre: 'restaurar el escenario', explicita: false, peso: 2, ejecutar: () => app().restaurarAjustes() },

        // Modelo
        { nombre: 'elegir un modelo', explicita: false, peso: 3, ejecutar: () => app().elegirModelo(elegir(['regresion', 'red'] as const)) },
        { nombre: 'alternar el modelo', explicita: false, peso: 2, ejecutar: () => alternarModelo(datos, app().tipoModelo ?? 'regresion') },

        // Pestañas y navegación
        { nombre: 'abrir una pestaña de materia', explicita: false, peso: 8, ejecutar: () => abrirMateria(elegir(ids)) },
        {
          nombre: 'cerrar una pestaña de materia',
          explicita: false,
          peso: 4,
          ejecutar: () => {
            const id = app().pestanas[0]
            if (id) cerrarPestana(id, parsearHash(window.location.hash))
          },
        },
        { nombre: 'ir a una vista', explicita: false, peso: 8, ejecutar: () => irA({ tipo: 'vista', vista: elegir(VISTAS) }) },
        {
          nombre: 'hash raro o inválido',
          explicita: false,
          peso: 3,
          ejecutar: () => {
            window.location.hash = elegir(['#/zzz', '#/materia/ZZZ0000', '#/materia/%E0%A4%A', '#', '#/materia/', '#//malla', '#/Malla'])
            window.dispatchEvent(new HashChangeEvent('hashchange'))
          },
        },
        { nombre: 'seleccionar una materia', explicita: false, peso: 5, ejecutar: () => app().seleccionar(azar() < 0.15 ? null : elegir(ids)) },

        // Paneles
        { nombre: 'redimensionar el explorador', explicita: false, peso: 3, ejecutar: () => app().fijarAnchoExplorador(elegir([0, 100, 280, 480, 5000, NaN, Infinity, -50, 300.7])) },
        { nombre: 'redimensionar el inspector', explicita: false, peso: 3, ejecutar: () => app().fijarAnchoInspector(elegir([0, 100, 360, 560, 5000, NaN, Infinity, -50, 410.2])) },
        { nombre: 'mostrar/ocultar el explorador', explicita: false, peso: 3, ejecutar: () => app().alternarExplorador() },
        { nombre: 'mostrar/ocultar el inspector', explicita: false, peso: 3, ejecutar: () => app().alternarInspector() },
        { nombre: 'cambiar pestaña del inspector', explicita: false, peso: 4, ejecutar: () => app().elegirTabInspector(elegir(['detalle', 'simulador', 'analisis'] as const)) },
        { nombre: 'modo lista/grafo', explicita: false, peso: 1, ejecutar: () => app().elegirModoMalla(elegir(['grafo', 'lista'] as const)) },
        { nombre: 'recorrido guiado', explicita: false, peso: 1, ejecutar: () => app().abrirRecorrido(azar() < 0.5) },
        { nombre: 'explorar sin notas (descartar bienvenida)', explicita: false, peso: 1, ejecutar: () => app().descartarBienvenida() },
        { nombre: 'activar/desactivar guardar notas', explicita: false, peso: 1, ejecutar: () => app().fijarPersistirNotas(azar() < 0.5) },
        { nombre: 'exportar CSV', explicita: false, peso: 1, ejecutar: () => { URL.createObjectURL = () => 'blob:prueba'; URL.revokeObjectURL = () => {}; exportarCsv() } },
        { nombre: 'pegar texto (abrir/cerrar)', explicita: false, peso: 1, ejecutar: () => useImportacion.getState().abrirPegar(azar() < 0.5) },

        // Paleta y atajos
        { nombre: 'abrir/cerrar la paleta', explicita: false, peso: 4, ejecutar: () => app().abrirPaleta(azar() < 0.5) },
        { nombre: 'abrir/cerrar la ayuda', explicita: false, peso: 2, ejecutar: () => app().abrirAtajos(azar() < 0.5) },
        { nombre: 'atajo Ctrl+K', explicita: false, peso: 2, ejecutar: teclado({ code: 'KeyK', key: 'k', ctrlKey: true }) },
        { nombre: 'atajo Ctrl+B', explicita: false, peso: 2, ejecutar: teclado({ code: 'KeyB', key: 'b', ctrlKey: true }) },
        { nombre: 'atajo Ctrl+Alt+B', explicita: false, peso: 2, ejecutar: teclado({ code: 'KeyB', key: 'b', ctrlKey: true, altKey: true }) },
        { nombre: 'atajo Alt+1..5', explicita: false, peso: 4, ejecutar: () => teclado({ code: `Digit${1 + entero(5)}`, key: String(1 + entero(5)), altKey: true })() },
        { nombre: 'atajo Alt+W', explicita: false, peso: 2, ejecutar: teclado({ code: 'KeyW', key: 'w', altKey: true }) },
        { nombre: 'atajo ?', explicita: false, peso: 1, ejecutar: teclado({ code: 'Slash', key: '?', shiftKey: true }) },
        { nombre: 'atajo /', explicita: false, peso: 1, ejecutar: teclado({ code: 'Slash', key: '/' }) },
        { nombre: 'tecla Escape', explicita: false, peso: 4, ejecutar: teclado({ code: 'Escape', key: 'Escape' }) },
        { nombre: 'tecla F (ajustar grafo)', explicita: false, peso: 1, ejecutar: teclado({ code: 'KeyF', key: 'f' }) },

        // Clics reales sobre botones visibles de la interfaz (ribbon, pestañas, inspector, chips, barra de estado).
        {
          nombre: 'clic en un botón de la interfaz',
          explicita: false,
          peso: 10,
          ejecutar: () => {
            const botones = [
              ...document.querySelectorAll<HTMLButtonElement>(
                '.ribbon button, .tabbar button, .insp-tab, .exp-chip, .statusbar button, .malla-modo button, .nav-inferior button',
              ),
            ].filter((b) => !b.disabled)
            if (botones.length) botones[entero(botones.length)].click()
          },
        },
      ]

      // La confirmación de borrado puede quedar pendiente: se cancela como si el usuario dijera «Cancelar».
      const total = acciones.reduce((s, a) => s + a.peso, 0)
      const sortear = (): Accion => {
        let r = azar() * total
        for (const a of acciones) if ((r -= a.peso) < 0) return a
        return acciones[0]
      }

      const registro: string[] = []
      // Estadísticas para comprobar que el mono realmente recorrió el espacio de estados.
      const vistasVistas = new Set<string>()
      const modelosVistos = new Set<string>()
      let maxNotas = 0
      let maxAjustes = 0
      let maxPestanas = 0
      let explicitasQueCambiaron = 0
      const fallar = (n: number, motivo: string): never => {
        throw new Error(`${motivo}\n  semilla: ${SEMILLA.toString(16)} · acción n.º ${n}\n  secuencia:\n${registro.map((r, i) => `    ${i + 1}. ${r}`).join('\n')}`)
      }

      for (let n = 1; n <= N_ACCIONES; n++) {
        const accion = sortear()
        registro.push(accion.nombre)
        const antes = JSON.stringify(app().notasReales)

        try {
          await act(async () => {
            await accion.ejecutar()
            await new Promise((r) => setTimeout(r, 0)) // deja correr los setTimeout(…, 0) de la paleta
          })
        } catch (e) {
          fallar(n, `La acción «${accion.nombre}» lanzó una excepción: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
        }

        // Una confirmación pendiente y no resuelta se cancela, como al pulsar «Cancelar».
        if (useConfirmacion.getState().pendiente) await act(async () => useConfirmacion.getState().cerrar())

        // 1. Consola limpia y sin excepciones no capturadas.
        if (consola.length) fallar(n, `Hubo salida de consola tras «${accion.nombre}»:\n${consola.slice(0, 3).join('\n')}`)
        if (errores.length) fallar(n, `Excepción no capturada tras «${accion.nombre}»: ${errores[0]}`)

        // 2. Nada de basura en el DOM y ninguna vista caída.
        const texto = document.body.textContent ?? ''
        const basura = texto.match(/NaN|undefined|Infinity|\[object Object\]/)
        if (basura) fallar(n, `Apareció «${basura[0]}» en el DOM tras «${accion.nombre}»`)
        if (texto.includes('No pudimos mostrar')) fallar(n, `Una vista cayó en su ErrorBoundary tras «${accion.nombre}»`)

        // 3. Las notas reales solo cambian por acciones explícitas.
        const despues = JSON.stringify(app().notasReales)
        if (!accion.explicita && despues !== antes) fallar(n, `«${accion.nombre}» cambió las notas reales, y no es una acción explícita`)

        if (accion.explicita && despues !== antes) explicitasQueCambiaron++
        const ruta = parsearHash(window.location.hash)
        vistasVistas.add(ruta.tipo === 'vista' ? ruta.vista : 'materia')
        modelosVistos.add(app().tipoModelo ?? 'recomendado')
        maxNotas = Math.max(maxNotas, app().notasReales.length)
        maxAjustes = Math.max(maxAjustes, Object.keys(app().ajustes).length)
        maxPestanas = Math.max(maxPestanas, app().pestanas.length)

        // 4. Datos siempre válidos: notas en 0–5 con materias reales; ajustes también.
        for (const nota of app().notasReales) {
          if (!ids.includes(nota.materia) || !Number.isFinite(nota.nota) || nota.nota < 0 || nota.nota > 5) {
            fallar(n, `Nota inválida en el store tras «${accion.nombre}»: ${JSON.stringify(nota)}`)
          }
        }
        for (const [id, v] of Object.entries(app().ajustes)) {
          if (!ids.includes(id) || !Number.isFinite(v) || v < 0 || v > 5) fallar(n, `Ajuste inválido tras «${accion.nombre}»: ${id}=${v}`)
        }
        // Los anchos de panel siempre quedan dentro de sus límites.
        const { anchoExplorador, anchoInspector } = app()
        if (!(anchoExplorador >= 220 && anchoExplorador <= 480)) fallar(n, `Ancho de explorador fuera de límites: ${anchoExplorador}`)
        if (!(anchoInspector >= 300 && anchoInspector <= 560)) fallar(n, `Ancho de inspector fuera de límites: ${anchoInspector}`)
        // Máximo 8 pestañas de materia.
        if (app().pestanas.length > 8) fallar(n, `Hay ${app().pestanas.length} pestañas de materia (máximo 8)`)
      }

      // La secuencia realmente ejercitó variedad: no es una prueba trivial.
      const distintas = new Set(registro)
      expect(registro).toHaveLength(N_ACCIONES)
      expect(distintas.size).toBeGreaterThan(25)
      const resumen = JSON.stringify({ distintas: distintas.size, vistas: [...vistasVistas].sort(), maxNotas, maxAjustes, maxPestanas, modelos: [...modelosVistos], explicitasQueCambiaron })
      // El mono debe haber recorrido el espacio de estados de verdad (si no, «sin romper nada» no probaría nada).
      expect(vistasVistas.size, `vistas visitadas: ${resumen}`).toBeGreaterThanOrEqual(6) // 5 vistas + páginas de materia
      expect(maxNotas, `notas cargadas a la vez: ${resumen}`).toBeGreaterThanOrEqual(10)
      expect(maxAjustes, `ajustes simultáneos: ${resumen}`).toBeGreaterThanOrEqual(3)
      expect(maxPestanas, `pestañas de materia abiertas: ${resumen}`).toBeGreaterThanOrEqual(4)
      expect(modelosVistos.size, `modelos usados: ${resumen}`).toBeGreaterThanOrEqual(2)
      expect(explicitasQueCambiaron, `acciones explícitas con efecto: ${resumen}`).toBeGreaterThanOrEqual(20)
    },
  )
})
