// Error boundary por vista: un fallo en una pestaña no tumba la app. Ofrece reintentar.

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import './error-boundary.css'

interface Props {
  /** Nombre de la vista, para el mensaje («la vista Modelo»). */
  vista: string
  children: ReactNode
  /** Si cambia, el boundary se reinicia solo (por ejemplo, al cambiar de pestaña). */
  reiniciarCon?: unknown
}

interface EstadoBoundary {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, EstadoBoundary> {
  state: EstadoBoundary = { error: null }

  static getDerivedStateFromError(error: Error): EstadoBoundary {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Solo a la consola local: nada sale del navegador.
    console.error(`Error en ${this.props.vista}:`, error, info.componentStack)
  }

  componentDidUpdate(previas: Props) {
    if (this.state.error && previas.reiniciarCon !== this.props.reiniciarCon) {
      this.setState({ error: null })
    }
  }

  reintentar = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="eb" role="alert">
        <AlertTriangle size={20} strokeWidth={1.5} aria-hidden="true" />
        <h2 className="eb-titulo">Esta vista tuvo un problema</h2>
        <p className="eb-texto">
          No pudimos mostrar {this.props.vista}. El resto de Gradly sigue funcionando y tus notas no se perdieron.
        </p>
        <details className="eb-detalle">
          <summary>Detalle técnico</summary>
          <pre>{error.message}</pre>
        </details>
        <button type="button" className="btn btn-primario" onClick={this.reintentar}>
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          Reintentar
        </button>
      </div>
    )
  }
}
