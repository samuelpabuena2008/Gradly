// Logo de Gradly: una «G» construida como grafo. El travesaño es una arista dirigida hacia
// el nodo central (la nota que sigue). Variantes: marca sola, lockup horizontal y monocromo.

import { useId } from 'react'
import { MARCA, TEXTO } from './marcaPaths'
import './logo.css'

export type VarianteLogo = 'mark' | 'lockup' | 'mono'

interface Props {
  variant?: VarianteLogo
  /** Alto en píxeles. */
  size?: number
  /** Dibuja los trazos, enciende los nodos en cascada y hace pulsar el nodo central una vez. */
  animated?: boolean
  className?: string
  /** Si es true el logo es decorativo y se oculta a lectores de pantalla. */
  decorativo?: boolean
}

const COLORES = {
  arista: '#8b5cf6',
  nodo: '#a78bfa',
  centro: '#c4b5fd',
  texto: '#e9e6f5',
}

export function Logo({ variant = 'mark', size = 32, animated = false, className, decorativo = false }: Props) {
  const tituloId = useId()
  const mono = variant === 'mono'
  const arista = mono ? 'currentColor' : COLORES.arista
  const nodo = mono ? 'currentColor' : COLORES.nodo
  const centro = mono ? 'currentColor' : COLORES.centro
  const ancho = variant === 'lockup' ? TEXTO.ancho : 64

  return (
    <svg
      className={['logo', animated ? 'logo-animado' : '', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${ancho} 64`}
      width={(size * ancho) / 64}
      height={size}
      fill="none"
      role={decorativo ? undefined : 'img'}
      aria-hidden={decorativo ? true : undefined}
      aria-labelledby={decorativo ? undefined : tituloId}
    >
      {!decorativo && <title id={tituloId}>Gradly</title>}
      <circle
        className="g-halo"
        cx={MARCA.centro[0]}
        cy={MARCA.centro[1]}
        r={9.6}
        fill={mono ? 'currentColor' : COLORES.arista}
        opacity={mono ? 0.2 : 0.26}
      />
      <g stroke={arista} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path className="g-arco" d={MARCA.arco} pathLength={1} />
        <path className="g-barra" d={MARCA.barra} pathLength={1} />
        <path className="g-flecha" d={MARCA.flecha} pathLength={1} />
      </g>
      <g fill={nodo}>
        {MARCA.nodos.map(([cx, cy], i) => (
          <circle key={i} className="g-nodo" style={{ ['--i' as string]: i }} cx={cx} cy={cy} r={4.6} />
        ))}
      </g>
      <circle className="g-centro" cx={MARCA.centro[0]} cy={MARCA.centro[1]} r={6.4} fill={centro} />
      {variant === 'lockup' && (
        <path transform={TEXTO.transform} d={TEXTO.d} fill={COLORES.texto} className="g-texto" />
      )}
    </svg>
  )
}
