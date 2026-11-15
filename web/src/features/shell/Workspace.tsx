// Espacio de trabajo tipo Obsidian: ribbon · explorador · centro con pestañas · inspector · barra de estado.

import { useEffect, useRef, useState } from 'react'
import { Dialogos } from './Dialogos'
import { ProveedorTips } from '../../components/Tip'
import { Cajon } from '../../components/Cajon'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { usePantalla } from '../../components/usePantalla'
import { BarraInferior } from './BarraInferior'
import { LIMITES_PANEL, useApp } from '../../store/app'
import { useDatos } from '../../store/escenario'
import { useRuta } from '../../store/ruta'
import { BannerEscenario } from '../simulador/BannerEscenario'
import { BarraEstado } from './BarraEstado'
import { BarraPestanas } from './BarraPestanas'
import { Divisor } from './Divisor'
import { Explorador } from './Explorador'
import { Inspector } from './Inspector'
import { Ribbon } from './Ribbon'
import { ContenidoCentro, nombreDeRuta } from './Vistas'
import { DialogoAjustes } from '../ayuda/DialogoAjustes'
import { recorridoVisto } from '../../lib/ui/recorrido'
import { useAtajos } from './useAtajos'
import './shell.css'

const ID_PANEL = 'panel-centro'
/** El recorrido se ofrece una sola vez por sesión, la primera vez que llegan notas. */
let recorridoOfrecido = false
const TITULO_VISTA: Record<string, string> = {
  malla: 'tu malla',
  notas: 'tus notas',
  predicciones: 'predicciones del próximo semestre',
}

export function Workspace() {
  const ruta = useRuta()
  const { materiaPorId } = useDatos()
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)

  const exploradorAbierto = useApp((s) => s.exploradorAbierto)
  const inspectorAbierto = useApp((s) => s.inspectorAbierto)
  const anchoExplorador = useApp((s) => s.anchoExplorador)
  const anchoInspector = useApp((s) => s.anchoInspector)
  const fijarAnchoExplorador = useApp((s) => s.fijarAnchoExplorador)
  const fijarAnchoInspector = useApp((s) => s.fijarAnchoInspector)

  useAtajos(ruta)

  // La primera vez que se cargan notas se ofrece el recorrido guiado (omitible; recordado solo con opt-in).
  const nNotas = useApp((s) => s.notasReales.length)
  const notasAntes = useRef(nNotas)
  useEffect(() => {
    const antes = notasAntes.current
    notasAntes.current = nNotas
    if (antes > 0 || nNotas === 0 || recorridoOfrecido || recorridoVisto()) return
    recorridoOfrecido = true
    const t = setTimeout(() => useApp.getState().abrirRecorrido(true), 900)
    return () => clearTimeout(t)
  }, [nNotas])

  // Un enlace profundo (#/materia/MAT1101) o el botón «atrás» abren la pestaña correspondiente.
  useEffect(() => {
    if (ruta.tipo === 'materia' && materiaPorId.has(ruta.id)) useApp.getState().abrirMateria(ruta.id)
  }, [ruta, materiaPorId])

  const claveRuta = ruta.tipo === 'materia' ? `materia:${ruta.id}` : `vista:${ruta.vista}`
  const pestanaActiva = ruta.tipo === 'vista' || materiaPorId.has(ruta.id) ? `tab-${claveRuta}` : undefined

  // §9.1: amplio = tres paneles · medio = el inspector es un cajón · móvil = barra inferior, hoja de detalle y lista.
  const modo = usePantalla()
  const amplio = modo === 'amplio'
  const movil = modo === 'movil'
  const alternarInspector = useApp((s) => s.alternarInspector)
  useEffect(() => {
    // Un cajón abierto por una sesión anterior en pantalla ancha taparía el contenido al abrir la app.
    if (modo !== 'amplio') useApp.getState().alternarInspector(false)
  }, [modo])

  const inspector = (
    <ErrorBoundary vista="el inspector">
      <Inspector />
    </ErrorBoundary>
  )

  return (
    <ProveedorTips>
      <div className={`workspace workspace-${modo}${movil && inspectorAbierto ? ' workspace-hoja' : ''}`}>
        <div className="ws-cuerpo">
          {!movil && <Ribbon ruta={ruta} onAjustes={() => setAjustesAbiertos(true)} />}

          {!movil && exploradorAbierto && (
            <aside className="ws-explorador" aria-label="Explorador de materias" data-tour="explorador" style={{ width: anchoExplorador }}>
              <ErrorBoundary vista="el explorador de materias">
                <Explorador />
              </ErrorBoundary>
              <Divisor
                etiqueta="Ancho del explorador"
                ancho={anchoExplorador}
                {...LIMITES_PANEL.explorador}
                direccion={1}
                claseExtra="divisor-explorador"
                onCambiar={fijarAnchoExplorador}
              />
            </aside>
          )}

          <main className="ws-centro" id="contenido" tabIndex={-1}>
            <BarraPestanas ruta={ruta} idPanel={ID_PANEL} />
            <BannerEscenario />
            <div
              className="ws-panel"
              id={ID_PANEL}
              data-tour="grafo"
              role="tabpanel"
              aria-labelledby={pestanaActiva}
              aria-label={pestanaActiva ? undefined : 'Contenido'}
            >
              {/* Las vistas Malla, Notas y Predicciones no traen título propio: este lo da a lectores de pantalla. */}
              {ruta.tipo === 'vista' && ['malla', 'notas', 'predicciones'].includes(ruta.vista) && (
                <h1 className="solo-lectores">Gradly: {TITULO_VISTA[ruta.vista]}</h1>
              )}
              <ErrorBoundary vista={nombreDeRuta(ruta)} reiniciarCon={claveRuta}>
                <ContenidoCentro ruta={ruta} />
              </ErrorBoundary>
            </div>
          </main>

          {amplio && inspectorAbierto && (
            <aside className="ws-inspector" aria-label="Inspector" data-tour="inspector" style={{ width: anchoInspector }}>
              <Divisor
                etiqueta="Ancho del inspector"
                ancho={anchoInspector}
                {...LIMITES_PANEL.inspector}
                direccion={-1}
                claseExtra="divisor-inspector"
                onCambiar={fijarAnchoInspector}
              />
              {inspector}
            </aside>
          )}
        </div>

        {/* Pantallas medianas: cajón lateral con telón. Móvil: hoja inferior que deja tocar el grafo. */}
        {!amplio && (
          <Cajon
            abierto={inspectorAbierto}
            alCerrar={() => alternarInspector(false)}
            titulo="Inspector"
            lado={movil ? 'inferior' : 'derecha'}
            modal={!movil}
            ancho={anchoInspector}
            sobreBarra={movil}
          >
            {inspector}
          </Cajon>
        )}

        <BarraEstado />
        {movil && <BarraInferior ruta={ruta} onAjustes={() => setAjustesAbiertos(true)} />}
        <Dialogos />
        <DialogoAjustes abierto={ajustesAbiertos} onCambiar={setAjustesAbiertos} />
      </div>
    </ProveedorTips>
  )
}
