// Vista Notas: importar (PDF, CSV, texto, ejemplo), revisar lo cargado, editar, agregar a mano,
// exportar a CSV y borrar. Las notas viven solo en este navegador.

import { useId, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Download, Lock, Plus, Trash2 } from 'lucide-react'
import { fmtNotaCorta, plural } from '../../lib/ui/formato'
import { claveNota, periodoActual, validarNotaTexto, validarPeriodo } from '../../lib/ui/notas'
import { notasVigentes } from '../../lib/model/predict'
import { useApp } from '../../store/app'
import { useDatos } from '../../store/escenario'
import { useImportacion } from '../../store/importacion'
import { avisar } from '../../store/toasts'
import { borrarTodo, exportarCsv } from '../shell/acciones'
import { DURACION_DESHACER } from './importacion'
import { ZonaImportar } from './ZonaImportar'
import './notas.css'

function FormularioManual({ refMateria }: { refMateria: RefObject<HTMLSelectElement | null> }) {
  const { malla } = useDatos()
  const agregar = useApp((s) => s.agregarNota)
  const [materia, setMateria] = useState(malla.materias[0].id)
  const [periodo, setPeriodo] = useState(periodoActual())
  const [nota, setNota] = useState('')
  const [errores, setErrores] = useState<{ periodo?: string; nota?: string; general?: string }>({})
  const [estado, setEstado] = useState('')
  const refNota = useRef<HTMLInputElement>(null)
  const id = useId()

  function enviar(e: FormEvent) {
    e.preventDefault()
    const p = validarPeriodo(periodo)
    const n = validarNotaTexto(nota)
    const nuevos = { periodo: p.ok ? undefined : p.error, nota: n.ok ? undefined : n.error }
    if (!p.ok || !n.ok) {
      setErrores(nuevos)
      setEstado('')
      // Lleva el foco al primer campo con problema.
      if (!p.ok) document.getElementById(`${id}-periodo`)?.focus()
      else refNota.current?.focus()
      return
    }
    const resultado = agregar({ materia, periodo: p.valor, nota: n.valor })
    if (resultado === 'duplicada') {
      setErrores({ general: 'Ya cargaste exactamente esa nota para esa materia y periodo.' })
      setEstado('')
    } else {
      setErrores({})
      const nombre = malla.materias.find((m) => m.id === materia)?.nombre ?? materia
      setEstado(`${resultado === 'actualizada' ? 'Actualicé' : 'Agregué'} ${nombre}: ${fmtNotaCorta(n.valor)} (${p.valor}).`)
      setNota('')
    }
    // Después de agregar, el foco vuelve al campo de nota para seguir escribiendo.
    refNota.current?.focus()
  }

  return (
    <form className="manual" onSubmit={enviar} noValidate aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="notas-subtitulo">
        Agregar una nota a mano
      </h3>
      <div className="manual-campos">
        <label className="manual-campo manual-materia">
          Materia
          <select ref={refMateria} value={materia} onChange={(e) => setMateria(e.target.value)}>
            {malla.materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.id})
              </option>
            ))}
          </select>
        </label>
        <label className="manual-campo">
          Periodo
          <input
            id={`${id}-periodo`}
            className="mono"
            value={periodo}
            placeholder="2025-1"
            maxLength={6}
            aria-invalid={Boolean(errores.periodo)}
            aria-describedby={errores.periodo ? `${id}-e-periodo` : undefined}
            onChange={(e) => setPeriodo(e.target.value)}
          />
        </label>
        <label className="manual-campo">
          Nota
          <input
            ref={refNota}
            className="mono"
            value={nota}
            inputMode="decimal"
            placeholder="3.5"
            maxLength={5}
            aria-invalid={Boolean(errores.nota)}
            aria-describedby={errores.nota ? `${id}-e-nota` : undefined}
            onChange={(e) => setNota(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primario manual-agregar">
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Agregar
        </button>
      </div>
      <div className="manual-mensajes" aria-live="polite">
        {errores.periodo && (
          <p id={`${id}-e-periodo`} className="manual-error">
            {errores.periodo}
          </p>
        )}
        {errores.nota && (
          <p id={`${id}-e-nota`} className="manual-error">
            {errores.nota}
          </p>
        )}
        {errores.general && <p className="manual-error">{errores.general}</p>}
        {estado && <p className="ayuda">{estado}</p>}
      </div>
    </form>
  )
}

