// Exporta el grafo visible como PNG con fondo oscuro. `html-to-image` se carga solo al exportar.
// Todo ocurre en el navegador: la imagen se descarga directamente, no se envía a ningún lado.

import { getViewportForBounds, type Rect } from '@xyflow/react'

const MARGEN = 48

/** `limites`: rectángulo de los nodos visibles (de `useReactFlow().getNodesBounds`). */
export async function exportarGrafoPng(contenedor: HTMLElement, limites: Rect, nombre = 'gradly-malla.png'): Promise<void> {
  const viewport = contenedor.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || !(limites.width > 0 && limites.height > 0)) throw new Error('No hay nada que exportar en el grafo.')

  const { toPng } = await import('html-to-image')
  const escala = 1.5
  const ancho = Math.round(Math.min(4000, Math.max(800, limites.width * escala + MARGEN * 2)))
  const alto = Math.round(Math.min(4000, Math.max(500, limites.height * escala + MARGEN * 2)))
  const vista = getViewportForBounds(limites, ancho, alto, 0.2, 3, 0.06)
  const fondo = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() || 'black'

  // html-to-image copia los estilos calculados: mientras exporta, las etiquetas se muestran siempre
  // (aunque el umbral de texto las oculte en pantalla) y sin transiciones a medio camino.
  contenedor.classList.add('malla-exportando')
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  let url: string
  try {
    url = await toPng(viewport, {
    backgroundColor: fondo,
    width: ancho,
    height: alto,
    pixelRatio: 1.5,
    style: {
      width: `${ancho}px`,
      height: `${alto}px`,
      transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})`,
    },
    // La tarjeta flotante del hover no forma parte de la malla.
    filter: (el) => !(el instanceof HTMLElement && el.classList.contains('nodo-tarjeta')),
    })
  } finally {
    contenedor.classList.remove('malla-exportando')
  }

  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
}
