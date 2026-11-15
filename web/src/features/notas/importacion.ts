// Flujo de importación: leer (cancelable) → revisar → confirmar (Reemplazar o Combinar) → deshacer.
// Todo se procesa en el navegador. Cualquier fallo termina en un estado de error explicado, nunca en
// una excepción sin atrapar.

import type { Malla } from '../../types'
import { ErrorLectura, leerArchivo, leerTexto, type Lectura } from '../../lib/ui/lectura'
import { notasDeRevision, validarFilas } from '../../lib/ui/notas'
import { plural } from '../../lib/ui/formato'
import { useApp } from '../../store/app'
import { useImportacion } from '../../store/importacion'
import { avisar } from '../../store/toasts'
import { irA } from '../shell/acciones'

export const DURACION_DESHACER = 10_000

/** Cada lectura tiene un número; si cambia mientras se lee (cancelar, otra lectura), se descarta el resultado. */
let lecturaVigente = 0

async function ejecutar(mensaje: string, nombre: string | undefined, origen: 'pdf' | 'csv' | 'texto', tarea: () => Promise<Lectura>): Promise<void> {
  const mia = ++lecturaVigente
  useImportacion.getState().empezar(mensaje, nombre, origen)
  try {
    const lectura = await tarea()
    if (mia === lecturaVigente) useImportacion.getState().mostrarLectura(lectura)
  } catch (e) {
    if (mia !== lecturaVigente) return
    useImportacion
      .getState()
      .fallar(
        e instanceof ErrorLectura
          ? e
          : { titulo: 'No pudimos importar tus notas', detalle: `Algo salió mal al leer los datos. Inténtalo de nuevo. Detalle técnico: ${e instanceof Error ? e.message : String(e)}` },
      )
  }
}

export function importarArchivo(archivo: File, malla: Malla): Promise<void> {
  const esPdf = archivo.name.toLowerCase().endsWith('.pdf') || archivo.type === 'application/pdf'
  return ejecutar(esPdf ? 'Leyendo el certificado…' : 'Leyendo el archivo…', archivo.name, esPdf ? 'pdf' : 'csv', () => leerArchivo(archivo, malla))
}

export function importarTexto(texto: string, malla: Malla): Promise<void> {
  return ejecutar('Leyendo el texto…', undefined, 'texto', () => leerTexto(texto, malla))
}

/** Cancela la lectura en curso o cierra la revisión. */
export function cancelarImportacion(): void {
  lecturaVigente++
  useImportacion.getState().cerrar()
}

/** Aplica las filas válidas de la revisión, ofrece deshacer y lleva a la malla. */
export function confirmarImportacion(malla: Malla): void {
  const imp = useImportacion.getState()
  const validadas = validarFilas(imp.filas, malla)
  const notas = notasDeRevision(validadas)
  if (notas.length === 0) return

  const app = useApp.getState()
  const previas = app.notasReales
  if (imp.modo === 'combinar' && previas.length > 0) app.combinarNotas(notas)
  else app.reemplazarNotas(notas)

  const omitidas = validadas.filter((v) => !v.nota).length
  const avisos = [
    ...imp.avisos,
    ...imp.errores,
    ...(omitidas > 0 ? [`Se omitieron ${plural(omitidas, 'fila', 'filas')} con errores en la revisión.`] : []),
  ]
  imp.fijarResumen({ notas: notas.length, nombre: imp.nombre, origen: imp.origen ?? 'texto', avisos })
  imp.cerrar()

  avisar(`Se importaron ${plural(notas.length, 'nota', 'notas')}${avisos.length > 0 ? ` · ${plural(avisos.length, 'aviso', 'avisos')}` : ''}`, {
    duracion: DURACION_DESHACER,
    accion: {
      etiqueta: 'Deshacer',
      alHacerClic: () => {
        useApp.getState().reemplazarNotas(previas)
        useImportacion.getState().fijarResumen(null)
      },
    },
  })
  irA({ tipo: 'vista', vista: 'malla' })
}
