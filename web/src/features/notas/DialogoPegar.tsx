// Pegar el texto del certificado de notas (o una tabla materia,periodo,nota) para revisarlo antes de importar.

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useDatos } from '../../store/escenario'
import { useImportacion } from '../../store/importacion'
import { importarTexto } from './importacion'
import './importacion.css'

export function DialogoPegar() {
  const abierto = useImportacion((s) => s.pegarAbierto)
  const abrirPegar = useImportacion((s) => s.abrirPegar)
  const { malla } = useDatos()
  const [texto, setTexto] = useState('')

  function enviar() {
    if (!texto.trim()) return
    abrirPegar(false)
    void importarTexto(texto, malla)
    setTexto('')
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={abrirPegar}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Dialog.Content className="dlg-contenido imp-dialogo">
          <div className="imp-cabecera">
            <Dialog.Title className="dlg-titulo">Pegar texto</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-fantasma" aria-label="Cerrar">
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="dlg-texto">
            Pega el texto del certificado de notas o una tabla con las columnas <code>materia,periodo,nota</code>. Antes de importar podrás revisar todo.
          </Dialog.Description>
          <label className="solo-lectores" htmlFor="texto-pegado">
            Texto con tus notas
          </label>
          <textarea
            id="texto-pegado"
            className="imp-pegar"
            rows={9}
            value={texto}
            placeholder={'materia,periodo,nota\nMAT1031,2025-1,3.0'}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="dlg-acciones">
            <button type="button" className="btn" onClick={() => abrirPegar(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primario" disabled={!texto.trim()} onClick={enviar}>
              Revisar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
