// Diálogo de confirmación global (Radix Dialog: trampa de foco, Esc cierra, devuelve el foco).

import * as Dialog from '@radix-ui/react-dialog'
import { useConfirmacion } from '../store/confirmacion'
import { useRetornoFoco } from './useRetornoFoco'
import './dialogos.css'

export function DialogoConfirmacion() {
  const pendiente = useConfirmacion((s) => s.pendiente)
  const cerrar = useConfirmacion((s) => s.cerrar)
  const retornoFoco = useRetornoFoco()

  return (
    <Dialog.Root open={pendiente !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Dialog.Content className="dlg-contenido dlg-confirmar" role="alertdialog" aria-describedby="dlg-confirmar-mensaje" {...retornoFoco}>
          <Dialog.Title className="dlg-titulo">{pendiente?.titulo}</Dialog.Title>
          <Dialog.Description id="dlg-confirmar-mensaje" className="dlg-texto">
            {pendiente?.mensaje}
          </Dialog.Description>
          <div className="dlg-acciones">
            <Dialog.Close asChild>
              <button type="button" className="btn" autoFocus>
                Cancelar
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => {
                const accion = pendiente?.alConfirmar
                cerrar()
                accion?.()
              }}
            >
              {pendiente?.etiquetaConfirmar}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
