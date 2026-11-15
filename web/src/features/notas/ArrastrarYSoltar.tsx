// Arrastrar y soltar un archivo en cualquier parte de la ventana: muestra «Suelta tu certificado aquí»
// y lo lleva al flujo de importación. También evita que el navegador abra el archivo y deje la app.

import { useEffect } from 'react'
import { FileDown } from 'lucide-react'
import { useDatos } from '../../store/escenario'
import { useImportacion } from '../../store/importacion'
import { avisar } from '../../store/toasts'
import { importarArchivo } from './importacion'
import './importacion.css'

const traeArchivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

export function ArrastrarYSoltar() {
  const { malla } = useDatos()
  const arrastrando = useImportacion((s) => s.arrastrando)
  const fijarArrastrando = useImportacion((s) => s.fijarArrastrando)

  useEffect(() => {
    // dragenter/dragleave se disparan también al cruzar hijos: se cuentan para saber cuándo sale de verdad.
    let profundidad = 0
    const entra = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      e.preventDefault()
      profundidad++
      fijarArrastrando(true)
    }
    const sobre = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const sale = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      profundidad = Math.max(0, profundidad - 1)
      if (profundidad === 0) fijarArrastrando(false)
    }
    const suelta = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      e.preventDefault()
      profundidad = 0
      fijarArrastrando(false)
      const archivos = Array.from(e.dataTransfer?.files ?? [])
      if (archivos.length === 0) return
      if (archivos.length > 1) avisar('Se lee un archivo a la vez: tomé el primero.')
      void importarArchivo(archivos[0], malla)
    }
    const cancela = () => {
      profundidad = 0
      fijarArrastrando(false)
    }
    window.addEventListener('dragenter', entra)
    window.addEventListener('dragover', sobre)
    window.addEventListener('dragleave', sale)
    window.addEventListener('drop', suelta)
    window.addEventListener('dragend', cancela)
    return () => {
      window.removeEventListener('dragenter', entra)
      window.removeEventListener('dragover', sobre)
      window.removeEventListener('dragleave', sale)
      window.removeEventListener('drop', suelta)
      window.removeEventListener('dragend', cancela)
    }
  }, [malla, fijarArrastrando])

  if (!arrastrando) return null
  return (
    <div className="imp-soltar" role="presentation" aria-hidden="true">
      <div className="imp-soltar-caja">
        <FileDown size={36} strokeWidth={1.25} />
        <p className="imp-soltar-titulo">Suelta tu certificado aquí</p>
        <p className="ayuda">PDF del certificado de notas o un CSV. Se lee en tu navegador y no sale de tu computador.</p>
      </div>
    </div>
  )
}
