// Importar notas: subir un CSV, pegar texto o agregar una por una.
// Todo se procesa en el navegador.

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Malla, Nota } from '../../types'
import { parsearNotasCsv } from '../../lib/import/csv'
import plantilla from '../../../../data/plantilla_notas.csv?raw'

interface Props {
  malla: Malla
  notas: Nota[]
  onCambiar: (notas: Nota[]) => void
}

export function ImportarNotas({ malla, notas, onCambiar }: Props) {
  const [texto, setTexto] = useState('')
  const [errores, setErrores] = useState<string[]>([])
  const [manual, setManual] = useState({ materia: malla.materias[0].id, periodo: '2025-1', nota: '' })

  function cargar(contenido: string) {
    const r = parsearNotasCsv(contenido)
    const desconocidas = r.notas.filter((n) => !malla.materias.some((m) => m.id === n.materia))
    setErrores([
      ...r.errores,
      ...desconocidas.map((n) => `La materia ${n.materia} no está en la malla`),
    ])
    onCambiar(r.notas.filter((n) => !desconocidas.includes(n)))
  }

  async function subirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (archivo) cargar(await archivo.text())
  }

  function agregarManual(e: FormEvent) {
    e.preventDefault()
    const nota = Number(manual.nota.replace(',', '.'))
    if (!Number.isFinite(nota) || nota < 0 || nota > 5) {
      setErrores(['La nota debe estar entre 0 y 5'])
      return
    }
    setErrores([])
    onCambiar([...notas, { materia: manual.materia, periodo: manual.periodo, nota }])
    setManual({ ...manual, nota: '' })
  }

  return (
    <section className="tarjeta">
      <h2>Tus notas</h2>
      <div className="fila">
        <input type="file" accept=".csv,text/csv" onChange={subirArchivo} />
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
        placeholder="O pega aquí: materia,periodo,nota"
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
