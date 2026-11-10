// Malla como grafo interactivo: cada columna es un semestre.
// Materias cursadas muestran su nota; las disponibles, su predicción con el color del semáforo.

import { useMemo } from 'react'
import { Background, Controls, Position, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './malla.css'
import type { Malla, Prediccion } from '../../types'

interface Props {
  malla: Malla
  notas: Map<string, number>
  predicciones: Prediccion[]
  seleccionada: string | null
  onSeleccionar: (id: string) => void
}

const ANCHO_COLUMNA = 230
const ALTO_FILA = 90

function estiloNodo(id: string, props: Props): { clase: string; detalle: string } {
  const nota = props.notas.get(id)
  if (nota !== undefined) {
    const aprobada = nota >= props.malla.nota_aprobacion
    return { clase: aprobada ? 'cursada' : 'reprobada', detalle: `Nota ${nota.toFixed(1)}` }
  }
  const p = props.predicciones.find((x) => x.materia === id)
  if (p) return { clase: p.semaforo, detalle: `Predicción ${p.nota.toFixed(1)}` }
  return { clase: 'bloqueada', detalle: 'Bloqueada' }
}

export function MallaGrafo(props: Props) {
  const { malla, seleccionada, onSeleccionar } = props

  const nodes: Node[] = useMemo(() => {
    const filaPorSemestre = new Map<number, number>()
    return malla.materias.map((m) => {
      const fila = filaPorSemestre.get(m.semestre) ?? 0
      filaPorSemestre.set(m.semestre, fila + 1)
      const { clase, detalle } = estiloNodo(m.id, props)
      return {
        id: m.id,
        position: { x: (m.semestre - 1) * ANCHO_COLUMNA, y: fila * ALTO_FILA },
        // La malla se lee de izquierda a derecha (semestre a semestre).
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: (
            <div>
              <strong>{m.nombre}</strong>
              <div className="detalle">{detalle}</div>
            </div>
          ),
        },
        className: `nodo nodo-${clase}${seleccionada === m.id ? ' nodo-seleccionado' : ''}`,
      }
    })
  }, [props, malla, seleccionada])

  const edges: Edge[] = useMemo(
    () => [
      ...malla.prerrequisitos.map((e) => ({
        id: `${e.de}-${e.a}`,
        source: e.de,
        target: e.a,
      })),
      ...malla.aristas_blandas.map((e) => ({
        id: `blanda-${e.de}-${e.a}`,
        source: e.de,
        target: e.a,
        className: 'arista-blanda',
      })),
    ],
    [malla],
  )

  return (
    <div className="malla">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, n) => onSeleccionar(n.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
