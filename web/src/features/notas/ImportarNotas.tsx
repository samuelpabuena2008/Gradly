// Importar notas: subir un CSV o el certificado de notas en PDF, pegar texto o agregar una por una.
// Todo se procesa en el navegador.

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Malla, Nota } from '../../types'
import { parsearNotasCsv } from '../../lib/import/csv'
import {
  esTextoCertificado,
  importarCertificadoPdf,
  parsearTextoCertificado,
} from '../../lib/import/certificado'
import { notasVigentes } from '../../lib/model/predict'
import './notas.css'
import plantilla from '../../../../data/plantilla_notas.csv?raw'

interface Props {
  malla: Malla
  notas: Nota[]
  onCambiar: (notas: Nota[]) => void
}

export function ImportarNotas({ malla, notas, onCambiar }: Props) {
  const [texto, setTexto] = useState('')
  const [errores, setErrores] = useState<string[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [manual, setManual] = useState({ materia: malla.materias[0].id, periodo: '2025-1', nota: '' })
  // Texto en edición de cada nota simulada; se descarta al salir del campo.
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [simuladorAbierto, setSimuladorAbierto] = useState(true)

  /** Deja solo las notas de materias que existen en la malla y reporta el resto. */
  function filtrar(notasLeidas: Nota[], erroresPrevios: string[], avisosPrevios: string[]) {
    const desconocidas = notasLeidas.filter((n) => !malla.materias.some((m) => m.id === n.materia))
    setErrores([
      ...erroresPrevios,
      ...desconocidas.map((n) => `La materia ${n.materia} no está en la malla`),
    ])
    setAvisos(avisosPrevios)
    onCambiar(notasLeidas.filter((n) => !desconocidas.includes(n)))
  }

  function cargar(contenido: string) {
    if (esTextoCertificado(contenido)) {
      const r = parsearTextoCertificado(contenido, malla)
      filtrar(r.notas, r.errores, r.avisos)
      return
    }
    const r = parsearNotasCsv(contenido)
    filtrar(r.notas, r.errores, [])
  }

  async function cargarPdf(archivo: File) {
    const r = await importarCertificadoPdf(await archivo.arrayBuffer(), malla)
    filtrar(r.notas, r.errores, r.avisos)
  }

  async function subirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    if (archivo.name.toLowerCase().endsWith('.pdf') || archivo.type === 'application/pdf') {
      await cargarPdf(archivo)
      return
    }
    cargar(await archivo.text())
  }

  function agregarManual(e: FormEvent) {
    e.preventDefault()
    const nota = Number(manual.nota.replace(',', '.'))
    if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
      setErrores(['La nota debe estar entre 0 y 5'])
      return
    }
    setErrores([])
    setAvisos([])
    onCambiar([...notas, { materia: manual.materia, periodo: manual.periodo, nota }])
    setManual({ ...manual, nota: '' })
  }

  /** Notas que cuenta el modelo: un intento por materia, el más reciente. */
  const vigentes = notasVigentes(notas)
  // En el simulador las materias siguen el orden de la malla, como en el grafo.
  const orden = new Map(malla.materias.map((m, i) => [m.id, i]))
  const simulables = [...vigentes.values()].sort(
    (a, b) => (orden.get(a.materia) ?? 0) - (orden.get(b.materia) ?? 0),
  )

  /**
   * "¿Qué pasaría si...?": cambia la nota del intento vigente y conserva su periodo,
   * así el resto de la simulación (nivel, previas, semáforo) se recalcula igual que con
   * una nota real.
   */
  function simular(materia: string, nota: number) {
    const vigente = vigentes.get(materia)
    if (!vigente) return
    const redondeada = Math.round(nota * 10) / 10
    onCambiar(
      notas.map((n) =>
        n.materia === materia && n.periodo === vigente.periodo ? { ...n, nota: redondeada } : n,
      ),
    )
  }

  /** Quita la materia de la simulación (todos sus intentos). */
  function quitar(materia: string) {
    setBorradores(({ [materia]: _, ...resto }) => resto)
    onCambiar(notas.filter((n) => n.materia !== materia))
  }

  /** Aplica lo escrito solo si ya es una nota válida; si no, espera a que termine de escribir. */
  function escribirNota(materia: string, valor: string) {
    setBorradores((previos) => ({ ...previos, [materia]: valor }))
    const nota = Number(valor.replace(',', '.'))
    if (valor.trim() !== '' && Number.isFinite(nota) && nota >= 0 && nota <= 5) simular(materia, nota)
  }

  function terminarEdicion(materia: string) {
    setBorradores(({ [materia]: _, ...resto }) => resto)
  }

  return (
    <section className="tarjeta">
      <h2>Tus notas</h2>
      <div className="fila">
        <input type="file" accept=".csv,text/csv,.pdf,application/pdf" onChange={subirArchivo} />
        <button type="button" onClick={() => cargar(plantilla)}>
          Usar notas de ejemplo
        </button>
        {notas.length > 0 && (
          <button type="button" onClick={() => onCambiar([])}>
            Borrar
          </button>
        )}
      </div>

      <textarea
        rows={3}
        placeholder="O pega aquí: materia,periodo,nota o el texto del certificado de notas"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button type="button" disabled={!texto.trim()} onClick={() => cargar(texto)}>
        Cargar texto
      </button>

      <form className="fila" onSubmit={agregarManual}>
        <select value={manual.materia} onChange={(e) => setManual({ ...manual, materia: e.target.value })}>
          {malla.materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
        <input
          aria-label="Periodo"
          value={manual.periodo}
          onChange={(e) => setManual({ ...manual, periodo: e.target.value })}
          size={7}
        />
        <input
          aria-label="Nota"
          placeholder="Nota"
          value={manual.nota}
          onChange={(e) => setManual({ ...manual, nota: e.target.value })}
          size={4}
        />
        <button type="submit">Agregar</button>
      </form>

      {simulables.length > 0 && (
        <div className="simulador">
          <div className="fila-entre">
            <strong className="simulador-titulo">¿Qué pasaría si...?</strong>
            <button
              type="button"
              aria-expanded={simuladorAbierto}
              onClick={() => setSimuladorAbierto(!simuladorAbierto)}
            >
              {simuladorAbierto ? 'Ocultar' : 'Ajustar notas'}
            </button>
          </div>
          {simuladorAbierto && (
            <>
              <p className="ayuda">
                Mueve una nota para simular otro escenario: el grafo y las predicciones se actualizan al
                instante. Nada se guarda fuera de este navegador.
              </p>
              <ul className="simulador-lista">
                {simulables.map((n) => {
                  const nombre = malla.materias.find((m) => m.id === n.materia)?.nombre ?? n.materia
                  const valor = borradores[n.materia] ?? n.nota.toFixed(1)
                  return (
                    <li key={n.materia} className="simulador-fila">
                      <span className="simulador-materia" title={n.materia}>
                        {nombre}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={n.nota}
                        aria-label={`Nota de ${nombre}`}
                        onChange={(e) => simular(n.materia, Number(e.target.value))}
                      />
                      <input
                        type="number"
                        className="simulador-nota"
                        min={0}
                        max={5}
                        step={0.1}
                        value={valor}
                        aria-label={`Nota simulada de ${nombre}`}
                        onChange={(e) => escribirNota(n.materia, e.target.value)}
                        onBlur={() => terminarEdicion(n.materia)}
                      />
                      <button
                        type="button"
                        className="simulador-quitar"
                        aria-label={`Quitar ${nombre}`}
                        title={`Quitar ${nombre} de la simulación`}
                        onClick={() => quitar(n.materia)}
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {avisos.length > 0 && (
        <ul className="ayuda">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {errores.length > 0 && (
        <ul className="errores">
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="ayuda">{notas.length} notas cargadas. Tus notas no salen de este navegador.</p>
    </section>
  )
}
