// Pantalla de bienvenida (sin notas): la malla queda de fondo, tenue, y una tarjeta central con el
// logo y los caminos para cargar las notas. La privacidad se dice de frente.

import { Lock } from 'lucide-react'
import { Logo } from '../../components/brand/Logo'
import { useApp } from '../../store/app'
import { irA } from '../shell/acciones'
import { ZonaImportar } from '../notas/ZonaImportar'
import './bienvenida.css'

export function Bienvenida() {
  const descartar = useApp((s) => s.descartarBienvenida)

  return (
    <div className="bienvenida" role="region" aria-labelledby="bienvenida-titulo">
      <div className="bienvenida-tarjeta">
        <Logo variant="mark" size={56} animated decorativo />
        <h2 id="bienvenida-titulo" className="bienvenida-titulo">
          Mira tu carrera como un grafo
        </h2>
        <p className="bienvenida-lema">
          Carga tus notas y Gradly te muestra, sobre la malla de Ingeniería de Sistemas, cómo te puede ir en las materias que vienen y en qué conviene enfocarte.
        </p>

        <ZonaImportar variante="grande" onManual={() => irA({ tipo: 'vista', vista: 'notas' })} />

        <p className="bienvenida-privacidad">
          <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
          Tus notas se procesan en este navegador y no salen de tu computador.
        </p>
        <button type="button" className="btn btn-fantasma" onClick={descartar}>
          Explorar la malla primero
        </button>
      </div>
    </div>
  )
}
