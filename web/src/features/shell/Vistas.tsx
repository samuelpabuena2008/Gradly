// Contenido del centro según la ruta. Las vistas Laboratorio y Modelo se descargan bajo demanda
// (muestran un esqueleto mientras llegan).

import { lazy, Suspense, type ReactNode } from 'react'
import { EsqueletoVista } from '../../components/Esqueleto'
import { MallaGrafo } from '../malla/MallaGrafo'
import { PaginaMateria } from '../materia/PaginaMateria'
import { ImportarNotas } from '../notas/ImportarNotas'
import { VistaPredicciones } from '../prediccion/VistaPredicciones'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { useDatos } from '../../store/escenario'

const VistaLaboratorio = lazy(() => import('../laboratorio/VistaLaboratorio'))
const VistaModelo = lazy(() => import('../modelo/VistaModelo'))

function Desplazable({ children }: { children: ReactNode }) {
  return (
    <div className="vista-scroll">
      <div className="vista-contenido">{children}</div>
    </div>
  )
}

/** Vistas que gestionan su propio ancho y relleno. */
function DesplazableLibre({ children }: { children: ReactNode }) {
  return <div className="vista-scroll vista-scroll-libre">{children}</div>
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
  if (ruta.tipo === 'materia') return <DesplazableLibre><PaginaMateria id={ruta.id} /></DesplazableLibre>
  switch (ruta.vista) {
    case 'malla':
      return <MallaGrafo />
    case 'notas':
      return <VistaNotas />
    case 'predicciones':
      return <DesplazableLibre><VistaPredicciones /></DesplazableLibre>
    case 'laboratorio':
      return (
        <Suspense fallback={<EsqueletoVista etiqueta="Cargando el Laboratorio de grafos" />}>
          <DesplazableLibre><VistaLaboratorio /></DesplazableLibre>
        </Suspense>
      )
    case 'modelo':
      return (
        <Suspense fallback={<EsqueletoVista etiqueta="Cargando la vista Modelo" />}>
          <DesplazableLibre><VistaModelo /></DesplazableLibre>
        </Suspense>
      )
  }
}
