// Explorador de materias: árbol agrupado por semestre, como un explorador de archivos.
// Rol ARIA «tree» con navegación por flechas; sincronizado con el grafo (store.seleccionada).

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronRight, CircleX, Lock, Search, X } from 'lucide-react'
import { IconoSemaforo } from '../../components/Semaforo'
import { estadoMateria, ETIQUETA_SEMAFORO, valorMateria, type EstadoMateria } from '../../lib/ui/estado'
import { filtrarDifuso } from '../../lib/ui/fuzzy'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { abrirMateria } from './acciones'
import './explorador.css'

type Filtro = 'todas' | 'disponibles' | 'riesgo' | 'aprobadas'

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'disponibles', etiqueta: 'Disponibles' },
  { id: 'riesgo', etiqueta: 'En riesgo' },
  { id: 'aprobadas', etiqueta: 'Aprobadas' },
]

function cumpleFiltro(filtro: Filtro, e: EstadoMateria): boolean {
  switch (filtro) {
    case 'todas':
      return true
    case 'disponibles':
      return e.tipo === 'disponible'
    case 'riesgo':
      return e.tipo === 'disponible' && e.prediccion?.semaforo !== 'verde'
    case 'aprobadas':
      return e.tipo === 'aprobada'
  }
}

/** Texto hablado del estado (los íconos son decorativos). */
function textoEstado(e: EstadoMateria): string {
  switch (e.tipo) {
    case 'aprobada':
      return 'Aprobada'
    case 'reprobada':
      return 'Por repetir'
    case 'bloqueada':
      return 'Bloqueada: faltan prerrequisitos'
    case 'disponible':
      return e.prediccion ? ETIQUETA_SEMAFORO[e.prediccion.semaforo] : 'Disponible'
  }
}

function IconoEstado({ estado }: { estado: EstadoMateria }) {
  switch (estado.tipo) {
    case 'aprobada':
      return <Check size={14} strokeWidth={2} className="exp-ico exp-ico-aprobada" aria-hidden="true" />
    case 'reprobada':
      return <CircleX size={14} strokeWidth={1.75} className="exp-ico exp-ico-reprobada" aria-hidden="true" />
    case 'bloqueada':
      return <Lock size={13} strokeWidth={1.5} className="exp-ico exp-ico-bloqueada" aria-hidden="true" />
    case 'disponible':
      return estado.prediccion ? (
        <IconoSemaforo nivel={estado.prediccion.semaforo} />
      ) : (
        <span className="exp-ico" aria-hidden="true" />
      )
  }
}

/** Busca un elemento del árbol por su clave (sin selectores CSS: las claves son datos). */
function buscarItem(raiz: HTMLElement | null, clave: string): HTMLElement | undefined {
  return [...(raiz?.querySelectorAll<HTMLElement>('[data-key]') ?? [])].find((el) => el.dataset.key === clave)
}

interface NodoPlano {
  key: string
  tipo: 'sem' | 'mat'
  semestre: number
  id?: string
}

