// Catálogo de comandos de la paleta (Ctrl/⌘+K): ir a vistas, buscar materias y ejecutar acciones.

import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  BrainCircuit,
  CircleHelp,
  Download,
  FilePenLine,
  FlaskConical,
  Network,
  PanelLeft,
  PanelRight,
  Sparkles,
  Trash2,
  Upload,
  Waypoints,
} from 'lucide-react'
import type { Datos } from '../../lib/ui/arranque'
import type { Vista } from '../../lib/ui/ruta'
import { useApp } from '../../store/app'
import {
  abrirMateria,
  alternarModelo,
  borrarTodo,
  cargarEjemplo,
  exportarCsv,
  irA,
} from './acciones'

export type GrupoComando = 'Materias' | 'Ir a' | 'Acciones'

export interface Comando {
  id: string
  titulo: string
  grupo: GrupoComando
  /** Texto secundario (código de la materia, descripción). */
  detalle?: string
  atajo?: string
  icono: LucideIcon
  /** Palabras extra que también encuentran el comando. */
  palabras?: string
  ejecutar: () => void
}

export const VISTAS_RIBBON: { vista: Vista; etiqueta: string; icono: LucideIcon; atajo: string }[] = [
  { vista: 'malla', etiqueta: 'Malla', icono: Network, atajo: 'Alt+1' },
  { vista: 'notas', etiqueta: 'Notas', icono: FilePenLine, atajo: 'Alt+2' },
  { vista: 'predicciones', etiqueta: 'Predicciones', icono: Sparkles, atajo: 'Alt+3' },
  { vista: 'laboratorio', etiqueta: 'Laboratorio de grafos', icono: FlaskConical, atajo: 'Alt+4' },
  { vista: 'modelo', etiqueta: 'Modelo', icono: BrainCircuit, atajo: 'Alt+5' },
]

export function construirComandos(datos: Datos, tipoModelo: 'regresion' | 'red'): Comando[] {
  const materias: Comando[] = datos.malla.materias.map((m) => ({
    id: `materia:${m.id}`,
    titulo: m.nombre,
    grupo: 'Materias',
    detalle: `${m.id} · Semestre ${m.semestre}`,
    icono: BookOpen,
    palabras: m.id,
    ejecutar: () => abrirMateria(m.id),
  }))

  const vistas: Comando[] = VISTAS_RIBBON.map((v) => ({
    id: `vista:${v.vista}`,
    titulo: `Ir a ${v.etiqueta}`,
    grupo: 'Ir a',
    atajo: v.atajo,
    icono: v.icono,
    palabras: v.vista,
    ejecutar: () => irA({ tipo: 'vista', vista: v.vista }),
  }))

  const acciones: Comando[] = [
    {
      id: 'accion:importar',
      titulo: 'Importar notas',
      grupo: 'Acciones',
      detalle: 'Certificado PDF, CSV o texto pegado',
      icono: Upload,
      palabras: 'subir certificado csv pdf cargar',
      ejecutar: () => irA({ tipo: 'vista', vista: 'notas' }),
    },
    {
      id: 'accion:ejemplo',
      titulo: 'Cargar notas de ejemplo',
      grupo: 'Acciones',
      icono: Waypoints,
      palabras: 'demo ejemplo probar',
      ejecutar: () => cargarEjemplo(datos),
    },
    {
      id: 'accion:modelo',
      titulo: 'Alternar modelo (regresión / red neuronal)',
      grupo: 'Acciones',
      detalle: tipoModelo === 'regresion' ? 'Ahora: Regresión' : 'Ahora: Red neuronal (MLP)',
      icono: BrainCircuit,
      palabras: 'cambiar mlp',
      ejecutar: () => alternarModelo(datos, tipoModelo),
    },
    {
      id: 'accion:explorador',
      titulo: 'Mostrar u ocultar el explorador',
      grupo: 'Acciones',
      atajo: 'Ctrl+B',
      icono: PanelLeft,
      palabras: 'panel izquierdo materias',
      ejecutar: () => useApp.getState().alternarExplorador(),
    },
    {
      id: 'accion:inspector',
      titulo: 'Mostrar u ocultar el inspector',
      grupo: 'Acciones',
      atajo: 'Ctrl+Alt+B',
      icono: PanelRight,
      palabras: 'panel derecho detalle',
      ejecutar: () => useApp.getState().alternarInspector(),
    },
    {
      id: 'accion:exportar',
      titulo: 'Exportar notas (CSV)',
      grupo: 'Acciones',
      icono: Download,
      palabras: 'descargar guardar',
      ejecutar: exportarCsv,
    },
    {
      id: 'accion:borrar',
      titulo: 'Borrar mis datos',
      grupo: 'Acciones',
      detalle: 'Pide confirmación y se puede deshacer',
      icono: Trash2,
      palabras: 'eliminar notas limpiar',
      ejecutar: borrarTodo,
    },
    {
      id: 'accion:atajos',
      titulo: 'Ver atajos de teclado',
      grupo: 'Acciones',
      atajo: '?',
      icono: CircleHelp,
      palabras: 'ayuda teclas',
      ejecutar: () => useApp.getState().abrirAtajos(true),
    },
  ]

  return [...vistas, ...acciones, ...materias]
}
