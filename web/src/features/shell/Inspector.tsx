// Inspector derecho: Detalle · Simulador · Análisis, según el contexto.

import { useRef, type KeyboardEvent } from 'react'
import { MousePointerClick, X } from 'lucide-react'
import { Semaforo } from '../../components/Semaforo'
import { estadoMateria, valorMateria } from '../../lib/ui/estado'
import { useApp, type TabInspector } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { AnalisisMalla } from '../malla/AnalisisMalla'
import { Simulador } from '../simulador/Simulador'
import { abrirMateria } from './acciones'

const TABS: { id: TabInspector; etiqueta: string }[] = [
  { id: 'detalle', etiqueta: 'Detalle' },
  { id: 'simulador', etiqueta: 'Simulador' },
  { id: 'analisis', etiqueta: 'Análisis' },
]

const pct = (p: number) => (Number.isFinite(p) ? `${Math.round(p * 100)} %` : '—')
const nota = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '—')

function Detalle() {
  const { malla, materiaPorId } = useDatos()
  const escenario = useEscenario()
  const seleccionada = useApp((s) => s.seleccionada)
  const materia = seleccionada ? materiaPorId.get(seleccionada) : undefined

  if (!materia) {
    return (
      <div className="insp-vacio">
        <MousePointerClick size={24} strokeWidth={1.25} aria-hidden="true" />
        <p className="insp-vacio-titulo">Elige una materia</p>
        <p className="ayuda">
          Elige una materia en el explorador o en el grafo para ver aquí su estado y su predicción. Con doble clic
          abres su página.
        </p>
      </div>
    )
  }

  const estado = estadoMateria(materia.id, malla, escenario.mapaNotas, escenario.prediccionPorId)
  const p = estado.prediccion
  return (
    <div className="insp-detalle">
      <h3 className="insp-materia">{materia.nombre}</h3>
      <p className="insp-meta">
        <span className="mono">{materia.id}</span> · Semestre {materia.semestre} · {materia.creditos} créditos
      </p>

      {estado.tipo === 'aprobada' && <p className="insp-estado">Aprobada con <span className="mono">{valorMateria(estado)}</span>.</p>}
      {estado.tipo === 'reprobada' && (
        <p className="insp-estado">
          Quedó en <span className="mono">{valorMateria(estado)}</span>. Cuenta el intento más reciente; puedes repetirla.
        </p>
      )}
      {estado.tipo === 'bloqueada' && <p className="insp-estado">Todavía le faltan prerrequisitos por aprobar.</p>}
      {p && (
        <div className="insp-prediccion">
          <Semaforo nivel={p.semaforo} />
          <dl className="insp-datos">
            <div>
              <dt>Nota esperada</dt>
              <dd className="mono">{nota(p.nota)}</dd>
            </div>
            <div>
              <dt>Rango probable</dt>
              <dd className="mono">
                {nota(p.rango[0])} – {nota(p.rango[1])}
              </dd>
            </div>
            <div>
              <dt>Probabilidad de no aprobar</dt>
              <dd className="mono">{pct(p.probNoAprobar)}</dd>
            </div>
          </dl>
          <p className="ayuda">Es una estimación, no una sentencia.</p>
        </div>
      )}
      <button type="button" className="btn" onClick={() => abrirMateria(materia.id)}>
        Abrir página de la materia
      </button>
    </div>
  )
}

function Analisis() {
  const { malla } = useDatos()
  const seleccionada = useApp((s) => s.seleccionada)
  return <AnalisisMalla malla={malla} seleccionada={seleccionada} />
}

export function Inspector() {
  const tab = useApp((s) => s.tabInspector)
  const elegirTab = useApp((s) => s.elegirTabInspector)
  const alternarInspector = useApp((s) => s.alternarInspector)
  const lista = useRef<HTMLDivElement>(null)

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const siguiente = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + delta + TABS.length) % TABS.length
    elegirTab(TABS[siguiente].id)
    requestAnimationFrame(() => lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')[siguiente]?.focus())
  }

  return (
    <div className="inspector">
      <div className="insp-cabecera">
        <div className="insp-tabs" role="tablist" aria-label="Secciones del inspector" ref={lista}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`insp-tab-${t.id}`}
              className={`insp-tab${tab === t.id ? ' insp-tab-activa' : ''}`}
              aria-selected={tab === t.id}
              aria-controls="insp-panel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => elegirTab(t.id)}
              onKeyDown={(e) => alTeclear(e, i)}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-fantasma tabbar-btn" aria-label="Cerrar inspector" onClick={() => alternarInspector(false)}>
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="insp-cuerpo" role="tabpanel" id="insp-panel" aria-labelledby={`insp-tab-${tab}`} tabIndex={0}>
        {tab === 'detalle' && <Detalle />}
        {tab === 'simulador' && <Simulador />}
        {tab === 'analisis' && <Analisis />}
      </div>
    </div>
  )
}
