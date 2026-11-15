// Ribbon izquierdo (48 px): navegación entre vistas, estilo Obsidian. Indicador activo con barra violeta.

import { CircleHelp, Command, PanelLeft, Settings } from 'lucide-react'
import { Logo } from '../../components/brand/Logo'
import { Tip } from '../../components/Tip'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { VISTAS_RIBBON } from './comandos'
import { irA } from './acciones'

interface Props {
  ruta: Ruta
  onAjustes: () => void
}

export function Ribbon({ ruta, onAjustes }: Props) {
  const exploradorAbierto = useApp((s) => s.exploradorAbierto)
  const alternarExplorador = useApp((s) => s.alternarExplorador)
  const abrirPaleta = useApp((s) => s.abrirPaleta)
  const abrirAtajos = useApp((s) => s.abrirAtajos)
  // Las páginas de materia viven dentro de la malla.
  const activa = ruta.tipo === 'vista' ? ruta.vista : 'malla'

  return (
    <nav className="ribbon" aria-label="Navegación principal">
      <a className="ribbon-logo" href="#/malla" aria-label="Gradly, ir a la malla">
        <Logo variant="mark" size={26} decorativo />
      </a>

      <Tip texto={exploradorAbierto ? 'Ocultar explorador' : 'Mostrar explorador'} atajo="Ctrl+B">
        <button
          type="button"
          className="ribbon-btn"
          aria-label={exploradorAbierto ? 'Ocultar explorador' : 'Mostrar explorador'}
          aria-pressed={exploradorAbierto}
          onClick={() => alternarExplorador()}
        >
          <PanelLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </Tip>

      <div className="ribbon-grupo">
        {VISTAS_RIBBON.map(({ vista, etiqueta, icono: Icono, atajo }) => (
          <Tip key={vista} texto={etiqueta} atajo={atajo}>
            <button
              type="button"
              className={`ribbon-btn${activa === vista ? ' ribbon-activo' : ''}`}
              aria-label={etiqueta}
              aria-current={activa === vista ? 'page' : undefined}
              onClick={() => irA({ tipo: 'vista', vista })}
            >
              <Icono size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tip>
        ))}
      </div>

      <div className="ribbon-grupo ribbon-abajo">
        <Tip texto="Paleta de comandos" atajo="Ctrl+K">
          <button type="button" className="ribbon-btn" aria-label="Paleta de comandos" onClick={() => abrirPaleta(true)}>
            <Command size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Tip>
        <Tip texto="Ajustes">
          <button type="button" className="ribbon-btn" aria-label="Ajustes" onClick={onAjustes}>
            <Settings size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Tip>
        <Tip texto="Ayuda y atajos" atajo="?">
          <button type="button" className="ribbon-btn" aria-label="Ayuda y atajos" onClick={() => abrirAtajos(true)}>
            <CircleHelp size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Tip>
      </div>
    </nav>
  )
}
