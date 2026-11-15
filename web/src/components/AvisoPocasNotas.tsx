// Aviso honesto cuando hay muy pocas notas: el nivel del estudiante se encoge hacia 0 (k_nivel),
// así que la estimación es más incierta. Se muestra con 1 o 2 notas vigentes.

import { Info } from 'lucide-react'
import './aviso.css'

export const MAX_NOTAS_POCAS = 2

export function AvisoPocasNotas({ cantidad }: { cantidad: number }) {
  if (cantidad < 1 || cantidad > MAX_NOTAS_POCAS) return null
  return (
    <p className="aviso-pocas" role="note">
      <Info size={16} strokeWidth={1.5} aria-hidden="true" />
      <span>
        <strong>Con pocas notas la estimación es más incierta.</strong> Mientras agregas más materias, Gradly conoce mejor tu nivel.
      </span>
    </p>
  )
}
