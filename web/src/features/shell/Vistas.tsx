// Contenido del centro según la ruta. Las vistas Laboratorio y Modelo se descargan bajo demanda
// (muestran un esqueleto mientras llegan).

import { lazy, Suspense, type ReactNode } from 'react'
import { EsqueletoVista } from '../../components/Esqueleto'
import { MallaGrafo } from '../malla/MallaGrafo'
import { PaginaMateria } from '../materia/PaginaMateria'
import { Bienvenida } from '../bienvenida/Bienvenida'
import { VistaNotas } from '../notas/VistaNotas'
import { VistaPredicciones } from '../prediccion/VistaPredicciones'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'

const VistaLaboratorio = lazy(() => import('../laboratorio/VistaLaboratorio'))
const VistaModelo = lazy(() => import('../modelo/VistaModelo'))

/** Vistas que gestionan su propio ancho y relleno. */
function DesplazableLibre({ children }: { children: ReactNode }) {
  return <div className="vista-scroll vista-scroll-libre">{children}</div>
}

/** La malla; sin notas queda de fondo, en gris, bajo la bienvenida. */
function VistaMalla() {
  const sinNotas = useApp((s) => s.notasReales.length === 0)
  const descartada = useApp((s) => s.bienvenidaDescartada)
  const bienvenida = sinNotas && !descartada
  return (
    <div className="malla-con-bienvenida">
      {/* inert: mientras se ve la bienvenida, el grafo de fondo no recibe foco ni clics. */}
      <div className={bienvenida ? 'malla-fondo malla-fondo-atenuado' : 'malla-fondo'} inert={bienvenida}>
        <MallaGrafo />
      </div>
      {bienvenida && <Bienvenida />}
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
  if (ruta.tipo === 'materia') return <DesplazableLibre><PaginaMateria id={ruta.id} /></DesplazableLibre>
  switch (ruta.vista) {
    case 'malla':
      return <VistaMalla />
    case 'notas':
      return (
        <DesplazableLibre>
          <VistaNotas />
        </DesplazableLibre>
      )
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
