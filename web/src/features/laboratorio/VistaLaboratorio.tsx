// Laboratorio de grafos (para la sustentación de Matemáticas Discretas): conceptos explicados sobre
// la malla real. Pensado para proyectarse: un solo grafo grande, un concepto a la vez, con controles
// de reproducción para el algoritmo de Kahn.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Info, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { GrafoSvg, type AristaSvg, type NodoSvg, type TonoNodo } from '../../components/GrafoSvg'
import { Tip } from '../../components/Tip'
import { descendientes } from '../../lib/graph/dag'
import { aristasDeCamino, claveArista, cuellosDeBotella } from '../../lib/ui/grafo'
import { fmtNota } from '../../lib/ui/formato'
import { layoutSemestres } from '../../lib/ui/layoutMalla'
import { pasosKahn } from '../../lib/ui/kahn'
import { useApp } from '../../store/app'
import { useDatos } from '../../store/escenario'
import './laboratorio.css'

type Concepto = 'kahn' | 'cadena' | 'cuellos' | 'salida' | 'descendientes'

const CONCEPTOS: { id: Concepto; titulo: string; corto: string }[] = [
  { id: 'kahn', titulo: 'Orden topológico', corto: 'Orden' },
  { id: 'cadena', titulo: 'Cadena crítica', corto: 'Cadena' },
  { id: 'cuellos', titulo: 'Cuellos de botella', corto: 'Cuellos' },
  { id: 'salida', titulo: 'Grado de salida', corto: 'Salida' },
  { id: 'descendientes', titulo: 'Descendientes', corto: 'Descendientes' },
]

const TEXTOS: Record<Concepto, { explicacion: string; formal: string }> = {
  kahn: {
    explicacion:
      'Ordena las materias para que cada una aparezca después de todos sus prerrequisitos. Se parte de las que no piden nada y se van retirando, liberando a las que dependían de ellas.',
    formal:
      'Un orden topológico de un DAG G = (V, E) es una permutación de V tal que, para toda arista (u, v) ∈ E, u precede a v. El algoritmo de Kahn retira de una cola un nodo con grado de entrada 0 y resta 1 al grado de sus sucesores; los que llegan a 0 entran a la cola. Cuesta O(|V| + |E|). Si quedan nodos sin retirar, hay un ciclo.',
  },
  cadena: {
    explicacion:
      'Es la cadena de prerrequisitos más larga: una materia detrás de otra, sin atajos. Su largo es el mínimo de semestres para recorrerla, así que atrasarte en una de ellas retrasa la carrera.',
    formal:
      'Camino de longitud máxima en un DAG. Se calcula por programación dinámica recorriendo los nodos en orden topológico: L(v) = 1 + máx L(u) sobre los predecesores u de v (y L(v) = 1 si no tiene). El camino se reconstruye desde el nodo con mayor L.',
  },
  cuellos: {
    explicacion:
      'Mide por cuántos de los caminos más cortos entre otras dos materias pasa cada una. Las que más suman son puentes: si cuestan, se frenan muchas rutas de la carrera.',
    formal:
      'Centralidad de intermediación: C_B(v) = Σ σ_st(v) / σ_st sobre los pares s ≠ v ≠ t, donde σ_st es el número de caminos más cortos de s a t y σ_st(v) cuántos de ellos pasan por v. Se calcula con el algoritmo de Brandes en O(|V|·|E|).',
  },
  salida: {
    explicacion:
      'Cuenta cuántas materias abre directamente cada una. Un grado de salida alto significa que muchas materias están esperando a que la apruebes.',
    formal: 'Grado de salida de un nodo v en un grafo dirigido: deg⁺(v) = |{ w : (v, w) ∈ E }|, el número de aristas que salen de v.',
  },
  descendientes: {
    explicacion:
      'Son todas las materias que dependen de la elegida, directa o indirectamente. Muestra qué tan lejos llega aprobarla… o no hacerlo a tiempo.',
    formal:
      'Conjunto de nodos alcanzables desde v siguiendo aristas dirigidas (cierre transitivo): Desc(v) = { w : existe un camino v → … → w }. Se obtiene con una búsqueda en profundidad desde los sucesores de v.',
  },
}

