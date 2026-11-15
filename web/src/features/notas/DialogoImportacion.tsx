// Diálogo del flujo de importación: leyendo (cancelable) · revisión editable · vacío · error.
// La revisión permite corregir o quitar filas antes de confirmar, con avisos y errores por fila.

import { Fragment, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Check, CircleAlert, Trash2, X } from 'lucide-react'
import { plural } from '../../lib/ui/formato'
import { notasDeRevision, validarFilas } from '../../lib/ui/notas'
import { useApp } from '../../store/app'
import { useDatos } from '../../store/escenario'
import { useImportacion, type ModoImportacion } from '../../store/importacion'
import { cancelarImportacion, confirmarImportacion } from './importacion'
import './importacion.css'

function Cabecera({ titulo }: { titulo: string }) {
  return (
    <div className="imp-cabecera">
      <Dialog.Title className="dlg-titulo">{titulo}</Dialog.Title>
      <Dialog.Close asChild>
        <button type="button" className="btn btn-fantasma" aria-label="Cerrar">
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </Dialog.Close>
    </div>
  )
}

function Plegable({ titulo, items, tono }: { titulo: string; items: string[]; tono: 'aviso' | 'error' }) {
  if (items.length === 0) return null
  return (
    <details className={`imp-plegable imp-plegable-${tono}`}>
      <summary>
        {titulo} ({items.length})
      </summary>
      <ul>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </details>
  )
}

