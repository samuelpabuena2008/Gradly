// Capas globales del espacio de trabajo: paleta, ayuda, confirmaciones y avisos.

import { DialogoConfirmacion } from '../../components/Dialogos'
import { Toaster } from '../../components/Toaster'
import { DialogoAtajos } from '../ayuda/DialogoAtajos'
import { Paleta } from './Paleta'

export function Dialogos() {
  return (
    <>
      <Paleta />
      <DialogoAtajos />
      <DialogoConfirmacion />
      <Toaster />
    </>
  )
}
