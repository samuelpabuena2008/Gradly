// Los caminos para cargar notas: certificado PDF, CSV, texto pegado, notas de ejemplo e ingreso manual.
// Se usa en la bienvenida (grande) y en la vista Notas (compacto).

import { ClipboardPaste, FileText, PencilLine, Sparkles, Table2 } from 'lucide-react'
import { useDatos } from '../../store/escenario'
import { useImportacion } from '../../store/importacion'
import { cargarEjemplo } from '../shell/acciones'
import { importarArchivo } from './importacion'
import { useSelectorArchivo } from './SelectorArchivo'

interface Props {
  variante?: 'grande' | 'compacta'
  /** Qué hacer con «Ingresar manualmente». */
  onManual: () => void
}

export function ZonaImportar({ variante = 'grande', onManual }: Props) {
  const datos = useDatos()
  const abrirPegar = useImportacion((s) => s.abrirPegar)
  const pdf = useSelectorArchivo('.pdf,application/pdf', 'Elegir el certificado de notas en PDF', (f) => void importarArchivo(f, datos.malla))
  const csv = useSelectorArchivo('.csv,.txt,text/csv,text/plain', 'Elegir un archivo CSV', (f) => void importarArchivo(f, datos.malla))

  const opciones = [
    { id: 'pdf', icono: FileText, titulo: 'Subir certificado PDF', texto: 'El Certificado de Notas oficial de Uninorte', alHacerClic: pdf.abrir, destacada: true },
    { id: 'csv', icono: Table2, titulo: 'Subir CSV', texto: 'Una tabla con materia, periodo y nota', alHacerClic: csv.abrir },
    { id: 'texto', icono: ClipboardPaste, titulo: 'Pegar texto', texto: 'Copia y pega el certificado o tu tabla', alHacerClic: () => abrirPegar(true) },
    { id: 'ejemplo', icono: Sparkles, titulo: 'Ver con notas de ejemplo', texto: 'Explora Gradly sin cargar nada tuyo', alHacerClic: () => cargarEjemplo(datos) },
  ]

  return (
    <div className={`zona-importar zona-${variante}`}>
      {pdf.input}
      {csv.input}
      <ul className="zona-opciones">
        {opciones.map(({ id, icono: Icono, titulo, texto, alHacerClic, destacada }) => (
          <li key={id}>
            <button type="button" className={`zona-opcion${destacada ? ' zona-opcion-principal' : ''}`} onClick={alHacerClic}>
              <Icono size={variante === 'grande' ? 22 : 18} strokeWidth={1.5} aria-hidden="true" />
              <span className="zona-opcion-titulo">{titulo}</span>
              {variante === 'grande' && <span className="zona-opcion-texto">{texto}</span>}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-fantasma zona-manual" onClick={onManual}>
        <PencilLine size={16} strokeWidth={1.5} aria-hidden="true" />
        Ingresar manualmente
      </button>
    </div>
  )
}
