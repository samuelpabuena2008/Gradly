// Semáforo de riesgo. Nunca depende solo del color: cada nivel lleva ícono y texto
// (verde ✓ «Vas bien preparado», amarillo ▲ «Conviene reforzar», rojo ● «Dale prioridad»).

import { Check, Circle, TriangleAlert } from 'lucide-react'
import type { Semaforo as NivelSemaforo } from '../types'
import { ETIQUETA_SEMAFORO } from '../lib/ui/estado'
import './semaforo.css'

const ICONO = {
  verde: <Check size={14} strokeWidth={2} aria-hidden="true" />,
  amarillo: <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />,
  rojo: <Circle size={12} strokeWidth={1.5} fill="currentColor" aria-hidden="true" />,
} satisfies Record<NivelSemaforo, React.ReactNode>

interface Props {
  nivel: NivelSemaforo
  /** Solo ícono visible (el texto sigue disponible para lectores de pantalla y como tooltip nativo). */
  compacto?: boolean
}

export function Semaforo({ nivel, compacto = false }: Props) {
  const texto = ETIQUETA_SEMAFORO[nivel]
  return (
    <span className={`semaforo semaforo-${nivel}${compacto ? ' semaforo-compacto' : ''}`} data-nivel={nivel} title={compacto ? texto : undefined}>
      {ICONO[nivel]}
      <span className={compacto ? 'solo-lectores' : undefined}>{texto}</span>
    </span>
  )
}

/** Ícono suelto del semáforo (para listas densas como el explorador). */
export function IconoSemaforo({ nivel }: { nivel: NivelSemaforo }) {
  return <span className={`icono-semaforo semaforo-${nivel}`}>{ICONO[nivel]}</span>
}