export function Explorador() {
  const { malla } = useDatos()
  const escenario = useEscenario()
  const seleccionada = useApp((s) => s.seleccionada)
  const seleccionar = useApp((s) => s.seleccionar)

  const idBusqueda = useId()
  const [consulta, setConsulta] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [colapsados, setColapsados] = useState<ReadonlySet<number>>(new Set())
  const [foco, setFoco] = useState<string | null>(null)
  const arbol = useRef<HTMLUListElement>(null)

  const estados = useMemo(
    () =>
      new Map(malla.materias.map((m) => [m.id, estadoMateria(m.id, malla, escenario.mapaNotas, escenario.prediccionPorId)])),
    [malla, escenario.mapaNotas, escenario.prediccionPorId],
  )

  const filtrando = consulta.trim() !== '' || filtro !== 'todas'

  const grupos = useMemo(() => {
    const porSemestre = new Map<number, typeof malla.materias>()
    for (const m of malla.materias) porSemestre.set(m.semestre, [...(porSemestre.get(m.semestre) ?? []), m])
    return [...porSemestre]
      .sort((a, b) => a[0] - b[0])
      .map(([semestre, materias]) => {
        const porFiltro = materias.filter((m) => cumpleFiltro(filtro, estados.get(m.id)!))
        const visibles = filtrarDifuso(porFiltro, consulta, (m) => `${m.nombre} ${m.id}`)
        return { semestre, total: materias.length, materias: visibles }
      })
      .filter((g) => !filtrando || g.materias.length > 0)
  }, [malla, estados, consulta, filtro, filtrando])

  const totalVisibles = grupos.reduce((n, g) => n + g.materias.length, 0)
  // Al filtrar se expanden todos los semestres con resultados.
  const abierto = (semestre: number) => filtrando || !colapsados.has(semestre)

  const plano = useMemo<NodoPlano[]>(
    () =>
      grupos.flatMap((g) => [
        { key: `s${g.semestre}`, tipo: 'sem' as const, semestre: g.semestre },
        ...(abierto(g.semestre)
          ? g.materias.map((m) => ({ key: `m${m.id}`, tipo: 'mat' as const, semestre: g.semestre, id: m.id }))
          : []),
      ]),
    [grupos, colapsados, filtrando],
  )

  // Un solo elemento del árbol es tabulable (tabindex móvil): el enfocado, el seleccionado o el primero.
  const claveSeleccion = seleccionada ? `m${seleccionada}` : null
  const claveTab =
    (foco && plano.some((n) => n.key === foco) && foco) ||
    (claveSeleccion && plano.some((n) => n.key === claveSeleccion) && claveSeleccion) ||
    plano[0]?.key ||
    null

  // Sincronía con el grafo: al seleccionar desde fuera, expande su semestre y lo deja a la vista.
  useEffect(() => {
    if (!seleccionada) return
    const materia = malla.materias.find((m) => m.id === seleccionada)
    if (!materia) return
    setColapsados((c) => (c.has(materia.semestre) ? new Set([...c].filter((s) => s !== materia.semestre)) : c))
    buscarItem(arbol.current, `m${seleccionada}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [seleccionada, malla])

  function enfocar(key: string) {
    setFoco(key)
    requestAnimationFrame(() => {
      buscarItem(arbol.current, key)?.focus()
    })
  }

  function alternarSemestre(semestre: number) {
    setColapsados((c) => {
      const n = new Set(c)
      if (n.has(semestre)) n.delete(semestre)
      else n.add(semestre)
      return n
    })
  }

  function alTeclear(e: KeyboardEvent<HTMLUListElement>) {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
    if (!item || e.altKey || e.ctrlKey || e.metaKey) return
    const key = item.dataset.key!
    const i = plano.findIndex((n) => n.key === key)
    if (i < 0) return
    const nodo = plano[i]

    switch (e.key) {
      case 'ArrowDown':
        if (i < plano.length - 1) enfocar(plano[i + 1].key)
        break
      case 'ArrowUp':
        if (i > 0) enfocar(plano[i - 1].key)
        break
      case 'Home':
        enfocar(plano[0].key)
        break
      case 'End':
        enfocar(plano[plano.length - 1].key)
        break
      case 'ArrowRight':
        if (nodo.tipo === 'sem') {
          if (!abierto(nodo.semestre)) alternarSemestre(nodo.semestre)
          else if (plano[i + 1]?.tipo === 'mat') enfocar(plano[i + 1].key)
        }
        break
      case 'ArrowLeft':
        if (nodo.tipo === 'mat') enfocar(`s${nodo.semestre}`)
        else if (abierto(nodo.semestre) && !filtrando) alternarSemestre(nodo.semestre)
        break
      case 'Enter':
        if (nodo.tipo === 'sem') alternarSemestre(nodo.semestre)
        else abrirMateria(nodo.id!)
        break
      case ' ':
        if (nodo.tipo === 'sem') alternarSemestre(nodo.semestre)
        else seleccionar(nodo.id!)
        break
      default:
        return
    }
    e.preventDefault()
  }

  return (
    <div className="explorador">
      <header className="exp-cabecera">
        <h2 className="exp-titulo">Materias</h2>
        <span className="exp-conteo num" aria-live="polite">
          {filtrando ? `${totalVisibles} de ${malla.materias.length}` : malla.materias.length}
        </span>
      </header>

      <div className="exp-buscador">
        <Search size={14} strokeWidth={1.5} aria-hidden="true" />
        <label htmlFor={idBusqueda} className="solo-lectores">
          Buscar materia
        </label>
        <input
          id={idBusqueda}
          data-buscador="materias"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar materia…"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && consulta) {
              setConsulta('')
              e.stopPropagation()
            }
            if (e.key === 'ArrowDown' && plano[0]) {
              e.preventDefault()
              enfocar(plano[0].key)
            }
          }}
        />
        {consulta && (
          <button type="button" className="exp-limpiar" aria-label="Limpiar búsqueda" onClick={() => setConsulta('')}>
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="exp-chips" role="group" aria-label="Filtrar materias">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`exp-chip${filtro === f.id ? ' exp-chip-activo' : ''}`}
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {totalVisibles === 0 ? (
        <div className="exp-vacio">
          <p>Ninguna materia coincide con tu búsqueda.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConsulta('')
              setFiltro('todas')
            }}
          >
            Quitar filtros
          </button>
        </div>
      ) : (
        <ul className="exp-arbol" role="tree" aria-label="Materias por semestre" ref={arbol} onKeyDown={alTeclear}>
          {grupos.map((g) => {
            const claveSem = `s${g.semestre}`
            const expandido = abierto(g.semestre)
            return (
              <li key={g.semestre} role="none">
                <div
                  role="treeitem"
                  aria-level={1}
                  aria-expanded={expandido}
                  data-key={claveSem}
                  tabIndex={claveTab === claveSem ? 0 : -1}
                  className="exp-nodo exp-fila exp-fila-sem"
                  onClick={() => {
                    setFoco(claveSem)
                    alternarSemestre(g.semestre)
                  }}
                >
                  <ChevronRight size={14} strokeWidth={1.5} className={`exp-chevron${expandido ? ' exp-chevron-abierto' : ''}`} aria-hidden="true" />
                  <span className="exp-sem-nombre">Semestre {g.semestre}</span>{' '}
                  <span className="exp-conteo num">{filtrando ? g.materias.length : g.total}</span>{' '}
                  <span className="solo-lectores">materias</span>
                </div>
                {expandido && (
                  <ul role="group" className="exp-grupo" aria-label={`Materias del semestre ${g.semestre}`}>
                    {g.materias.map((m) => {
                      const estado = estados.get(m.id)!
                      const clave = `m${m.id}`
                      const valor = valorMateria(estado)
                      const esPrediccion = estado.tipo === 'disponible'
                      const hipotetica = escenario.hipoteticas.has(m.id)
                      return (
                        <li key={m.id} role="none">
                          <div
                            role="treeitem"
                            aria-level={2}
                            aria-selected={seleccionada === m.id}
                            data-key={clave}
                            tabIndex={claveTab === clave ? 0 : -1}
                            className={`exp-nodo exp-fila exp-fila-mat exp-${estado.tipo}${seleccionada === m.id ? ' exp-seleccionada' : ''}`}
                            onClick={() => {
                              setFoco(clave)
                              seleccionar(m.id)
                            }}
                            onDoubleClick={() => abrirMateria(m.id)}
                          >
                            <IconoEstado estado={estado} />
                            <span className="exp-nombre" title={`${m.nombre} · ${m.id}`}>
                              {m.nombre}
                            </span>
                            <span className="solo-lectores">
                              {`, ${textoEstado(estado)}${valor ? `, ${esPrediccion ? 'nota esperada' : 'nota'} ${valor}` : ''}${hipotetica ? ', hipotética' : ''}`}
                            </span>
                            {valor && (
                              <span className={`exp-valor num${esPrediccion ? ' exp-valor-pred' : ''}${hipotetica ? ' exp-valor-hip' : ''}`} aria-hidden="true">
                                {valor}
                              </span>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
