// Capas globales del espacio de trabajo: paleta, ayuda, confirmaciones y avisos.

import { DialogoConfirmacion } from '../../components/Dialogos'
import { Toaster } from '../../components/Toaster'
import { Recorrido } from '../bienvenida/Recorrido'
import { DialogoAtajos } from '../ayuda/DialogoAtajos'
import { ArrastrarYSoltar } from '../notas/ArrastrarYSoltar'
import { DialogoImportacion } from '../notas/DialogoImportacion'
import { DialogoPegar } from '../notas/DialogoPegar'
import { Paleta } from './Paleta'

export function Dialogos() {
  return (
    <>
      <Paleta />
      <DialogoAtajos />
      <DialogoConfirmacion />
      <DialogoImportacion />
      <DialogoPegar />
      <ArrastrarYSoltar />
      <Recorrido />
      <Toaster />
    </>
  )
}
