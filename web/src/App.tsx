import { useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PantallaError } from './features/arranque/PantallaError'
import { Splash } from './features/arranque/Splash'
import { useArranque } from './features/arranque/useArranque'
import { Workspace } from './features/shell/Workspace'
import { ETAPAS } from './lib/ui/arranque'
import { EscenarioProvider } from './store/escenario'

const DURACION_SALIDA_SPLASH = 360

const prefiereMovimientoReducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

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
          <Workspace />
        </EscenarioProvider>
      )}
      {splashVisible && (
        <Splash etapa={estado.fase === 'cargando' ? estado.etapa : ETAPAS.length - 1} saliendo={estado.fase === 'listo'} />
      )}
    </ErrorBoundary>
  )
}
