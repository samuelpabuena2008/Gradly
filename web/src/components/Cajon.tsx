// Cajón lateral (pantallas medianas) y hoja inferior (móvil), sobre Radix Dialog: Esc cierra, el foco
// vuelve a quien lo abrió. La hoja inferior se cierra también deslizándola hacia abajo.
//
// `modal={false}` deja tocar el grafo mientras la hoja está abierta (se elige otra materia y el detalle se
// actualiza); en los demás casos hay telón y el contenido de fondo queda inerte.

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { debeCerrarHoja } from '../lib/ui/pantalla'
import './cajon.css'

interface Props {
  abierto: boolean
  alCerrar: () => void
  /** Nombre accesible del panel (no se ve). */
  titulo: string
  lado: 'derecha' | 'inferior'
  /** Con `false` no hay telón ni trampa de foco: el fondo sigue siendo tocable. Por defecto es modal. */
  modal?: boolean
  /** Ancho del cajón lateral, en px. */
  ancho?: number
  /** La hoja inferior queda sobre la barra de navegación en lugar de taparla. */
  sobreBarra?: boolean
  children: ReactNode
}

export function Cajon({ abierto, alCerrar, titulo, lado, modal = true, ancho, sobreBarra = false, children }: Props) {
  const contenido = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ y0: number; t0: number; id: number } | null>(null)
  const quienAbrio = useRef<HTMLElement | null>(null)

  const clases = ['cajon', `cajon-${lado}`, sobreBarra ? 'cajon-sobre-barra' : ''].filter(Boolean).join(' ')
  const estilo = lado === 'derecha' && ancho ? ({ '--cajon-ancho': `${ancho}px` } as CSSProperties) : undefined

  function alBajar(e: PointerEvent<HTMLDivElement>) {
    arrastre.current = { y0: e.clientY, t0: e.timeStamp, id: e.pointerId }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    contenido.current?.classList.add('cajon-arrastrando')
  }

  function alMover(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId || !contenido.current) return
    contenido.current.style.setProperty('--cajon-dy', `${Math.max(0, e.clientY - a.y0)}px`)
  }

  function alSoltar(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current
    arrastre.current = null
    contenido.current?.classList.remove('cajon-arrastrando')
    contenido.current?.style.removeProperty('--cajon-dy')
    if (a && a.id === e.pointerId && debeCerrarHoja(e.clientY - a.y0, e.timeStamp - a.t0)) alCerrar()
  }

  return (
    <Dialog.Root open={abierto} modal={modal} onOpenChange={(a) => !a && alCerrar()}>
      <Dialog.Portal>
        {modal && <Dialog.Overlay className="cajon-telon" />}
        <Dialog.Content
          ref={contenido}
          className={clases}
          style={estilo}
          aria-describedby={undefined}
          // Sin telón, tocar fuera no cierra: así se puede elegir otra materia con la hoja abierta.
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          // Se abre desde el estado (no hay un Trigger de Radix): se recuerda quién tenía el foco para devolvérselo.
          onOpenAutoFocus={() => {
            quienAbrio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(e) => {
            const destino = quienAbrio.current
            quienAbrio.current = null
            if (destino?.isConnected) {
              e.preventDefault()
              destino.focus()
            }
          }}
        >
          <Dialog.Title className="solo-lectores">{titulo}</Dialog.Title>
          {lado === 'inferior' && (
            <div
              className="cajon-asa"
              aria-hidden="true"
              onPointerDown={alBajar}
              onPointerMove={alMover}
              onPointerUp={alSoltar}
              onPointerCancel={alSoltar}
            >
              <span />
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
