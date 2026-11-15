// Acciones de la aplicación que comparten la paleta de comandos, los botones y los atajos.
// Las notas nunca salen del navegador; borrar y reemplazar siempre se pueden deshacer.

import type { Datos } from '../../lib/ui/arranque'
import { parsearNotasCsv } from '../../lib/import/csv'
import { descargarTexto, notasACsv } from '../../lib/ui/exportar'
import { otroModelo, tieneRed, NOMBRE_MODELO } from '../../lib/ui/modelos'
import { siguienteTrasCerrar } from '../../lib/ui/pestanas'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { useConfirmacion } from '../../store/confirmacion'
import { navegar } from '../../store/ruta'
import { avisar } from '../../store/toasts'
import plantilla from '../../../../data/plantilla_notas.csv?raw'

const DURACION_DESHACER = 10_000

export function irA(ruta: Ruta): void {
  navegar(ruta)
}

/** Abre la página de la materia en una pestaña y la deja seleccionada en todos los paneles. */
export function abrirMateria(id: string): void {
  useApp.getState().abrirMateria(id)
  navegar({ tipo: 'materia', id })
}

/** Cierra una pestaña de materia; si estaba activa, pasa a la vecina o a la malla. */
export function cerrarPestana(id: string, rutaActiva: Ruta): void {
  const { pestanas, cerrarMateria } = useApp.getState()
  const siguiente = siguienteTrasCerrar(pestanas, id)
  cerrarMateria(id)
  if (rutaActiva.tipo === 'materia' && rutaActiva.id === id) {
    navegar(siguiente ? { tipo: 'materia', id: siguiente } : { tipo: 'vista', vista: 'malla' })
  }
}

export function cargarEjemplo(datos: Datos): void {
  const ids = new Set(datos.malla.materias.map((m) => m.id))
  const { notas } = parsearNotasCsv(plantilla)
  const validas = notas.filter((n) => ids.has(n.materia))
  const previas = useApp.getState().notasReales
  useApp.getState().reemplazarNotas(validas)
  avisar(`Cargué ${validas.length} notas de ejemplo.`, {
    duracion: DURACION_DESHACER,
    accion: { etiqueta: 'Deshacer', alHacerClic: () => useApp.getState().reemplazarNotas(previas) },
  })
}

/** Pide confirmación y borra todas las notas; después ofrece deshacer durante 10 s. */
export function borrarTodo(): void {
  const { notasReales } = useApp.getState()
  if (notasReales.length === 0) {
    avisar('No hay notas para borrar.')
    return
  }
  useConfirmacion.getState().pedir({
    titulo: '¿Borrar todas tus notas?',
    mensaje: useApp.getState().persistirNotas
      ? 'Se borran las notas que cargaste, también las que Gradly había guardado en este navegador. Podrás deshacerlo durante unos segundos.'
      : 'Se quitan de este navegador las notas que cargaste. Podrás deshacerlo durante unos segundos.',
    etiquetaConfirmar: 'Borrar notas',
    alConfirmar: () => {
      const copia = useApp.getState().notasReales
      useApp.getState().borrarNotas()
      avisar('Tus notas se borraron.', {
        duracion: DURACION_DESHACER,
        accion: { etiqueta: 'Deshacer', alHacerClic: () => useApp.getState().reemplazarNotas(copia) },
      })
    },
  })
}

export function exportarCsv(): void {
  const { notasReales } = useApp.getState()
  if (notasReales.length === 0) {
    avisar('Todavía no hay notas para exportar.')
    return
  }
  descargarTexto('gradly-notas.csv', notasACsv(notasReales))
  avisar(`Exporté ${notasReales.length} notas a gradly-notas.csv.`)
}

/** Alterna entre regresión y red. Si el modelo no trae red, lo explica en vez de fallar. */
export function alternarModelo(datos: Datos, actual: 'regresion' | 'red'): void {
  if (!tieneRed(datos.modelo)) {
    avisar('Este modelo no incluye la red neuronal, así que solo está disponible la regresión.')
    return
  }
  const siguiente = otroModelo(actual)
  useApp.getState().elegirModelo(siguiente)
  avisar(`Ahora estás viendo la predicción de ${NOMBRE_MODELO[siguiente]}.`, { duracion: 3000 })
}
