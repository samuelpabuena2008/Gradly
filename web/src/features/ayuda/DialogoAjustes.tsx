// Ajustes de la interfaz. En esta fase: paneles y su tamaño. La persistencia opcional de notas
// (apagada por defecto) llega con la gestión de datos del usuario.

import * as Dialog from '@radix-ui/react-dialog'
import { Lock, X } from 'lucide-react'
import { LIMITES_PANEL, useApp } from '../../store/app'
import './ayuda.css'

export function DialogoAjustes({ abierto, onCambiar }: { abierto: boolean; onCambiar: (abierto: boolean) => void }) {
  const exploradorAbierto = useApp((s) => s.exploradorAbierto)
  const inspectorAbierto = useApp((s) => s.inspectorAbierto)
  const alternarExplorador = useApp((s) => s.alternarExplorador)
  const alternarInspector = useApp((s) => s.alternarInspector)
  const fijarAnchoExplorador = useApp((s) => s.fijarAnchoExplorador)
  const fijarAnchoInspector = useApp((s) => s.fijarAnchoInspector)

  return (
    <Dialog.Root open={abierto} onOpenChange={onCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Dialog.Content className="dlg-contenido" aria-describedby="ajustes-descripcion">
          <div className="ayuda-cabecera">
            <Dialog.Title className="dlg-titulo">Ajustes</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-fantasma" aria-label="Cerrar ajustes">
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="ajustes-descripcion" className="dlg-texto">
            Organiza el espacio de trabajo a tu gusto. Estas preferencias se guardan solo en este navegador.
          </Dialog.Description>

          <label className="ajustes-opcion">
            <input type="checkbox" checked={exploradorAbierto} onChange={() => alternarExplorador()} />
            Mostrar el explorador de materias
          </label>
          <label className="ajustes-opcion">
            <input type="checkbox" checked={inspectorAbierto} onChange={() => alternarInspector()} />
            Mostrar el inspector
          </label>
          <div className="fila" style={{ marginTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                fijarAnchoExplorador(LIMITES_PANEL.explorador.inicial)
                fijarAnchoInspector(LIMITES_PANEL.inspector.inicial)
              }}
            >
              Restablecer el tamaño de los paneles
            </button>
          </div>

          <p className="ajustes-privacidad">
            <Lock size={12} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 6 }} />
            Tus notas se procesan en este navegador y no salen de tu computador. Gradly no usa analítica ni servicios de
            terceros.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
