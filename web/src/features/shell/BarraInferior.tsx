// Barra inferior de pestañas para móvil (<900 px): Malla · Notas · Predicciones · Más.
// «Más» abre una hoja con el resto de vistas, la paleta, los ajustes y la ayuda.

import { useState, type ReactNode } from 'react'
import { BrainCircuit, CircleHelp, Command, Ellipsis, FlaskConical, FilePenLine, List, Network, Settings, Sparkles } from 'lucide-react'
import { Cajon } from '../../components/Cajon'
import type { Ruta, Vista } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { irA, mostrarLista } from './acciones'

interface Props {
  ruta: Ruta
  onAjustes: () => void
}

const PRINCIPALES: { vista: Vista; etiqueta: string; icono: typeof Network }[] = [
  { vista: 'malla', etiqueta: 'Malla', icono: Network },
  { vista: 'notas', etiqueta: 'Notas', icono: FilePenLine },
  { vista: 'predicciones', etiqueta: 'Predicciones', icono: Sparkles },
]

function ItemMas({ icono, children, onClick, actual }: { icono: ReactNode; children: ReactNode; onClick: () => void; actual?: boolean }) {
  return (
    <button type="button" className="mas-item" aria-current={actual ? 'page' : undefined} onClick={onClick}>
      <span className="mas-ico" aria-hidden="true">
        {icono}
      </span>
      {children}
    </button>
  )
}

export function BarraInferior({ ruta, onAjustes }: Props) {
  const [masAbierto, setMasAbierto] = useState(false)
  const abrirPaleta = useApp((s) => s.abrirPaleta)
  const abrirAtajos = useApp((s) => s.abrirAtajos)
  // Las páginas de materia viven dentro de la malla.
  const activa = ruta.tipo === 'vista' ? ruta.vista : 'malla'
  const masActivo = activa === 'laboratorio' || activa === 'modelo'

  // Cada opción de «Más» cierra la hoja primero; así el foco vuelve a su sitio y la acción no queda tapada.
  const hacer = (accion: () => void) => () => {
    setMasAbierto(false)
    accion()
  }

  return (
    <>
      <nav className="nav-inferior" aria-label="Navegación principal" data-tour="nav">
        {PRINCIPALES.map(({ vista, etiqueta, icono: Icono }) => (
          <button
            key={vista}
            type="button"
            className={`nav-item${activa === vista ? ' nav-item-activo' : ''}`}
            aria-current={activa === vista ? 'page' : undefined}
            onClick={() => irA({ tipo: 'vista', vista })}
          >
            <Icono size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>{etiqueta}</span>
          </button>
        ))}
        <button
          type="button"
          className={`nav-item${masActivo ? ' nav-item-activo' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={masAbierto}
          onClick={() => setMasAbierto(true)}
        >
          <Ellipsis size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>Más</span>
        </button>
      </nav>

      <Cajon abierto={masAbierto} alCerrar={() => setMasAbierto(false)} titulo="Más opciones" lado="inferior">
        <div className="mas-hoja">
          <h2 className="mas-titulo">Más</h2>
          <ItemMas icono={<List size={18} strokeWidth={1.5} />} onClick={hacer(mostrarLista)}>
            Lista de materias
          </ItemMas>
          <ItemMas
            icono={<FlaskConical size={18} strokeWidth={1.5} />}
            actual={activa === 'laboratorio'}
            onClick={hacer(() => irA({ tipo: 'vista', vista: 'laboratorio' }))}
          >
            Laboratorio de grafos
          </ItemMas>
          <ItemMas
            icono={<BrainCircuit size={18} strokeWidth={1.5} />}
            actual={activa === 'modelo'}
            onClick={hacer(() => irA({ tipo: 'vista', vista: 'modelo' }))}
          >
            Cómo piensa Gradly (el modelo)
          </ItemMas>
          <ItemMas icono={<Command size={18} strokeWidth={1.5} />} onClick={hacer(() => abrirPaleta(true))}>
            Buscar y acciones
          </ItemMas>
          <ItemMas icono={<Settings size={18} strokeWidth={1.5} />} onClick={hacer(onAjustes)}>
            Ajustes y privacidad
          </ItemMas>
          <ItemMas icono={<CircleHelp size={18} strokeWidth={1.5} />} onClick={hacer(() => abrirAtajos(true))}>
            Ayuda y glosario
          </ItemMas>
        </div>
      </Cajon>
    </>
  )
}
