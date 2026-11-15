// Simulador «¿Qué pasaría si…?»: mueve una nota (o asigna una hipotética a una materia disponible) y mira
// al instante cómo cambian las predicciones y qué materias se desbloquean. Nada de esto toca lo que
// importaste: son `ajustes` sobre las notas reales.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import { Delta } from '../../components/Delta'
import { filtrarDifuso } from '../../lib/ui/fuzzy'
import { fmtNotaCorta, plural } from '../../lib/ui/formato'
import { validarNotaTexto } from '../../lib/ui/notas'
import { cambiosDisponibilidad, deltasPredicciones } from '../../lib/ui/proyeccion'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { irA } from '../shell/acciones'
import './simulador.css'

const redondear = (n: number) => Math.round(n * 10) / 10

interface FilaProps {
  id: string
  nombre: string
  /** Nota vigente en el escenario (real o hipotética); `null` si todavía no hay (proyección). */
  valor: number | null
  /** Nota real importada; `null` si la materia no tiene intento. */
  real: number | null
  /** Nota esperada, para materias disponibles sin nota. */
  esperada: number | null
  ajustada: boolean
  onCambiar: (id: string, nota: number) => void
  onRestaurar: (id: string) => void
}

function FilaBase({ id, nombre, valor, real, esperada, ajustada, onCambiar, onRestaurar }: FilaProps) {
  // `local` mantiene el control fluido mientras se arrastra, aunque el escenario se recalcule con retraso.
  const [local, setLocal] = useState<number | null>(null)
  const [borrador, setBorrador] = useState<string | null>(null)
  const pendiente = useRef<number | null>(null)
  const cuadro = useRef(0)

  useEffect(() => () => cancelAnimationFrame(cuadro.current), [])
  // Cuando el escenario ya refleja el valor arrastrado, el control vuelve a leerlo del escenario.
  useEffect(() => {
    if (local !== null && valor === local) setLocal(null)
  }, [valor, local])

  const programar = (nota: number) => {
    setLocal(nota)
    pendiente.current = nota
    if (cuadro.current) return
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = 0
      if (pendiente.current !== null) onCambiar(id, pendiente.current)
      pendiente.current = null
    })
  }

  const mostrado = local ?? valor ?? esperada ?? 3
  const escribir = (texto: string) => {
    setBorrador(texto)
    const r = validarNotaTexto(texto)
    if (r.ok) programar(redondear(r.valor))
  }

  return (
    <li className={`sim-fila${ajustada ? ' sim-fila-ajustada' : ''}`}>
      <div className="sim-fila-cabecera">
        <span className="sim-nombre" title={`${nombre} (${id})`}>
          {nombre}
        </span>
        {ajustada && (
          <button
            type="button"
            className="btn btn-fantasma sim-restaurar"
            aria-label={`Restaurar ${nombre}`}
            title={real !== null ? `Volver a ${fmtNotaCorta(real)}` : 'Quitar la nota hipotética'}
            onClick={() => {
              setLocal(null)
              setBorrador(null)
              onRestaurar(id)
            }}
          >
            <RotateCcw size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="sim-control">
        <input
          type="range"
          min={0}
          max={5}
          step={0.1}
          value={mostrado}
          aria-label={`Nota de ${nombre}`}
          aria-valuetext={`${fmtNotaCorta(mostrado)}${valor === null && !ajustada ? ' (esperada)' : ''}`}
          className={valor === null && local === null ? 'sim-sin-valor' : undefined}
          onChange={(e) => programar(redondear(Number(e.target.value)))}
        />
        <input
          type="text"
          inputMode="decimal"
          className={`mono sim-numero${ajustada ? ' sim-numero-hipotetica' : ''}`}
          value={borrador ?? fmtNotaCorta(mostrado)}
          aria-label={`Nota simulada de ${nombre}`}
          onChange={(e) => escribir(e.target.value)}
          onBlur={() => setBorrador(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>
      <p className="sim-pie ayuda">
        {ajustada ? (
          <>
            <span className="etiqueta-hipotetica">hipotética</span>
            {real !== null ? ` Tu nota real: ${fmtNotaCorta(real)}.` : ' Esta materia aún no tiene nota.'}
          </>
        ) : real !== null ? (
          `Tu nota: ${fmtNotaCorta(real)}.`
        ) : esperada !== null ? (
          `Esperada ≈ ${fmtNotaCorta(esperada)}. Mueve el control para probar otra nota.`
        ) : null}
      </p>
    </li>
  )
}
const Fila = memo(FilaBase)

export function Simulador() {
  const { malla, materiaPorId } = useDatos()
  const escenario = useEscenario()
  const ajustes = useApp((s) => s.ajustes)
  const fijarAjuste = useApp((s) => s.fijarAjuste)
  const quitarAjuste = useApp((s) => s.quitarAjuste)
  const restaurarAjustes = useApp((s) => s.restaurarAjustes)
  const [busqueda, setBusqueda] = useState('')
  const [anuncio, setAnuncio] = useState('')

  const nombreDe = useCallback((id: string) => materiaPorId.get(id)?.nombre ?? id, [materiaPorId])
  const semestreDe = (id: string) => materiaPorId.get(id)?.semestre ?? 99

  const { mapaReales, mapaNotas, predicciones, prediccionesBase } = escenario
  const filas = useMemo(() => {
    const reales = [...mapaReales.keys()]
    // Una materia con nota hipotética deja de estar «disponible» al aprobarse en el escenario, pero su fila debe seguir ahí.
    const proyectables = [...new Set([...predicciones.map((p) => p.materia), ...Object.keys(ajustes)])].filter((id) => !mapaReales.has(id))
    const ordenar = (ids: string[]) => ids.sort((a, b) => semestreDe(a) - semestreDe(b) || a.localeCompare(b))
    return { reales: ordenar(reales), proyectables: ordenar(proyectables) }
  }, [mapaReales, predicciones, ajustes, materiaPorId])

  const buscar = useCallback(
    (ids: string[]) => (busqueda.trim() ? filtrarDifuso(ids, busqueda, (id) => `${nombreDe(id)} ${id}`) : ids),
    [busqueda, nombreDe],
  )
  const visiblesReales = buscar(filas.reales)
  const visiblesProyectables = buscar(filas.proyectables)

  const baseMap = useMemo(() => new Map(prediccionesBase.map((p) => [p.materia, p])), [prediccionesBase])
  const deltas = useMemo(() => deltasPredicciones(prediccionesBase, predicciones), [prediccionesBase, predicciones])
  const cambios = useMemo(() => cambiosDisponibilidad(prediccionesBase, predicciones), [prediccionesBase, predicciones])
  const hayAjustes = Object.keys(ajustes).length > 0

  // Anuncia el resultado a lectores de pantalla sin saturar: una frase, cuando el usuario deja de mover.
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    const t = setTimeout(() => {
      if (!escenario.hipotetico) return setAnuncio('Escenario restaurado: vuelves a ver tus notas reales.')
      const partes = [`${plural(deltas.filter((d) => !d.nueva).length, 'predicción cambia', 'predicciones cambian')}`]
      if (cambios.nuevas.length > 0) partes.push(`se desbloquea${cambios.nuevas.length > 1 ? 'n' : ''} ${plural(cambios.nuevas.length, 'materia', 'materias')}`)
      setAnuncio(`Escenario actualizado: ${partes.join('; ')}.`)
    }, 700)
    return () => clearTimeout(t)
  }, [deltas, cambios, escenario.hipotetico])

  const alCambiar = useCallback((id: string, nota: number) => fijarAjuste(id, nota), [fijarAjuste])
  const alRestaurar = useCallback((id: string) => quitarAjuste(id), [quitarAjuste])

  if (mapaReales.size === 0) {
    return (
      <div className="insp-vacio">
        <p className="insp-vacio-titulo">¿Qué pasaría si…?</p>
        <p className="ayuda">Primero carga tus notas. Después podrás mover una nota, o probar una para una materia que aún no cursas, y ver cómo cambian tus predicciones.</p>
        <button type="button" className="btn" onClick={() => irA({ tipo: 'vista', vista: 'notas' })}>
          Cargar mis notas
        </button>
      </div>
    )
  }

  const hipoteticaDe = (id: string) => escenario.hipoteticas.has(id)
  const filaDe = (id: string) => {
    const prediccion = baseMap.get(id) ?? escenario.prediccionPorId.get(id)
    return (
      <Fila
        key={id}
        id={id}
        nombre={nombreDe(id)}
        valor={mapaNotas.get(id) ?? null}
        real={mapaReales.get(id) ?? null}
        esperada={prediccion ? redondear(prediccion.nota) : null}
        ajustada={hipoteticaDe(id) || id in ajustes}
        onCambiar={alCambiar}
        onRestaurar={alRestaurar}
      />
    )
  }

  return (
    <div className="sim">
      <p className="ayuda">
        Mueve una nota para simular otro escenario. Lo que importaste no cambia: estos ajustes son solo una hipótesis y se pueden restaurar.
      </p>

      <div className="sim-barra">
        <label className="sim-buscar">
          <Search size={14} strokeWidth={1.5} aria-hidden="true" />
          <span className="solo-lectores">Buscar materia en el simulador</span>
          <input type="text" placeholder="Buscar materia…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <button type="button" className="btn" disabled={!hayAjustes} onClick={restaurarAjustes}>
          <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
          Restaurar todo
        </button>
      </div>

      <p className="solo-lectores" role="status" aria-live="polite">
        {anuncio}
      </p>

      {hayAjustes && (
        <section className="sim-resultado" aria-labelledby="sim-cambios">
          <h3 id="sim-cambios">Cómo cambian tus predicciones</h3>
          {cambios.nuevas.length > 0 && (
            <p className="sim-desbloqueo">
              <strong>Se desbloquean:</strong> {cambios.nuevas.map(nombreDe).join(', ')}.
            </p>
          )}
          {cambios.perdidas.length > 0 && (
            <p className="sim-desbloqueo">
              <strong>Dejan de estar disponibles:</strong> {cambios.perdidas.map(nombreDe).join(', ')}.
            </p>
          )}
          {deltas.length === 0 ? (
            <p className="ayuda">Este escenario no mueve ninguna predicción de forma apreciable.</p>
          ) : (
            <ul className="sim-deltas">
              {deltas.slice(0, 10).map((d) => (
                <li key={d.materia}>
                  <span className="sim-delta-nombre">{nombreDe(d.materia)}</span>
                  {d.nueva ? (
                    <span className="mono sim-delta-valor">nueva · ≈ {fmtNotaCorta(d.despues)}</span>
                  ) : (
                    <>
                      <span className="mono sim-delta-valor">
                        {fmtNotaCorta(d.antes)} → {fmtNotaCorta(d.despues)}
                      </span>
                      <Delta valor={d.delta} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {deltas.length > 10 && <p className="ayuda">…y {deltas.length - 10} más.</p>}
        </section>
      )}

      <section aria-labelledby="sim-reales">
        <h3 id="sim-reales" className="sim-titulo">
          Tus notas <span className="ayuda">({visiblesReales.length})</span>
        </h3>
        {visiblesReales.length === 0 ? <p className="ayuda">Ninguna coincide con la búsqueda.</p> : <ul className="sim-lista">{visiblesReales.map(filaDe)}</ul>}
      </section>

      <section aria-labelledby="sim-proyeccion">
        <h3 id="sim-proyeccion" className="sim-titulo">
          Materias que puedes inscribir <span className="ayuda">({visiblesProyectables.length})</span>
        </h3>
        <p className="ayuda">Asigna una nota hipotética a una de estas y mira qué materias se desbloquean.</p>
        {visiblesProyectables.length === 0 ? (
          <p className="ayuda">{filas.proyectables.length === 0 ? 'No hay materias disponibles por ahora.' : 'Ninguna coincide con la búsqueda.'}</p>
        ) : (
          <ul className="sim-lista">{visiblesProyectables.map(filaDe)}</ul>
        )}
      </section>

      <p className="ayuda">Malla {malla.version}. Las notas hipotéticas no se guardan ni se exportan.</p>
    </div>
  )
}
