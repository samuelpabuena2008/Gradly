// Esqueleto de carga para vistas que se descargan bajo demanda (nunca un spinner genérico).

import './esqueleto.css'

export function EsqueletoVista({ etiqueta = 'Cargando la vista' }: { etiqueta?: string }) {
  return (
    <div className="esqueleto" role="status" aria-label={etiqueta}>
      <span className="esqueleto-barra esqueleto-titulo" />
      <span className="esqueleto-barra esqueleto-linea" />
      <span className="esqueleto-barra esqueleto-linea esqueleto-corta" />
      <div className="esqueleto-rejilla">
        <span className="esqueleto-barra esqueleto-bloque" />
        <span className="esqueleto-barra esqueleto-bloque" />
        <span className="esqueleto-barra esqueleto-bloque" />
      </div>
      <span className="solo-lectores">{etiqueta}…</span>
    </div>
  )
}
