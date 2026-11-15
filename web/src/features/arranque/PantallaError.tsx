// Pantalla de error del arranque: nunca queda en blanco.

import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { ErrorArranque } from '../../lib/ui/arranque'
import './arranque.css'

export function PantallaError({ error, onReintentar }: { error: ErrorArranque; onReintentar: () => void }) {
  return (
    <div className="splash splash-error" role="alert">
      <div className="splash-centro splash-error-caja">
        <AlertTriangle size={28} strokeWidth={1.5} aria-hidden="true" />
        <h1 className="splash-error-titulo">{error.titulo}</h1>
        <p className="splash-error-texto">
          No pudimos iniciar Gradly. Tus notas no se perdieron: todo se procesa en este navegador y no salió nada de él.
        </p>
        <details className="splash-error-detalle">
          <summary>Detalle técnico</summary>
          <pre>{error.detalle}</pre>
        </details>
        <button type="button" className="btn btn-primario" onClick={onReintentar} autoFocus>
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          Reintentar
        </button>
      </div>
    </div>
  )
}
