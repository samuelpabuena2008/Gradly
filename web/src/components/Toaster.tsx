// Avisos breves con acción opcional («Deshacer»). Se pausan al pasar el mouse o enfocar.

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useToasts, type Toast } from '../store/toasts'
import './toaster.css'

function ToastItem({ toast }: { toast: Toast }) {
  const cerrar = useToasts((s) => s.cerrar)
  const [pausado, setPausado] = useState(false)
  const restante = useRef(toast.duracion)

  useEffect(() => {
    if (pausado) return
    const inicio = Date.now()
    const t = setTimeout(() => cerrar(toast.id), restante.current)
    return () => {
      clearTimeout(t)
      restante.current -= Date.now() - inicio
    }
  }, [pausado, cerrar, toast.id])

  return (
    <div
      className="toast"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <span className="toast-mensaje">{toast.mensaje}</span>
      {toast.accion && (
        <button
          type="button"
          className="btn btn-fantasma toast-accion"
          onClick={() => {
            toast.accion?.alHacerClic()
            cerrar(toast.id)
          }}
        >
          {toast.accion.etiqueta}
        </button>
      )}
      <button type="button" className="btn btn-fantasma toast-cerrar" aria-label="Cerrar aviso" onClick={() => cerrar(toast.id)}>
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div className="toaster" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
