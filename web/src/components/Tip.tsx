// Tooltip accesible (Radix): aparece al pasar el mouse y también al enfocar con teclado.

import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import './tip.css'

interface Props {
  texto: string
  /** Atajo de teclado, p. ej. «Ctrl+K». */
  atajo?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactNode
}

export function Tip({ texto, atajo, side = 'right', children }: Props) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" side={side} sideOffset={8}>
          {texto}
          {atajo && <kbd className="tip-atajo">{atajo}</kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export const ProveedorTips = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
    {children}
  </Tooltip.Provider>
)