const ESCALA_X = 0.5
const ESCALA_Y = 0.62
const MARGEN = { x: 36, arriba: 34, abajo: 40 }
const VELOCIDADES = [
  { ms: 1400, etiqueta: 'Lenta' },
  { ms: 700, etiqueta: 'Normal' },
  { ms: 300, etiqueta: 'Rápida' },
]

function Ranking({ items, formato, seleccionada, onElegir }: { items: { id: string; nombre: string; valor: number }[]; formato: (v: number) => string; seleccionada: string | null; onElegir: (id: string) => void }) {
  const maximo = Math.max(1e-9, ...items.map((i) => i.valor))
  return (
    <ol className="lab-ranking">
      {items.map((i) => (
        <li key={i.id}>
          <button type="button" className={`lab-ranking-fila${seleccionada === i.id ? ' lab-ranking-sel' : ''}`} onClick={() => onElegir(i.id)}>
            <span className="lab-ranking-nombre">{i.nombre}</span>
            <span className="lab-ranking-pista" aria-hidden="true">
              <span className="lab-ranking-barra" style={{ width: `${(i.valor / maximo) * 100}%` }} />
            </span>
            <span className="mono lab-ranking-valor">{formato(i.valor)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export default function VistaLaboratorio() {
  const { malla, orden, camino, intermediacion: inter, salida, materiaPorId } = useDatos()
  const seleccionada = useApp((s) => s.seleccionada)
  const seleccionar = useApp((s) => s.seleccionar)
  const [concepto, setConcepto] = useState<Concepto>('kahn')
  const [paso, setPaso] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const idTab = useId()
  const nombreDe = useCallback((id: string) => materiaPorId.get(id)?.nombre ?? id, [materiaPorId])

  // ---- Datos de cada concepto ----
  const pasos = useMemo(() => pasosKahn(malla), [malla])
  const layout = useMemo(() => layoutSemestres(malla, orden), [malla, orden])
  const posiciones = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    const ys = [...layout.centros.values()].map((c) => c.y)
    const minY = Math.min(...ys)
    for (const [id, c] of layout.centros) m.set(id, { x: MARGEN.x + c.x * ESCALA_X, y: MARGEN.arriba + (c.y - minY) * ESCALA_Y })
    return m
  }, [layout])
  const ancho = useMemo(() => Math.max(...[...posiciones.values()].map((p) => p.x)) + MARGEN.x, [posiciones])
  const alto = useMemo(() => Math.max(...[...posiciones.values()].map((p) => p.y)) + MARGEN.abajo, [posiciones])
  const columnas = useMemo(() => layout.encabezados.map((c) => ({ x: MARGEN.x + c.x * ESCALA_X, texto: `Sem. ${c.semestre}` })), [layout])

  const ranking = useMemo(() => {
    const top = (datos: Record<string, number>, n = 10) =>
      Object.entries(datos)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, n)
        .map(([id, valor]) => ({ id, nombre: nombreDe(id), valor }))
    return { cuellos: top(inter), salida: top(salida) }
  }, [inter, salida, nombreDe])
  const top5Cuellos = useMemo(() => new Set(cuellosDeBotella(inter)), [inter])
  const maxInter = Math.max(1e-9, ...Object.values(inter))
  const maxSalida = Math.max(1, ...Object.values(salida))

  const foco = concepto === 'descendientes' ? (seleccionada && materiaPorId.has(seleccionada) ? seleccionada : null) : null
  const desc = useMemo(() => (foco ? new Set(descendientes(malla, foco)) : new Set<string>()), [malla, foco])
  const aristasCamino = useMemo(() => aristasDeCamino(camino), [camino])
  const enCamino = useMemo(() => new Set(camino), [camino])

  // ---- Reproducción del algoritmo de Kahn ----
  const pasoActual = pasos[Math.min(paso, pasos.length - 1)]
  const terminado = paso >= pasos.length - 1
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!reproduciendo || concepto !== 'kahn') return
    if (terminado) {
      setReproduciendo(false)
      return
    }
    temporizador.current = setTimeout(() => setPaso((p) => Math.min(p + 1, pasos.length - 1)), VELOCIDADES[velocidad].ms)
    return () => clearTimeout(temporizador.current)
  }, [reproduciendo, paso, terminado, concepto, velocidad, pasos.length])

  const reiniciar = () => {
    setReproduciendo(false)
    setPaso(0)
  }
  const alternarReproduccion = () => {
    if (terminado) {
      setPaso(0)
      setReproduciendo(true)
    } else setReproduciendo((r) => !r)
  }

  // ---- Nodos y aristas según el concepto ----
  const { nodos, aristas } = useMemo(() => {
    const colaActual = new Set(pasoActual.cola)
    const hechos = new Set(pasoActual.orden)
    const nodos: NodoSvg[] = malla.materias.map((m) => {
      const p = posiciones.get(m.id)!
      let tono: TonoNodo = 'normal'
      let etiqueta: string | undefined
      let radio = 8
      let descripcion = `${m.nombre} (${m.id}), semestre ${m.semestre}`
      switch (concepto) {
        case 'kahn':
          if (pasoActual.sale === m.id) tono = 'actual'
          else if (hechos.has(m.id)) tono = 'hecho'
          else if (colaActual.has(m.id)) tono = 'cola'
          else tono = 'atenuado'
          if (tono === 'actual' || tono === 'cola') etiqueta = m.id
          if (tono === 'actual') radio = 10
          descripcion += `, grado de entrada ${pasoActual.entrada[m.id]}`
          break
        case 'cadena':
          tono = enCamino.has(m.id) ? 'resaltado' : 'atenuado'
          if (enCamino.has(m.id)) etiqueta = m.id
          break
        case 'cuellos':
          radio = 4 + 10 * ((inter[m.id] ?? 0) / maxInter)
          tono = top5Cuellos.has(m.id) ? 'resaltado' : 'normal'
          if (top5Cuellos.has(m.id)) etiqueta = m.id
          descripcion += `, intermediación ${fmtNota(inter[m.id] ?? 0, 1)}`
          break
        case 'salida':
          radio = 4 + 10 * ((salida[m.id] ?? 0) / maxSalida)
          tono = (salida[m.id] ?? 0) >= maxSalida - 1 && (salida[m.id] ?? 0) > 0 ? 'resaltado' : 'normal'
          if (tono === 'resaltado') etiqueta = m.id
          descripcion += `, abre ${salida[m.id] ?? 0} materias`
          break
        case 'descendientes':
          if (!foco) tono = 'normal'
          else if (m.id === foco) {
            tono = 'actual'
            etiqueta = m.id
            radio = 10
          } else tono = desc.has(m.id) ? 'resaltado' : 'atenuado'
          break
      }
      return { id: m.id, x: p.x, y: p.y, tono, etiqueta, radio, descripcion }
    })

    const aristas: AristaSvg[] = malla.prerrequisitos.map((e) => {
      const base: AristaSvg = { de: e.de, a: e.a }
      switch (concepto) {
        case 'kahn':
          if (pasoActual.sale === e.de) return { ...base, resaltada: true }
          return { ...base, atenuada: !pasoActual.orden.includes(e.de) && !pasoActual.cola.includes(e.de) }
        case 'cadena':
          return aristasCamino.has(claveArista(e.de, e.a)) ? { ...base, resaltada: true } : { ...base, atenuada: true }
        case 'descendientes': {
          if (!foco) return base
          const dentro = (id: string) => id === foco || desc.has(id)
          return dentro(e.de) && dentro(e.a) ? { ...base, resaltada: true } : { ...base, atenuada: true }
        }
        default:
          return { ...base, atenuada: true }
      }
    })
    return { nodos, aristas }
  }, [malla, posiciones, concepto, pasoActual, enCamino, aristasCamino, inter, maxInter, top5Cuellos, salida, maxSalida, foco, desc])

  const texto = TEXTOS[concepto]
  const info = CONCEPTOS.find((c) => c.id === concepto)!

  // ---- Frase que acompaña cada paso (se anuncia a lectores de pantalla cuando no se reproduce) ----
  const cambios = useMemo(() => {
    const previo = pasos[Math.max(0, paso - 1)]
    return Object.keys(pasoActual.entrada).filter((id) => paso > 0 && previo.entrada[id] !== pasoActual.entrada[id])
  }, [pasos, paso, pasoActual])
  const fraseKahn =
    paso === 0
      ? `Inicio: ${pasoActual.cola.length} materias no piden ningún prerrequisito y esperan en la cola.`
      : `Paso ${paso} de ${pasos.length - 1}: sale ${nombreDe(pasoActual.sale!)}. ${
          pasoActual.liberadas.length > 0 ? `Entran a la cola: ${pasoActual.liberadas.map(nombreDe).join(', ')}.` : 'No libera a ninguna materia nueva.'
        }`

  return (
    <div className="lab">
      <header className="lab-cabecera">
        <h1 className="lab-titulo">Laboratorio de grafos</h1>
        <p className="ayuda">La malla es un grafo dirigido sin ciclos (DAG). Estos son los conceptos de teoría de grafos que usa Gradly, sobre tu malla real.</p>
      </header>

      <div className="lab-conceptos" role="tablist" aria-label="Conceptos">
        {CONCEPTOS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            id={`${idTab}-${c.id}`}
            aria-selected={concepto === c.id}
            aria-controls={`${idTab}-panel`}
            tabIndex={concepto === c.id ? 0 : -1}
            className={`lab-concepto${concepto === c.id ? ' lab-concepto-activo' : ''}`}
            onClick={() => setConcepto(c.id)}
            onKeyDown={(e) => {
              const i = CONCEPTOS.findIndex((x) => x.id === concepto)
              const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
              if (!d) return
              e.preventDefault()
              const sig = CONCEPTOS[(i + d + CONCEPTOS.length) % CONCEPTOS.length]
              setConcepto(sig.id)
              requestAnimationFrame(() => document.getElementById(`${idTab}-${sig.id}`)?.focus())
            }}
          >
            {c.titulo}
          </button>
        ))}
      </div>

      <div className="lab-panel" role="tabpanel" id={`${idTab}-panel`} aria-labelledby={`${idTab}-${concepto}`}>
        <div className="lab-explica">
          <p>{texto.explicacion}</p>
          <Tip texto={texto.formal} side="bottom">
            <button type="button" className="btn btn-fantasma lab-def" aria-label={`Definición formal de ${info.titulo}`}>
              <Info size={14} strokeWidth={1.5} aria-hidden="true" /> Definición formal
            </button>
          </Tip>
        </div>

        {concepto === 'kahn' && (
          <div className="lab-controles" role="group" aria-label="Controles de reproducción">
            <button type="button" className="btn btn-fantasma" onClick={reiniciar} aria-label="Volver al inicio">
              <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-fantasma" onClick={() => { setReproduciendo(false); setPaso((p) => Math.max(0, p - 1)) }} disabled={paso === 0} aria-label="Paso anterior">
              <SkipBack size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-primario" onClick={alternarReproduccion}>
              {reproduciendo ? <Pause size={16} strokeWidth={1.5} aria-hidden="true" /> : <Play size={16} strokeWidth={1.5} aria-hidden="true" />}
              {reproduciendo ? 'Pausar' : terminado ? 'Repetir' : 'Reproducir'}
            </button>
            <button type="button" className="btn btn-fantasma" onClick={() => { setReproduciendo(false); setPaso((p) => Math.min(pasos.length - 1, p + 1)) }} disabled={terminado} aria-label="Paso siguiente">
              <SkipForward size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <label className="lab-velocidad">
              Velocidad
              <select value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))}>
                {VELOCIDADES.map((v, i) => (
                  <option key={v.etiqueta} value={i}>
                    {v.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <span className="mono lab-paso">
              {paso} / {pasos.length - 1}
            </span>
          </div>
        )}

        {concepto === 'descendientes' && (
          <div className="lab-controles">
            <label className="lab-velocidad">
              Materia
              <select value={foco ?? ''} onChange={(e) => seleccionar(e.target.value || null)}>
                <option value="">Elige una materia…</option>
                {malla.materias.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="lab-escenario">
          <div className="lab-grafo">
            <GrafoSvg
              nodos={nodos}
              aristas={aristas}
              ancho={ancho}
              alto={alto}
              columnas={columnas}
              tamanoEtiqueta={13}
              etiqueta={`Malla como grafo: ${info.titulo}`}
              onElegir={(id) => seleccionar(id)}
            />
          </div>

          <aside className="lab-lateral" aria-label={`Detalle de ${info.titulo}`}>
            {concepto === 'kahn' && (
              <>
                <p className="lab-frase" role="status" aria-live={reproduciendo ? 'off' : 'polite'}>
                  {fraseKahn}
                </p>
                <h3>Cola ({pasoActual.cola.length})</h3>
                {pasoActual.cola.length > 0 ? (
                  <ul className="lab-fichas">
                    {pasoActual.cola.map((id, i) => (
                      <li key={id} className={i === 0 ? 'lab-ficha lab-ficha-sale' : 'lab-ficha'} title={nombreDe(id)}>
                        <span className="mono">{id}</span>
                        {i === 0 && !terminado && <span className="lab-ficha-nota">sale ahora</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ayuda">{terminado ? 'La cola quedó vacía: todas las materias tienen su lugar.' : 'Vacía.'}</p>
                )}
                {cambios.length > 0 && (
                  <>
                    <h3>Grados de entrada que bajaron</h3>
                    <ul className="lab-cambios">
                      {cambios.map((id) => (
                        <li key={id}>
                          <span className="mono">{id}</span>{' '}
                          <span className="mono lab-cambio">
                            {pasos[paso - 1].entrada[id]} → {pasoActual.entrada[id]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <h3>Orden construido ({pasoActual.orden.length})</h3>
                {pasoActual.orden.length > 0 ? (
                  <ol className="lab-orden">
                    {pasoActual.orden.map((id) => (
                      <li key={id} title={nombreDe(id)}>
                        <span className="mono">{id}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="ayuda">Aún no ha salido ninguna.</p>
                )}
              </>
            )}

            {concepto === 'cadena' && (
              <>
                <p className="lab-dato">
                  <span className="mono lab-dato-valor">{camino.length}</span> materias encadenadas: el mínimo de semestres para completar esta ruta.
                </p>
                <ol className="lab-cadena">
                  {camino.map((id) => (
                    <li key={id}>
                      <button type="button" className="materia-enlace" onClick={() => seleccionar(id)}>
                        {nombreDe(id)}
                      </button>
                      <span className="mono materia-codigo">
                        {id} · sem. {materiaPorId.get(id)?.semestre}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {concepto === 'cuellos' && (
              <>
                <p className="ayuda">Las cinco más altas están marcadas en el grafo; el tamaño del nodo sigue la intermediación.</p>
                <Ranking items={ranking.cuellos} formato={(v) => fmtNota(v, 1)} seleccionada={seleccionada} onElegir={seleccionar} />
              </>
            )}

            {concepto === 'salida' && (
              <>
                <p className="ayuda">El tamaño del nodo sigue cuántas materias abre directamente.</p>
                <Ranking items={ranking.salida} formato={(v) => String(v)} seleccionada={seleccionada} onElegir={seleccionar} />
              </>
            )}

            {concepto === 'descendientes' &&
              (foco ? (
                <>
                  <p className="lab-dato">
                    <strong>{nombreDe(foco)}</strong> tiene <span className="mono lab-dato-valor">{desc.size}</span>{' '}
                    {desc.size === 1 ? 'materia que depende' : 'materias que dependen'} de ella.
                  </p>
                  {desc.size > 0 && (
                    <ul className="lab-fichas">
                      {[...desc].sort().map((id) => (
                        <li key={id} className="lab-ficha" title={nombreDe(id)}>
                          <span className="mono">{id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="ayuda">Elige una materia en la lista o haciendo clic en el grafo para ver todo lo que depende de ella.</p>
              ))}
          </aside>
        </div>
      </div>
    </div>
  )
}