function TablaNotas() {
  const { malla, materiaPorId } = useDatos()
  const notas = useApp((s) => s.notasReales)
  const editar = useApp((s) => s.editarNota)
  const quitar = useApp((s) => s.quitarNota)
  const reemplazar = useApp((s) => s.reemplazarNotas)
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const vigentes = useMemo(() => notasVigentes(notas), [notas])
  const filas = useMemo(
    () => [...notas].sort((a, b) => (a.periodo < b.periodo ? 1 : a.periodo > b.periodo ? -1 : a.materia.localeCompare(b.materia))),
    [notas],
  )
  const intentos = useMemo(() => {
    const c = new Map<string, number>()
    for (const n of notas) c.set(n.materia, (c.get(n.materia) ?? 0) + 1)
    return c
  }, [notas])

  function confirmar(n: (typeof notas)[number]) {
    const clave = claveNota(n)
    const texto = borradores[clave]
    setBorradores(({ [clave]: _descartado, ...resto }) => resto)
    if (texto === undefined) return
    const r = validarNotaTexto(texto)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError('')
    if (r.valor !== n.nota) editar(n.materia, n.periodo, r.valor)
  }

  function quitarConDeshacer(n: (typeof notas)[number]) {
    const previas = notas
    quitar(n.materia, n.periodo)
    const nombre = materiaPorId.get(n.materia)?.nombre ?? n.materia
    avisar(`Quité la nota de ${nombre} (${n.periodo}).`, {
      duracion: DURACION_DESHACER,
      accion: { etiqueta: 'Deshacer', alHacerClic: () => reemplazar(previas) },
    })
  }

  if (notas.length === 0) return <p className="ayuda notas-vacio">Todavía no hay notas cargadas.</p>

  return (
    <>
      <div className="tabla-notas-caja">
        <table className="tabla-notas">
          <caption className="solo-lectores">Notas cargadas</caption>
          <thead>
            <tr>
              <th scope="col">Materia</th>
              <th scope="col">Periodo</th>
              <th scope="col">Nota</th>
              <th scope="col">
                <span className="solo-lectores">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((n) => {
              const clave = claveNota(n)
              const nombre = malla.materias.find((m) => m.id === n.materia)?.nombre ?? n.materia
              const vigente = vigentes.get(n.materia) === n
              const repetida = (intentos.get(n.materia) ?? 0) > 1
              return (
                <tr key={clave}>
                  <td>
                    {nombre} <span className="mono materia-codigo">{n.materia}</span>
                    {repetida && <span className={`tabla-etiqueta${vigente ? ' tabla-etiqueta-cuenta' : ''}`}>{vigente ? 'cuenta este intento' : 'intento anterior'}</span>}
                  </td>
                  <td className="mono">{n.periodo}</td>
                  <td>
                    <input
                      className="mono tabla-nota"
                      value={borradores[clave] ?? fmtNotaCorta(n.nota)}
                      inputMode="decimal"
                      aria-label={`Nota de ${nombre} en ${n.periodo}`}
                      onChange={(e) => setBorradores((b) => ({ ...b, [clave]: e.target.value }))}
                      onBlur={() => confirmar(n)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), e.preventDefault())}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn-fantasma" aria-label={`Quitar la nota de ${nombre} en ${n.periodo}`} onClick={() => quitarConDeshacer(n)}>
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="manual-error" role="alert">
        {error}
      </p>
    </>
  )
}

export function VistaNotas() {
  const notas = useApp((s) => s.notasReales)
  const resumen = useImportacion((s) => s.resumen)
  const refMateria = useRef<HTMLSelectElement>(null)
  const enfocarManual = () => {
    refMateria.current?.scrollIntoView?.({ block: 'center' })
    refMateria.current?.focus()
  }

  return (
    <div className="notas">
      <header>
        <h2 className="notas-titulo">Tus notas</h2>
        <p className="notas-privacidad">
          <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
          Se procesan en tu navegador y no salen de tu computador.
        </p>
      </header>

      <section aria-labelledby="notas-importar" className="notas-bloque">
        <h3 id="notas-importar" className="notas-subtitulo">
          {notas.length === 0 ? 'Cómo quieres cargarlas' : 'Cargar más notas'}
        </h3>
        <ZonaImportar variante={notas.length === 0 ? 'grande' : 'compacta'} onManual={enfocarManual} />
        <p className="ayuda">También puedes arrastrar un archivo a cualquier parte de la ventana.</p>
        {resumen && (
          <div className="notas-resumen" role="status">
            <strong>
              Se importaron {plural(resumen.notas, 'nota', 'notas')}
              {resumen.avisos.length > 0 && ` · ${plural(resumen.avisos.length, 'aviso', 'avisos')}`}
            </strong>
            {resumen.nombre && <span className="ayuda"> de «{resumen.nombre}»</span>}
            {resumen.avisos.length > 0 && (
              <details className="imp-plegable imp-plegable-aviso">
                <summary>Ver avisos ({resumen.avisos.length})</summary>
                <ul>
                  {resumen.avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="notas-lista" className="notas-bloque">
        <div className="fila-entre">
          <h3 id="notas-lista" className="notas-subtitulo">
            Notas cargadas {notas.length > 0 && <span className="ayuda">({notas.length})</span>}
          </h3>
          {notas.length > 0 && (
            <div className="fila notas-acciones">
              <button type="button" className="btn" onClick={exportarCsv}>
                <Download size={14} strokeWidth={1.5} aria-hidden="true" />
                Exportar CSV
              </button>
              <button type="button" className="btn btn-peligro" onClick={borrarTodo}>
                <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                Borrar todo
              </button>
            </div>
          )}
        </div>
        <TablaNotas />
      </section>

      <section className="notas-bloque">
        <FormularioManual refMateria={refMateria} />
      </section>
    </div>
  )
}
