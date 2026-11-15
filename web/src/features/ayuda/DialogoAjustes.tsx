// Ajustes: paneles, persistencia OPCIONAL de las notas (apagada por defecto) y borrado de datos.
// Nada sale del navegador; guardar las notas aquí es una decisión del usuario y siempre se puede deshacer.

import * as Dialog from '@radix-ui/react-dialog'
import { Lock, Trash2, X } from 'lucide-react'
import { useRetornoFoco } from '../../components/useRetornoFoco'
import { LIMITES_PANEL, useApp } from '../../store/app'
import { borrarTodo } from '../shell/acciones'
import './ayuda.css'

export function DialogoAjustes({ abierto, onCambiar }: { abierto: boolean; onCambiar: (abierto: boolean) => void }) {
  const exploradorAbierto = useApp((s) => s.exploradorAbierto)
  const inspectorAbierto = useApp((s) => s.inspectorAbierto)
  const persistirNotas = useApp((s) => s.persistirNotas)
  const nNotas = useApp((s) => s.notasReales.length)
  const alternarExplorador = useApp((s) => s.alternarExplorador)
  const alternarInspector = useApp((s) => s.alternarInspector)
  const fijarAnchoExplorador = useApp((s) => s.fijarAnchoExplorador)
  const fijarAnchoInspector = useApp((s) => s.fijarAnchoInspector)
  const fijarPersistirNotas = useApp((s) => s.fijarPersistirNotas)
  const abrirRecorrido = useApp((s) => s.abrirRecorrido)
  const retornoFoco = useRetornoFoco()

  return (
    <Dialog.Root open={abierto} onOpenChange={onCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Dialog.Content className="dlg-contenido" aria-describedby="ajustes-descripcion" {...retornoFoco}>
          <div className="ayuda-cabecera">
            <Dialog.Title className="dlg-titulo">Ajustes</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-fantasma" aria-label="Cerrar ajustes">
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="ajustes-descripcion" className="dlg-texto">
            Organiza el espacio de trabajo a tu gusto y decide qué se guarda en este navegador.
          </Dialog.Description>

          <h3 className="ajustes-seccion">Espacio de trabajo</h3>
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
            <button
              type="button"
              className="btn"
              onClick={() => {
                onCambiar(false)
                abrirRecorrido(true)
              }}
            >
              Ver el recorrido guiado
            </button>
          </div>

          <h3 className="ajustes-seccion">Tus datos</h3>
          <label className="ajustes-opcion ajustes-opcion-larga">
            <input type="checkbox" checked={persistirNotas} onChange={(e) => fijarPersistirNotas(e.target.checked)} />
            <span>
              Recordar mis notas en este navegador
              <span className="ajustes-ayuda">
                Apagado por defecto. Si lo activas, tus notas se guardan solo en este navegador (nunca en un servidor) y se recuperan al volver. Puedes borrarlas cuando quieras.
              </span>
            </span>
          </label>
          <div className="fila" style={{ marginTop: 'var(--space-3)' }}>
            <button type="button" className="btn btn-peligro" onClick={borrarTodo}>
              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
              Borrar datos
            </button>
            <span className="ayuda">
              {nNotas === 0 ? 'No hay notas cargadas.' : persistirNotas ? 'Borra tus notas de la pantalla y de lo guardado en este navegador.' : 'Borra las notas que cargaste.'}
            </span>
          </div>

          <p className="ajustes-privacidad">
            <Lock size={12} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 6 }} />
            Tus notas se procesan en este navegador y no salen de tu computador. Gradly no usa analítica ni servicios de terceros.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
