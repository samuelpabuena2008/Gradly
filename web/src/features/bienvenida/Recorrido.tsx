// Recorrido guiado de 5 pasos (omitible): señala el explorador, el grafo, el inspector y la paleta de
// comandos. Los pasos cuyo elemento no está visible (por ejemplo, paneles cerrados en pantallas
// pequeñas) se saltan. «No volver a mostrar» solo se recuerda si el usuario lo marca (opt-in).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { esMovil } from '../../lib/ui/pantalla'
import { PASOS_RECORRIDO, recordarRecorridoVisto, type PasoRecorrido } from '../../lib/ui/recorrido'
import { useApp } from '../../store/app'
import './bienvenida.css'

const ANCHO = 330
const MARGEN = 12

interface Caja {
  top: number
  left: number
  width: number
  height: number
}

function medir(selector: string | null): Caja | null {
  if (!selector) return null
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 8 && r.height > 8 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
}

/** Coloca la tarjeta al lado del elemento resaltado, donde más espacio haya, siempre dentro de la ventana. */
function ubicar(caja: Caja | null, alto: number): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!caja) return { top: Math.max(MARGEN, (vh - alto) / 2), left: Math.max(MARGEN, (vw - ANCHO) / 2) }
  const derecha = vw - (caja.left + caja.width)
  let left: number
  let top: number
  if (derecha >= ANCHO + MARGEN * 2) {
    left = caja.left + caja.width + MARGEN
    top = caja.top + 24
  } else if (caja.left >= ANCHO + MARGEN * 2) {
    left = caja.left - ANCHO - MARGEN
    top = caja.top + 24
  } else if (vh - (caja.top + caja.height) >= alto + MARGEN * 2) {
    left = caja.left + caja.width / 2 - ANCHO / 2
    top = caja.top + caja.height + MARGEN
  } else {
    left = caja.left + caja.width / 2 - ANCHO / 2
    top = caja.top + caja.height / 2 - alto / 2
  }
  return {
    left: Math.min(vw - ANCHO - MARGEN, Math.max(MARGEN, left)),
    top: Math.min(vh - alto - MARGEN, Math.max(MARGEN, top)),
  }
}

export function Recorrido() {
  const abierto = useApp((s) => s.recorridoAbierto)
  const abrirRecorrido = useApp((s) => s.abrirRecorrido)
  return abierto ? <RecorridoAbierto alCerrar={() => abrirRecorrido(false)} /> : null
}

function RecorridoAbierto({ alCerrar }: { alCerrar: () => void }) {
  // Los pasos disponibles se fijan al abrir: los de elementos ocultos no cuentan.
  const [pasos] = useState<PasoRecorrido[]>(() => PASOS_RECORRIDO.filter((p) => p.selector === null || medir(p.selector) !== null))
  const [indice, setIndice] = useState(0)
  const [noMostrar, setNoMostrar] = useState(false)
  const [caja, setCaja] = useState<Caja | null>(null)
  const [posicion, setPosicion] = useState({ top: 80, left: 80 })
  const tarjeta = useRef<HTMLDivElement>(null)
  const siguiente = useRef<HTMLButtonElement>(null)
  const paso = pasos[indice]
  const ultimo = indice === pasos.length - 1

  const terminar = useMemo(
    () => () => {
      if (noMostrar) recordarRecorridoVisto(true)
      alCerrar()
    },
    [noMostrar, alCerrar],
  )

  // Mide el elemento del paso y reubica la tarjeta (también al redimensionar).
  useLayoutEffect(() => {
    if (!paso) return
    const recolocar = () => {
      const c = medir(paso.selector)
      setCaja(c)
      setPosicion(ubicar(c, tarjeta.current?.offsetHeight ?? 190))
    }
    recolocar()
    window.addEventListener('resize', recolocar)
    return () => window.removeEventListener('resize', recolocar)
  }, [paso])

  useEffect(() => {
    siguiente.current?.focus()
  }, [indice])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        terminar()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [terminar])

  if (!paso) return null

  return (
    <div className="recorrido" aria-live="off">
      {caja && <div className="recorrido-foco" style={{ top: caja.top - 4, left: caja.left - 4, width: caja.width + 8, height: caja.height + 8 }} aria-hidden="true" />}
      {!caja && <div className="recorrido-velo" aria-hidden="true" />}
      <div ref={tarjeta} className="recorrido-tarjeta" role="dialog" aria-label="Recorrido guiado" aria-describedby="recorrido-texto" style={{ top: posicion.top, left: posicion.left, width: ANCHO }}>
        <div className="recorrido-cabecera">
          <span className="recorrido-paso">
            Paso {indice + 1} de {pasos.length}
          </span>
          <button type="button" className="btn btn-fantasma recorrido-cerrar" aria-label="Omitir el recorrido" onClick={terminar}>
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <h2 className="recorrido-titulo">{paso.titulo}</h2>
        <p id="recorrido-texto" className="recorrido-texto">
          {esMovil() && paso.textoMovil ? paso.textoMovil : paso.texto}
        </p>
        <label className="recorrido-recordar">
          <input type="checkbox" checked={noMostrar} onChange={(e) => setNoMostrar(e.target.checked)} />
          No volver a mostrar este recorrido
        </label>
        <div className="recorrido-acciones">
          <button type="button" className="btn btn-fantasma" onClick={terminar}>
            Omitir
          </button>
          <div className="recorrido-nav">
            {indice > 0 && (
              <button type="button" className="btn" onClick={() => setIndice(indice - 1)}>
                Atrás
              </button>
            )}
            <button ref={siguiente} type="button" className="btn btn-primario" onClick={() => (ultimo ? terminar() : setIndice(indice + 1))}>
              {ultimo ? 'Listo' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
