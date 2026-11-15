// Ayuda: atajos de teclado y glosario de términos.

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useApp } from '../../store/app'
import './ayuda.css'

const ATAJOS: { grupo: string; filas: [string, string][] }[] = [
  {
    grupo: 'General',
    filas: [
      ['Ctrl/⌘ + K', 'Paleta de comandos'],
      ['Alt + 1 … 5', 'Ir a Malla, Notas, Predicciones, Laboratorio o Modelo'],
      ['Ctrl/⌘ + B', 'Mostrar u ocultar el explorador'],
      ['Ctrl + Alt + B', 'Mostrar u ocultar el inspector'],
      ['/', 'Buscar una materia'],
      ['?', 'Abrir esta ayuda'],
      ['Esc', 'Cerrar el cuadro o la capa abierta'],
    ],
  },
  {
    grupo: 'Pestañas',
    filas: [
      ['Ctrl + W  ·  Alt + W', 'Cerrar la pestaña de materia activa'],
      ['Supr', 'Cerrar la pestaña enfocada'],
      ['← →', 'Moverse entre pestañas'],
      ['Alt + ← →', 'Reordenar la pestaña enfocada'],
      ['Clic con rueda', 'Cerrar una pestaña'],
    ],
  },
  {
    grupo: 'Explorador de materias',
    filas: [
      ['↑ ↓', 'Moverse por la lista'],
      ['→  ·  ←', 'Abrir o cerrar un semestre; entrar o salir de él'],
      ['Enter', 'Abrir la página de la materia'],
      ['Espacio', 'Seleccionar la materia'],
      ['Inicio  ·  Fin', 'Primera o última fila'],
    ],
  },
  {
    grupo: 'Paneles',
    filas: [
      ['Arrastrar el divisor', 'Cambiar el ancho (también con ← → cuando tiene el foco)'],
      ['Doble clic en el divisor', 'Volver al ancho original'],
    ],
  },
]

const GLOSARIO: [string, string][] = [
  ['Semáforo', 'Resume la probabilidad de no aprobar una materia: verde (menos de 20 %), amarillo (menos de 50 %) o rojo (50 % o más). Siempre trae ícono y texto, no solo color.'],
  ['Nivel', 'Cómo te ha ido hasta ahora frente al promedio de cada materia. Con pocas notas se acerca al promedio, porque aún hay poca información.'],
  ['Cuello de botella', 'Una materia por la que pasan muchos caminos de la malla: si se retrasa, se retrasan varias materias que vienen después.'],
  ['Arista blanda', 'Relación entre materias que no es un prerrequisito oficial, pero que ayuda a explicar el rendimiento (por ejemplo, Álgebra Lineal y Física).'],
  ['Cadena crítica', 'La secuencia de prerrequisitos más larga de la malla: define el mínimo de semestres para terminarla.'],
]

export function DialogoAtajos() {
  const abierto = useApp((s) => s.atajosAbiertos)
  const abrirAtajos = useApp((s) => s.abrirAtajos)
  return (
    <Dialog.Root open={abierto} onOpenChange={abrirAtajos}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Dialog.Content className="dlg-contenido ayuda-dialogo" aria-describedby={undefined}>
          <div className="ayuda-cabecera">
            <Dialog.Title className="dlg-titulo">Ayuda y atajos</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="btn btn-fantasma" aria-label="Cerrar ayuda">
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {ATAJOS.map((g) => (
            <section key={g.grupo} className="ayuda-seccion">
              <h3 className="ayuda-grupo">{g.grupo}</h3>
              <dl className="ayuda-atajos">
                {g.filas.map(([teclas, accion]) => (
                  <div key={teclas} className="ayuda-fila">
                    <dt>
                      <kbd>{teclas}</kbd>
                    </dt>
                    <dd>{accion}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section className="ayuda-seccion">
            <h3 className="ayuda-grupo">Glosario</h3>
            <dl className="ayuda-glosario">
              {GLOSARIO.map(([termino, definicion]) => (
                <div key={termino}>
                  <dt>{termino}</dt>
                  <dd>{definicion}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
