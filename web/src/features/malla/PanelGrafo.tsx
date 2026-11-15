// Panel flotante de ajustes del grafo (como los ajustes del grafo de Obsidian): buscar, filtros,
// resaltados, apariencia y disposición. Colapsable; recuerda si quedó abierto.

import { useId, type ReactNode } from 'react'
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { LIMITES_GROSOR, LIMITES_UMBRAL, useGrafo, type PrefsGrafo } from '../../store/grafo'
import { useShallow } from 'zustand/react/shallow'
import { Tip } from '../../components/Tip'

type ClaveBool = { [K in keyof PrefsGrafo]: PrefsGrafo[K] extends boolean ? K : never }[keyof PrefsGrafo]

function Interruptor({ clave, etiqueta, ayuda, deshabilitado }: { clave: ClaveBool; etiqueta: string; ayuda?: string; deshabilitado?: boolean }) {
  const valor = useGrafo((s) => s[clave])
  const alternar = useGrafo((s) => s.alternar)
  const id = useId()
  return (
    <div className={`pg-fila${deshabilitado ? ' pg-fila-off' : ''}`}>
      <label htmlFor={id} className="pg-etiqueta">
        {etiqueta}
        {ayuda && <span className="pg-ayuda">{ayuda}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="pg-switch"
        checked={valor}
        disabled={deshabilitado}
        onChange={() => alternar(clave)}
      />
    </div>
  )
}

function Segmentado<T extends string>({
  etiqueta,
  valor,
  opciones,
  onCambiar,
}: {
  etiqueta: string
  valor: T
  opciones: { id: T; etiqueta: string }[]
  onCambiar: (v: T) => void
}) {
  const nombre = useId()
  return (
    <fieldset className="pg-segmentado">
      <legend className="pg-etiqueta">{etiqueta}</legend>
      <div className="pg-seg-opciones">
        {opciones.map((o) => (
          <label key={o.id} className={`pg-seg${valor === o.id ? ' pg-seg-activa' : ''}`}>
            <input type="radio" name={nombre} value={o.id} checked={valor === o.id} onChange={() => onCambiar(o.id)} />
            {o.etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Rango({
  etiqueta,
  valor,
  limites,
  formato,
  onCambiar,
}: {
  etiqueta: string
  valor: number
  limites: { min: number; max: number; paso: number }
  formato: (v: number) => string
  onCambiar: (v: number) => void
}) {
  const id = useId()
  return (
    <div className="pg-rango">
      <div className="pg-fila-entre">
        <label htmlFor={id} className="pg-etiqueta">
          {etiqueta}
        </label>
        <output htmlFor={id} className="pg-salida mono">
          {formato(valor)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={limites.min}
        max={limites.max}
        step={limites.paso}
        value={valor}
        aria-valuetext={formato(valor)}
        onChange={(e) => onCambiar(Number(e.target.value))}
      />
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pg-seccion">
      <h3 className="pg-titulo-seccion">{titulo}</h3>
      {children}
    </section>
  )
}

interface Props {
  coincidencias: number
  haySeleccion: boolean
  onBuscarEnter: () => void
  onRestablecerDisposicion: () => void
}

export function PanelGrafo({ coincidencias, haySeleccion, onBuscarEnter, onRestablecerDisposicion }: Props) {
  const p = useGrafo(
    useShallow((s) => ({
      panelAbierto: s.panelAbierto,
      busqueda: s.busqueda,
      cadena: s.cadena,
      tamano: s.tamano,
      grosor: s.grosor,
      umbralTexto: s.umbralTexto,
      colorearPor: s.colorearPor,
      disposicion: s.disposicion,
    })),
  )
  const fijar = useGrafo((s) => s.fijar)
  const buscar = useGrafo((s) => s.buscar)
  const restablecerPrefs = useGrafo((s) => s.restablecerPrefs)
  const idCuerpo = useId()
  const idBusqueda = useId()

  return (
    <div className={`panel-grafo${p.panelAbierto ? ' panel-grafo-abierto' : ''}`}>
      <Tip texto={p.panelAbierto ? 'Ocultar ajustes del grafo' : 'Ajustes del grafo: filtros, resaltados y disposición'} side="left">
        <button
          type="button"
          className="pg-cabecera"
          aria-label="Ajustes del grafo"
          aria-expanded={p.panelAbierto}
          aria-controls={p.panelAbierto ? idCuerpo : undefined}
          onClick={() => fijar('panelAbierto', !p.panelAbierto)}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Ajustes del grafo</span>
          <ChevronDown size={16} strokeWidth={1.5} className="pg-chevron" aria-hidden="true" />
        </button>
      </Tip>

      {p.panelAbierto && (
        <div className="pg-cuerpo" id={idCuerpo}>
          <div className="pg-buscador">
            <Search size={14} strokeWidth={1.5} aria-hidden="true" />
            <label htmlFor={idBusqueda} className="solo-lectores">
              Buscar materia en el grafo
            </label>
            <input
              id={idBusqueda}
              data-buscador="grafo"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Buscar en el grafo…"
              value={p.busqueda}
              onChange={(e) => buscar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onBuscarEnter()
                } else if (e.key === 'Escape' && p.busqueda) {
                  e.stopPropagation()
                  buscar('')
                }
              }}
            />
            {p.busqueda && (
              <button type="button" className="pg-limpiar" aria-label="Limpiar búsqueda" onClick={() => buscar('')}>
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>
          {p.busqueda.trim() && (
            <p className="pg-ayuda pg-resultado" role="status">
              {coincidencias === 0
                ? 'Ninguna materia coincide.'
                : `${coincidencias} ${coincidencias === 1 ? 'coincidencia' : 'coincidencias'} · Enter para centrar`}
            </p>
          )}

          <Seccion titulo="Filtros">
            <Interruptor clave="blandas" etiqueta="Aristas blandas" ayuda="Relaciones que no son prerrequisito oficial" />
            <Interruptor clave="soloDisponibles" etiqueta="Solo materias disponibles" />
            <Interruptor clave="ocultarBloqueadas" etiqueta="Ocultar bloqueadas" />
          </Seccion>

          <Seccion titulo="Resaltados">
            <Interruptor clave="cadena" etiqueta="Cadena crítica" ayuda="La secuencia de prerrequisitos más larga" />
            <Interruptor clave="flujo" etiqueta="Flujo animado en la cadena" deshabilitado={!p.cadena} />
            <Interruptor clave="cuellos" etiqueta="Cuellos de botella" ayuda="Las 5 materias con mayor intermediación" />
            <Interruptor
              clave="descendientes"
              etiqueta="Descendientes de la seleccionada"
              ayuda={haySeleccion ? 'Todo lo que depende de ella' : 'Selecciona una materia para verlos'}
            />
          </Seccion>

          <Seccion titulo="Apariencia">
            <Segmentado
              etiqueta="Tamaño de nodo"
              valor={p.tamano}
              onCambiar={(v) => fijar('tamano', v)}
              opciones={[
                { id: 'creditos', etiqueta: 'Créditos' },
                { id: 'intermediacion', etiqueta: 'Intermediación' },
                { id: 'uniforme', etiqueta: 'Uniforme' },
              ]}
            />
            <Segmentado
              etiqueta="Colorear por"
              valor={p.colorearPor}
              onCambiar={(v) => fijar('colorearPor', v)}
              opciones={[
                { id: 'estado', etiqueta: 'Estado' },
                { id: 'semestre', etiqueta: 'Semestre' },
              ]}
            />
            <Rango
              etiqueta="Grosor de aristas"
              valor={p.grosor}
              limites={LIMITES_GROSOR}
              formato={(v) => `${v.toFixed(2)} px`}
              onCambiar={(v) => fijar('grosor', v)}
            />
            <Rango
              etiqueta="Umbral de texto"
              valor={p.umbralTexto}
              limites={LIMITES_UMBRAL}
              formato={(v) => (v === 0 ? 'siempre' : `zoom ${v.toFixed(2)}×`)}
              onCambiar={(v) => fijar('umbralTexto', v)}
            />
          </Seccion>

          <Seccion titulo="Disposición">
            <Segmentado
              etiqueta="Organizar"
              valor={p.disposicion}
              onCambiar={(v) => fijar('disposicion', v)}
              opciones={[
                { id: 'semestre', etiqueta: 'Por semestre' },
                { id: 'organico', etiqueta: 'Orgánico' },
              ]}
            />
            <p className="pg-ayuda">
              {p.disposicion === 'organico' ? 'Puedes arrastrar las materias.' : 'Columnas de izquierda a derecha, ordenadas para cruzar menos.'}
            </p>
            <div className="pg-acciones">
              <button type="button" className="btn" onClick={onRestablecerDisposicion}>
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
                Restablecer disposición
              </button>
              <button type="button" className="btn btn-fantasma" onClick={restablecerPrefs}>
                Ajustes por defecto
              </button>
            </div>
          </Seccion>
        </div>
      )}
    </div>
  )
}
