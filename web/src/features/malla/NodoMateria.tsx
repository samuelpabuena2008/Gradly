// Nodo de materia: círculo con etiqueta debajo. Cada estado tiene forma y glifo propios
// (no solo color): aprobada = relleno sólido + ✓, por repetir = aro discontinuo,
// disponible = aro del semáforo con brillo interior, bloqueada = atenuada con candado.

import { memo, type CSSProperties } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Check, Circle, Lock, TriangleAlert, X } from 'lucide-react'
import type { Materia } from '../../types'
import type { EstadoMateria } from '../../lib/ui/estado'
import { ETIQUETA_SEMAFORO } from '../../lib/ui/estado'
import { useNumeroAnimado } from '../../components/useNumeroAnimado'
import { ANCHO_NODO, MARGEN_NODO } from './geometria'

export interface DatosNodo extends Record<string, unknown> {
  materia: Materia
  estado: EstadoMateria
  radio: number
  seleccionada: boolean
  /** Fuera del foco actual (hover, búsqueda o descendientes): se atenúa. */
  atenuada: boolean
  /** Bajo el puntero: muestra la tarjeta con el nombre completo. */
  enfocada: boolean
  enCadena: boolean
  cuello: boolean
  /** Semestre para colorear por semestre; `null` = colorear por estado. */
  colorSemestre: number | null
  /** Retraso (ms) de la animación de encendido; `null` = sin animación. */
  retraso: number | null
}

export type NodoMateriaTipo = Node<DatosNodo, 'materia'>

function claseEstado(e: EstadoMateria): string {
  if (e.tipo === 'disponible') return e.prediccion ? `nodo-disponible nodo-${e.prediccion.semaforo}` : 'nodo-disponible'
  return `nodo-${e.tipo}`
}

function Glifo({ estado, tam }: { estado: EstadoMateria; tam: number }) {
  const p = { size: tam, 'aria-hidden': true as const }
  switch (estado.tipo) {
    case 'aprobada':
      return <Check {...p} strokeWidth={2.5} />
    case 'reprobada':
      return <X {...p} strokeWidth={2.25} />
    case 'bloqueada':
      return <Lock {...p} strokeWidth={1.75} />
    case 'disponible':
      if (!estado.prediccion) return null
      if (estado.prediccion.semaforo === 'verde') return <Check {...p} strokeWidth={2.5} />
      if (estado.prediccion.semaforo === 'amarillo') return <TriangleAlert {...p} strokeWidth={2} />
      return <Circle {...p} size={tam - 3} strokeWidth={1.5} fill="currentColor" />
  }
}

function textoEstado(e: EstadoMateria): string {
  switch (e.tipo) {
    case 'aprobada':
      return 'Aprobada'
    case 'reprobada':
      return 'Por repetir'
    case 'bloqueada':
      return 'Bloqueada'
    case 'disponible':
      return e.prediccion ? ETIQUETA_SEMAFORO[e.prediccion.semaforo] : 'Disponible'
  }
}

function numeroDe(e: EstadoMateria): number | null {
  const n = e.nota ?? e.prediccion?.nota
  return n !== undefined && Number.isFinite(n) ? n : null
}

function NodoMateriaBase({ data }: NodeProps<NodoMateriaTipo>) {
  const { materia, estado, radio: r, seleccionada, atenuada, enfocada, enCadena, cuello, colorSemestre, retraso } = data
  const animado = useNumeroAnimado(numeroDe(estado))
  const valor = animado === null ? null : animado.toFixed(1)
  const caja = 2 * (r + MARGEN_NODO)
  const c = caja / 2
  const esPrediccion = estado.tipo === 'disponible'

  const clases = [
    'nodo-materia',
    claseEstado(estado),
    seleccionada && 'nodo-seleccionada',
    atenuada && 'nodo-atenuada',
    enfocada && 'nodo-enfocada',
    enCadena && 'nodo-en-cadena',
    cuello && 'nodo-cuello',
    colorSemestre !== null && 'nodo-por-semestre',
    retraso !== null && 'nodo-encender',
  ]
    .filter(Boolean)
    .join(' ')

  const estilo = {
    width: ANCHO_NODO,
    '--c-sem': colorSemestre !== null ? `var(--sem-${colorSemestre})` : undefined,
    '--retraso': retraso !== null ? `${retraso}ms` : undefined,
  } as CSSProperties

  return (
    <div className={clases} style={estilo} data-materia={materia.id}>
      <Handle type="target" position={Position.Left} className="nodo-handle" style={{ top: c }} isConnectable={false} />
      <div className="nodo-figura" style={{ width: caja, height: caja }}>
        <svg width={caja} height={caja} viewBox={`0 0 ${caja} ${caja}`} aria-hidden="true">
          {cuello && <circle className="nodo-halo" cx={c} cy={c} r={r + 5.5} />}
          {seleccionada && <circle className="nodo-aro-sel" cx={c} cy={c} r={r + 3.5} />}
          <circle className="nodo-circulo" cx={c} cy={c} r={r} />
          {esPrediccion && <circle className="nodo-brillo" cx={c} cy={c} r={Math.max(2, r - 3)} />}
        </svg>
        <span className="nodo-glifo">
          <Glifo estado={estado} tam={r >= 15 ? 13 : 10} />
        </span>
        {cuello && <span className="nodo-insignia" aria-hidden="true" />}
      </div>
      <div className="nodo-etiqueta">
        <span className="nodo-nombre">{materia.nombre}</span>
        {valor !== null && <span className={`nodo-valor mono${esPrediccion ? ' nodo-valor-pred' : ''}`}>{esPrediccion ? `≈ ${valor}` : valor}</span>}
      </div>
      {enfocada && (
        <div className="nodo-tarjeta" role="presentation">
          <span className="nodo-tarjeta-nombre">{materia.nombre}</span>
          <span className="nodo-tarjeta-meta">
            <code>{materia.id}</code> · Sem. {materia.semestre} · {materia.creditos} cr.
          </span>
          <span className="nodo-tarjeta-estado">
            {textoEstado(estado)}
            {valor !== null && (
              <>
                {' · '}
                <span className="mono">{esPrediccion ? `esperada ${valor}` : valor}</span>
              </>
            )}
          </span>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="nodo-handle" style={{ top: c }} isConnectable={false} />
    </div>
  )
}

export const NodoMateria = memo(NodoMateriaBase)
