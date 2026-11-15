// Arista «flotante»: une los bordes de los círculos (no puntos fijos), así se ve bien tanto en
// columnas por semestre como en la disposición orgánica. Curva suave y flecha pequeña.

import { memo } from 'react'
import { BaseEdge, getBezierPath, Position, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react'
import { centroDesdeEsquina } from './geometria'
import type { NodoMateriaTipo } from './NodoMateria'

export interface DatosArista extends Record<string, unknown> {
  blanda: boolean
  critica: boolean
  /** Cadena crítica con flujo animado. */
  flujo: boolean
  modo: 'normal' | 'resaltada' | 'atenuada'
}

export type AristaMateriaTipo = Edge<DatosArista, 'materia'>

function centro(n: InternalNode<NodoMateriaTipo>) {
  return centroDesdeEsquina(n.internals.positionAbsolute, n.data.radio)
}

function AristaMateriaBase({ id, source, target, data, markerEnd }: EdgeProps<AristaMateriaTipo>) {
  const s = useInternalNode<NodoMateriaTipo>(source)
  const t = useInternalNode<NodoMateriaTipo>(target)
  if (!s || !t) return null

  const a = centro(s)
  const b = centro(t)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const ux = dx / d
  const uy = dy / d
  // Sale del borde del círculo de origen y llega al borde del destino (dejando sitio a la flecha).
  const sx = a.x + ux * (s.data.radio + 2)
  const sy = a.y + uy * (s.data.radio + 2)
  const tx = b.x - ux * (t.data.radio + 3)
  const ty = b.y - uy * (t.data.radio + 3)
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const [ruta] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: horizontal ? (dx >= 0 ? Position.Right : Position.Left) : dy >= 0 ? Position.Bottom : Position.Top,
    targetPosition: horizontal ? (dx >= 0 ? Position.Left : Position.Right) : dy >= 0 ? Position.Top : Position.Bottom,
    curvature: 0.28,
  })

  const clases = [
    'arista',
    data?.blanda && 'arista-blanda',
    data?.critica && 'arista-critica',
    data?.flujo && 'arista-flujo',
    data?.modo === 'resaltada' && 'arista-resaltada',
    data?.modo === 'atenuada' && 'arista-atenuada',
  ]
    .filter(Boolean)
    .join(' ')

  return <BaseEdge id={id} path={ruta} markerEnd={markerEnd} className={clases} interactionWidth={0} />
}

export const AristaMateria = memo(AristaMateriaBase)