function Revision() {
  const { malla, materiaPorId } = useDatos()
  const imp = useImportacion()
  const hayNotas = useApp((s) => s.notasReales.length)
  const validadas = useMemo(() => validarFilas(imp.filas, malla), [imp.filas, malla])
  const listas = notasDeRevision(validadas).length
  const conError = validadas.filter((v) => !v.nota).length
  const conAviso = validadas.filter((v) => v.nota && v.problemas.length > 0).length

  return (
    <>
      <Cabecera titulo="Revisa lo que encontramos" />
      <Dialog.Description className="dlg-texto">
        {imp.nombre ? `Del archivo «${imp.nombre}»: ` : ''}
        {plural(listas, 'nota lista', 'notas listas')} para importar
        {conError > 0 && `, ${plural(conError, 'fila con error (se omite)', 'filas con errores (se omiten)')}`}
        {conAviso > 0 && `, ${plural(conAviso, 'aviso', 'avisos')}`}. Puedes corregir cualquier dato antes de confirmar.
      </Dialog.Description>

      <Plegable titulo="Avisos del archivo" items={imp.avisos} tono="aviso" />
      <Plegable titulo="Filas que no se pudieron leer" items={imp.errores} tono="error" />

      <div className="imp-tabla-caja">
        <table className="imp-tabla">
          <caption className="solo-lectores">Notas detectadas</caption>
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Código</th>
              <th scope="col">Materia</th>
              <th scope="col">Periodo</th>
              <th scope="col">Nota</th>
              <th scope="col">
                <span className="solo-lectores">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {validadas.map(({ fila, nota, problemas, repetida }, i) => {
              const error = !nota
              const aviso = !error && problemas.length > 0
              const nombre = materiaPorId.get(fila.materia.trim().toUpperCase())?.nombre
              return (
                <Fragment key={fila.id}>
                <tr className={error ? 'imp-fila-error' : aviso ? 'imp-fila-aviso' : undefined}>
                  <td>
                    <span className={`imp-estado ${error ? 'imp-estado-error' : aviso ? 'imp-estado-aviso' : 'imp-estado-ok'}`}>
                      {error ? (
                        <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                      ) : aviso ? (
                        <AlertTriangle size={14} strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <Check size={14} strokeWidth={2} aria-hidden="true" />
                      )}
                      <span>{error ? 'Error' : repetida ? 'Repetida' : aviso ? 'Aviso' : 'Lista'}</span>
                    </span>
                  </td>
                  <td>
                    <input
                      className="mono imp-input imp-codigo"
                      value={fila.materia}
                      aria-label={`Código de la materia, fila ${i + 1}`}
                      aria-invalid={error && !nombre}
                      onChange={(e) => imp.editarFila(fila.id, { materia: e.target.value })}
                    />
                  </td>
                  <td className="imp-nombre">{nombre ?? <span className="ayuda">—</span>}</td>
                  <td>
                    <input
                      className="mono imp-input imp-periodo"
                      value={fila.periodo}
                      aria-label={`Periodo, fila ${i + 1}`}
                      onChange={(e) => imp.editarFila(fila.id, { periodo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="mono imp-input imp-nota"
                      value={fila.nota}
                      inputMode="decimal"
                      aria-label={`Nota, fila ${i + 1}`}
                      onChange={(e) => imp.editarFila(fila.id, { nota: e.target.value })}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-fantasma imp-quitar" aria-label={`Quitar la fila ${i + 1}`} onClick={() => imp.quitarFila(fila.id)}>
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {problemas.length > 0 && (
                  <tr className={`imp-fila-problemas ${error ? 'imp-fila-error' : 'imp-fila-aviso'}`}>
                    <td colSpan={6}>
                      <div className="imp-problemas">
                        {problemas.map((p) => (
                          <span key={p.texto} className={p.tipo === 'error' ? 'imp-problema-error' : 'imp-problema-aviso'}>
                            {p.texto}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {hayNotas > 0 && (
        <fieldset className="imp-modo">
          <legend>Ya tienes {plural(hayNotas, 'nota cargada', 'notas cargadas')}. ¿Qué hacemos con estas?</legend>
          {(
            [
              ['reemplazar', 'Reemplazar', 'Usar solo las notas de este archivo.'],
              ['combinar', 'Combinar', 'Sumarlas a las que ya tienes; el intento más reciente de cada materia manda.'],
            ] as [ModoImportacion, string, string][]
          ).map(([valor, titulo, texto]) => (
            <label key={valor} className="imp-modo-opcion">
              <input type="radio" name="modo-importacion" checked={imp.modo === valor} onChange={() => imp.elegirModo(valor)} />
              <span>
                <strong>{titulo}</strong> — {texto}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="dlg-acciones">
        <button type="button" className="btn" onClick={cancelarImportacion}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primario" disabled={listas === 0} onClick={() => confirmarImportacion(malla)}>
          Confirmar y ver mi malla
        </button>
      </div>
    </>
  )
}

export function DialogoImportacion() {
  const fase = useImportacion((s) => s.fase)
  const mensaje = useImportacion((s) => s.mensaje)
  const nombre = useImportacion((s) => s.nombre)
  const error = useImportacion((s) => s.error)
  const avisos = useImportacion((s) => s.avisos)
  const errores = useImportacion((s) => s.errores)
  const cerrar = useImportacion((s) => s.cerrar)

  return (
    <Dialog.Root open={fase !== 'inactivo'} onOpenChange={(abierto) => !abierto && cancelarImportacion()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Dialog.Content
          className={`dlg-contenido imp-dialogo${fase === 'revision' ? ' imp-dialogo-ancho' : ''}`}
        >
          {fase === 'leyendo' && (
            <>
              <Cabecera titulo="Leyendo tus notas" />
              <Dialog.Description className="dlg-texto">
                {mensaje}
                {nombre && <span className="mono imp-archivo"> {nombre}</span>}
                <br />
                Todo se procesa en tu navegador; el archivo no sale de tu computador.
              </Dialog.Description>
              <div className="imp-progreso" role="progressbar" aria-label="Leyendo el archivo" aria-busy="true">
                <span />
              </div>
              <div className="dlg-acciones">
                <button type="button" className="btn" onClick={cancelarImportacion}>
                  Cancelar
                </button>
              </div>
            </>
          )}

          {fase === 'error' && error && (
            <>
              <Cabecera titulo={error.titulo} />
              <Dialog.Description className="dlg-texto">
                {error.detalle}
              </Dialog.Description>
              <div className="dlg-acciones">
                <button type="button" className="btn btn-primario" onClick={cerrar} autoFocus>
                  Entendido
                </button>
              </div>
            </>
          )}

          {fase === 'vacio' && (
            <>
              <Cabecera titulo="No encontramos notas en este archivo" />
              <Dialog.Description className="dlg-texto">
                {nombre ? `«${nombre}» se leyó, pero no tiene notas que Gradly pueda usar.` : 'La lectura terminó sin notas.'} Revisa que sea el certificado completo o una tabla con
                las columnas materia, periodo y nota.
              </Dialog.Description>
              <Plegable titulo="Detalles" items={[...errores, ...avisos]} tono="error" />
              <div className="dlg-acciones">
                <button type="button" className="btn btn-primario" onClick={cerrar} autoFocus>
                  Entendido
                </button>
              </div>
            </>
          )}

          {fase === 'revision' && <Revision />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
