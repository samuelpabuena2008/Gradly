import { useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PantallaError } from './features/arranque/PantallaError'
import { Splash } from './features/arranque/Splash'
import { useArranque } from './features/arranque/useArranque'
import { AnalisisMalla } from './features/malla/AnalisisMalla'
import { MallaGrafo } from './features/malla/MallaGrafo'
import { ImportarNotas } from './features/notas/ImportarNotas'
import { PanelPrediccion } from './features/prediccion/PanelPrediccion'
import { ETAPAS } from './lib/ui/arranque'
import { useApp } from './store/app'
import { EscenarioProvider, useDatos, useEscenario } from './store/escenario'
import './app.css'

const DURACION_SALIDA_SPLASH = 360

const prefiereMovimientoReducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Distribución provisional: el espacio de trabajo tipo Obsidian (Fase 2) la reemplaza.
function Principal() {
  const { malla } = useDatos()
  const escenario = useEscenario()
  const notasReales = useApp((s) => s.notasReales)
  const reemplazarNotas = useApp((s) => s.reemplazarNotas)
  const seleccionada = useApp((s) => s.seleccionada)
  const seleccionar = useApp((s) => s.seleccionar)
  const elegirModelo = useApp((s) => s.elegirModelo)
  const { recomendado } = useDatos()

  return (
    <div className="app-provisional">
      <header>
        <h1>Gradly</h1>
        <p>
          {malla.programa} · malla {malla.version}
        </p>
      </header>
      <main id="contenido">
        <MallaGrafo
          malla={malla}
          notas={escenario.mapaNotas}
          predicciones={escenario.predicciones}
          seleccionada={seleccionada}
          onSeleccionar={seleccionar}
        />
        <aside>
          <ImportarNotas malla={malla} notas={notasReales} onCambiar={reemplazarNotas} />
          <PanelPrediccion
            malla={malla}
            predicciones={escenario.predicciones}
            onSeleccionar={seleccionar}
            tipoModelo={escenario.tipoModelo}
            recomendado={recomendado}
            onCambiarTipo={elegirModelo}
          />
          <AnalisisMalla malla={malla} seleccionada={seleccionada} />
        </aside>
      </main>
    </div>
  )
}

export default function App() {
  const { estado, reintentar } = useArranque()
  const [splashVisible, setSplashVisible] = useState(true)

  useEffect(() => {
    if (estado.fase === 'cargando') setSplashVisible(true)
    if (estado.fase !== 'listo') return
    // Sale con fade + leve zoom; con movimiento reducido desaparece de inmediato.
    const espera = prefiereMovimientoReducido() ? 0 : DURACION_SALIDA_SPLASH
    const t = setTimeout(() => setSplashVisible(false), espera)
    return () => clearTimeout(t)
  }, [estado.fase])

  if (estado.fase === 'error') return <PantallaError error={estado.error} onReintentar={reintentar} />

  return (
    <ErrorBoundary vista="Gradly">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      {estado.fase === 'listo' && (
        <EscenarioProvider datos={estado.datos}>
          <Principal />
        </EscenarioProvider>
      )}
      {splashVisible && (
        <Splash etapa={estado.fase === 'cargando' ? estado.etapa : ETAPAS.length - 1} saliendo={estado.fase === 'listo'} />
      )}
    </ErrorBoundary>
  )
}
