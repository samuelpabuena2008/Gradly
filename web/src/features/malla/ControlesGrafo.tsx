// Controles de cámara (zoom, ajustar, minimapa, pantalla completa, exportar) y leyenda del grafo.

import { Check, Circle, Download, Expand, Lock, Map as IconoMapa, Maximize, Minimize, Minus, Plus, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tip } from '../../components/Tip'

function BotonCamara({
  etiqueta,
  atajo,
  onClick,
  presionado,
  deshabilitado,
  children,
}: {
  etiqueta: string
  atajo?: string
  onClick: () => void
  presionado?: boolean
  deshabilitado?: boolean
  children: ReactNode
}) {
  return (
    <Tip texto={etiqueta} atajo={atajo} side="right">
      <button
        type="button"
        className="cam-btn"
        aria-label={etiqueta}
        aria-pressed={presionado}
        disabled={deshabilitado}
        onClick={onClick}
      >
        {children}
      </button>
    </Tip>
  )
}

interface PropsCamara {
  onAcercar: () => void
  onAlejar: () => void
  onAjustar: () => void
  minimapa: boolean
  onMinimapa: () => void
  pantallaCompleta: boolean
  onPantallaCompleta: () => void
  exportando: boolean
  onExportar: () => void
}

const ico = { size: 16, strokeWidth: 1.5, 'aria-hidden': true as const }

export function BarraCamara(p: PropsCamara) {
  return (
    <div className="barra-camara" role="toolbar" aria-label="Cámara del grafo" aria-orientation="vertical">
      <BotonCamara etiqueta="Acercar" atajo="+" onClick={p.onAcercar}>
        <Plus {...ico} />
      </BotonCamara>
      <BotonCamara etiqueta="Alejar" atajo="−" onClick={p.onAlejar}>
        <Minus {...ico} />
      </BotonCamara>
      <BotonCamara etiqueta="Ajustar a la pantalla" atajo="F" onClick={p.onAjustar}>
        <Expand {...ico} />
      </BotonCamara>
      <span className="cam-separador" aria-hidden="true" />
      <BotonCamara etiqueta="Minimapa" presionado={p.minimapa} onClick={p.onMinimapa}>
        <IconoMapa {...ico} />
      </BotonCamara>
      <BotonCamara
        etiqueta={p.pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
        presionado={p.pantallaCompleta}
        onClick={p.onPantallaCompleta}
      >
        {p.pantallaCompleta ? <Minimize {...ico} /> : <Maximize {...ico} />}
      </BotonCamara>
      <BotonCamara etiqueta={p.exportando ? 'Exportando…' : 'Exportar como PNG'} deshabilitado={p.exportando} onClick={p.onExportar}>
        <Download {...ico} />
      </BotonCamara>
    </div>
  )
}

function Muestra({ clase, children }: { clase: string; children?: ReactNode }) {
  return (
    <span className={`ley-muestra ${clase}`} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" />
      </svg>
      {children && <span className="ley-glifo">{children}</span>}
    </span>
  )
}

const g = { size: 9, 'aria-hidden': true as const }

export function Leyenda({ hayNotas, cadena, cuellos }: { hayNotas: boolean; cadena: boolean; cuellos: boolean }) {
  return (
    <ul className="leyenda" aria-label="Leyenda del grafo">
      {hayNotas && (
        <>
          <li>
            <Muestra clase="ley-aprobada">
              <Check {...g} strokeWidth={3} />
            </Muestra>
            Aprobada
          </li>
          <li>
            <Muestra clase="ley-reprobada">
              <X {...g} strokeWidth={3} />
            </Muestra>
            Por repetir
          </li>
        </>
      )}
      <li>
            <Muestra clase="ley-verde">
              <Check {...g} strokeWidth={3} />
            </Muestra>
            Vas bien preparado
          </li>
          <li>
            <Muestra clase="ley-amarillo">
              <TriangleAlert {...g} strokeWidth={2.5} />
            </Muestra>
            Conviene reforzar
          </li>
          <li>
            <Muestra clase="ley-rojo">
              <Circle {...g} size={7} fill="currentColor" />
            </Muestra>
            Dale prioridad
          </li>
      <li>
        <Muestra clase="ley-bloqueada">
          <Lock {...g} strokeWidth={2} />
        </Muestra>
        Bloqueada
      </li>
      {cadena && (
        <li>
          <span className="ley-linea ley-linea-critica" aria-hidden="true" />
          Cadena crítica
        </li>
      )}
      {cuellos && (
        <li>
          <Muestra clase="ley-cuello" />
          Cuello de botella
        </li>
      )}
      <li>
        <span className="ley-linea ley-linea-blanda" aria-hidden="true" />
        Arista blanda
      </li>
    </ul>
  )
}
