// Recorrido guiado: pasos y preferencia de «no volver a mostrar». La preferencia solo se recuerda
// si el usuario lo pide (opt-in); si no, el recorrido se ofrece una vez por sesión.

import { borrarClave, guardarJson, leerJson } from './almacenamiento'

export const CLAVE_RECORRIDO = 'gradly:recorrido'

export interface PasoRecorrido {
  id: string
  /** Elemento que se resalta; `null` = tarjeta centrada, sin resaltar nada. */
  selector: string | null
  titulo: string
  texto: string
  /** Variante para pantallas táctiles (sin mouse ni atajos de teclado). */
  textoMovil?: string
}

export const PASOS_RECORRIDO: PasoRecorrido[] = [
  {
    id: 'navegacion',
    selector: '[data-tour="nav"]',
    titulo: 'Tus vistas',
    texto: 'Abajo cambias entre la malla, tus notas y las predicciones. En «Más» están el laboratorio de grafos, el modelo y los ajustes.',
  },
  {
    id: 'explorador',
    selector: '[data-tour="explorador"]',
    titulo: 'El explorador',
    texto: 'Aquí están tus materias por semestre, con tu nota o la que se espera. Busca una, filtra por estado y haz clic para verla en el grafo.',
  },
  {
    id: 'grafo',
    selector: '[data-tour="grafo"]',
    titulo: 'Tu malla como grafo',
    texto: 'Cada círculo es una materia y cada línea un prerrequisito. Violeta es aprobada; verde, amarillo y rojo dicen cómo te puede ir en las que puedes inscribir. Pasa el mouse para ver sus vecinas.',
    textoMovil:
      'Cada círculo es una materia y cada línea un prerrequisito. Violeta es aprobada; verde, amarillo y rojo dicen cómo te puede ir. Toca una materia para ver su detalle y pellizca para acercar. Si prefieres, cambia a «Lista».',
  },
  {
    id: 'inspector',
    selector: '[data-tour="inspector"]',
    titulo: 'El inspector',
    texto: 'Muestra el detalle de la materia elegida, el simulador «¿qué pasaría si…?» y el análisis de la malla. Doble clic en una materia abre su página completa.',
  },
  {
    id: 'paleta',
    selector: '[data-tour="paleta"]',
    titulo: 'La paleta de comandos',
    texto: 'Con Ctrl+K (⌘+K en Mac) buscas una materia, cambias de vista, importas o exportas notas. Casi todo se puede hacer desde el teclado.',
  },
  {
    id: 'privacidad',
    selector: null,
    titulo: 'Tus notas son tuyas',
    texto: 'Todo se procesa en este navegador: tus notas no salen de tu computador. Las predicciones son estimaciones, no sentencias. ¡Éxitos en el semestre!',
  },
]

export const recorridoVisto = (): boolean => leerJson<unknown>(CLAVE_RECORRIDO, false) === true

/** Recuerda (o deja de recordar) que no se vuelva a mostrar. */
export function recordarRecorridoVisto(visto: boolean): void {
  if (visto) guardarJson(CLAVE_RECORRIDO, true)
  else borrarClave(CLAVE_RECORRIDO)
}
