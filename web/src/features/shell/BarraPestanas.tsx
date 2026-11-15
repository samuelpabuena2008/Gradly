// Barra de pestañas del centro, estilo Obsidian: pestaña fija «Malla», una pestaña de vista cuando
// se navega a Notas/Predicciones/etc., y pestañas de materia (cerrables, reordenables, máximo 8).

import { useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Command, PanelRight, X } from 'lucide-react'
import { Tip } from '../../components/Tip'
import type { Ruta } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import { useDatos } from '../../store/escenario'
import { abrirMateria, cerrarPestana, irA } from './acciones'
import { VISTAS_RIBBON } from './comandos'

interface Pestana {
  clave: string
  etiqueta: string
  codigo?: string
  ruta: Ruta
  cerrable: boolean
  /** Pestaña de materia (se puede reordenar). */
  materia?: string
}

export function BarraPestanas({ ruta, idPanel }: { ruta: Ruta; idPanel: string }) {
  const { materiaPorId } = useDatos()
  const pestanasMateria = useApp((s) => s.pestanas)
  const moverMateria = useApp((s) => s.moverMateria)
  const inspectorAbierto = useApp((s) => s.inspectorAbierto)
  const alternarInspector = useApp((s) => s.alternarInspector)
  const abrirPaleta = useApp((s) => s.abrirPaleta)
  const lista = useRef<HTMLDivElement>(null)
  const [arrastrada, setArrastrada] = useState<string | null>(null)

  const pestanas: Pestana[] = [
    { clave: 'vista:malla', etiqueta: 'Malla', ruta: { tipo: 'vista', vista: 'malla' }, cerrable: false },
  ]
  if (ruta.tipo === 'vista' && ruta.vista !== 'malla') {
    const v = VISTAS_RIBBON.find((x) => x.vista === ruta.vista)
    pestanas.push({ clave: `vista:${ruta.vista}`, etiqueta: v?.etiqueta ?? ruta.vista, ruta, cerrable: true })
  }
  for (const id of pestanasMateria) {
    const m = materiaPorId.get(id)
    pestanas.push({
      clave: `materia:${id}`,
      etiqueta: m?.nombre ?? id,
      codigo: id,
      ruta: { tipo: 'materia', id },
      cerrable: true,
      materia: id,
    })
  }

  const esActiva = (p: Pestana) =>
    p.ruta.tipo === 'materia'
      ? ruta.tipo === 'materia' && ruta.id === p.ruta.id
      : ruta.tipo === 'vista' && ruta.vista === p.ruta.vista

  function activar(p: Pestana) {
    if (p.ruta.tipo === 'materia') abrirMateria(p.ruta.id)
    else irA(p.ruta)
  }

  function cerrar(p: Pestana) {
    if (p.materia) cerrarPestana(p.materia, ruta)
    else irA({ tipo: 'vista', vista: 'malla' })
  }

  function enfocarPestana(indice: number) {
    const botones = lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')
    botones?.[(indice + pestanas.length) % pestanas.length]?.focus()
  }

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, p: Pestana, i: number) {
    if (e.altKey && p.materia && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      // Alt+← / Alt+→ reordenan la pestaña (equivalente por teclado del arrastre).
      const idx = pestanasMateria.indexOf(p.materia)
      moverMateria(p.materia, idx + (e.key === 'ArrowRight' ? 1 : -1))
      e.preventDefault()
      requestAnimationFrame(() =>
        [...(lista.current?.querySelectorAll<HTMLElement>('[data-clave]') ?? [])].find((el) => el.dataset.clave === p.clave)?.focus(),
      )
      return
    }
    if (e.key === 'ArrowRight') {
      enfocarPestana(i + 1)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      enfocarPestana(i - 1)
      e.preventDefault()
    } else if (e.key === 'Home') {
      enfocarPestana(0)
      e.preventDefault()
    } else if (e.key === 'End') {
      enfocarPestana(pestanas.length - 1)
      e.preventDefault()
    } else if (e.key === 'Delete' && p.cerrable) {
      cerrar(p)
      e.preventDefault()
    }
  }

  function alSoltar(e: DragEvent, destino: Pestana) {
    e.preventDefault()
    if (!arrastrada || !destino.materia || arrastrada === destino.materia) return
    moverMateria(arrastrada, pestanasMateria.indexOf(destino.materia))
    setArrastrada(null)
  }

  return (
    <div className="tabbar">
      <div className="tabbar-lista" role="tablist" aria-label="Pestañas abiertas" ref={lista}>
        {pestanas.map((p, i) => {
          const activa = esActiva(p)
          return (
            <div
              key={p.clave}
              className={`tab${activa ? ' tab-activa' : ''}${arrastrada === p.materia && p.materia ? ' tab-arrastrada' : ''}`}
              role="presentation"
              draggable={Boolean(p.materia)}
              onDragStart={() => p.materia && setArrastrada(p.materia)}
              onDragEnd={() => setArrastrada(null)}
              onDragOver={(e) => p.materia && arrastrada && e.preventDefault()}
              onDrop={(e) => alSoltar(e, p)}
              onAuxClick={(e: MouseEvent) => {
                if (e.button === 1 && p.cerrable) {
                  e.preventDefault()
                  cerrar(p)
                }
              }}
            >
              <button
                type="button"
                role="tab"
                id={`tab-${p.clave}`}
                data-clave={p.clave}
                className="tab-boton"
                aria-selected={activa}
                aria-controls={activa ? idPanel : undefined}
                tabIndex={activa ? 0 : -1}
                title={p.codigo ? `${p.etiqueta} · ${p.codigo}` : p.etiqueta}
                onClick={() => activar(p)}
                aria-keyshortcuts={p.cerrable ? 'Delete' : undefined}
                onKeyDown={(e) => alTeclear(e, p, i)}
              >
                {p.codigo && <span className="tab-codigo mono">{p.codigo}</span>}
                <span className="tab-etiqueta">{p.etiqueta}</span>
              </button>
              {/* Solo para mouse y táctil: un botón dentro de un tablist no es válido en ARIA.
                  Por teclado se cierra con Supr o Alt+W. */}
              {p.cerrable && (
                <button
                  type="button"
                  className="tab-cerrar"
                  aria-label={`Cerrar ${p.etiqueta}`}
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => cerrar(p)}
                >
                  <X size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="tabbar-acciones">
        <Tip texto="Paleta de comandos" atajo="Ctrl+K" side="bottom">
          <button type="button" className="btn btn-fantasma tabbar-btn" aria-label="Paleta de comandos" onClick={() => abrirPaleta(true)}>
            <Command size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Tip>
        <Tip texto={inspectorAbierto ? 'Ocultar inspector' : 'Mostrar inspector'} atajo="Ctrl+Alt+B" side="bottom">
          <button
            type="button"
            className="btn btn-fantasma tabbar-btn"
            aria-label={inspectorAbierto ? 'Ocultar inspector' : 'Mostrar inspector'}
            aria-pressed={inspectorAbierto}
            onClick={() => alternarInspector()}
          >
            <PanelRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Tip>
      </div>
    </div>
  )
}
