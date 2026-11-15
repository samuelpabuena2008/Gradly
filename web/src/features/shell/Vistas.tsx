// Contenido del centro según la ruta. Las vistas de las fases siguientes (rediseño del grafo,
// predicciones, laboratorio, modelo) reemplazan a estas versiones base.

import { FlaskConical, BrainCircuit } from 'lucide-react'
import type { ReactNode } from 'react'
import { MallaGrafo } from '../malla/MallaGrafo'
import { PaginaMateria } from '../materia/PaginaMateria'
import { ImportarNotas } from '../notas/ImportarNotas'
import { PanelPrediccion } from '../prediccion/PanelPrediccion'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { abrirMateria } from './acciones'

function VistaMalla() {
  const { malla } = useDatos()
  const escenario = useEscenario()
  const seleccionada = useApp((s) => s.seleccionada)
  const seleccionar = useApp((s) => s.seleccionar)
  return (
    <MallaGrafo
      malla={malla}
      notas={escenario.mapaNotas}
      predicciones={escenario.predicciones}
      seleccionada={seleccionada}
      onSeleccionar={seleccionar}
      onAbrir={abrirMateria}
    />
  )
}

function Desplazable({ children }: { children: ReactNode }) {
  return (
    <div className="vista-scroll">
      <div className="vista-contenido">{children}</div>
    </div>
  )
}

function VistaNotas() {
  const { malla } = useDatos()
  const notasReales = useApp((s) => s.notasReales)
  const reemplazarNotas = useApp((s) => s.reemplazarNotas)
  return (
    <Desplazable>
      <ImportarNotas malla={malla} notas={notasReales} onCambiar={reemplazarNotas} />
    </Desplazable>
  )
}

function VistaPredicciones() {
  const { malla, recomendado } = useDatos()
  const escenario = useEscenario()
  const seleccionar = useApp((s) => s.seleccionar)
  const elegirModelo = useApp((s) => s.elegirModelo)
  return (
    <Desplazable>
      <PanelPrediccion
        malla={malla}
        predicciones={escenario.predicciones}
        onSeleccionar={seleccionar}
        tipoModelo={escenario.tipoModelo}
        recomendado={recomendado}
        onCambiarTipo={elegirModelo}
      />
    </Desplazable>
  )
}

function VistaEnPreparacion({ titulo, texto, icono }: { titulo: string; texto: string; icono: ReactNode }) {
  return (
    <div className="vista-vacia">
      {icono}
      <h1 className="vista-vacia-titulo">{titulo}</h1>
      <p className="ayuda">{texto}</p>
    </div>
  )
}

export const NOMBRE_VISTA: Record<string, string> = {
  malla: 'la malla',
  notas: 'la vista Notas',
  predicciones: 'la vista Predicciones',
  laboratorio: 'el Laboratorio de grafos',
  modelo: 'la vista Modelo',
}

export function nombreDeRuta(ruta: Ruta): string {
  return ruta.tipo === 'materia' ? `la página de ${ruta.id}` : (NOMBRE_VISTA[ruta.vista] ?? 'esta vista')
}

export function ContenidoCentro({ ruta }: { ruta: Ruta }) {
  if (ruta.tipo === 'materia') return <Desplazable><PaginaMateria id={ruta.id} /></Desplazable>
  switch (ruta.vista) {
    case 'malla':
      return <VistaMalla />
    case 'notas':
      return <VistaNotas />
    case 'predicciones':
      return <VistaPredicciones />
    case 'laboratorio':
      return (
        <VistaEnPreparacion
          titulo="Laboratorio de grafos"
          texto="Aquí verás, paso a paso, cómo se ordena la malla y dónde están sus cuellos de botella. Estamos terminando esta vista."
          icono={<FlaskConical size={28} strokeWidth={1.25} aria-hidden="true" />}
        />
      )
    case 'modelo':
      return (
        <VistaEnPreparacion
          titulo="Cómo piensa Gradly"
          texto="Aquí encontrarás la fórmula del modelo y qué tan bien acierta. Estamos terminando esta vista."
          icono={<BrainCircuit size={28} strokeWidth={1.25} aria-hidden="true" />}
        />
      )
  }
}
