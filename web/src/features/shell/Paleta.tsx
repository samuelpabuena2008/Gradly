// Paleta de comandos (Ctrl/⌘+K): búsqueda difusa, historial reciente y navegación por teclado.

import * as Dialog from '@radix-ui/react-dialog'
import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRetornoFoco } from '../../components/useRetornoFoco'
import { filtrarDifuso } from '../../lib/ui/fuzzy'
import { guardarJson, leerJson } from '../../lib/ui/almacenamiento'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { construirComandos, type Comando } from './comandos'
import '../../components/dialogos.css'
import './paleta.css'

const CLAVE_RECIENTES = 'gradly:recientes'
const MAX_RECIENTES = 5
const MAX_RESULTADOS = 30

function Contenido({ onCerrar }: { onCerrar: () => void }) {
  const datos = useDatos()
  const { tipoModelo } = useEscenario()
  const idLista = useId()
  const retornoFoco = useRetornoFoco()
  const [consulta, setConsulta] = useState('')
  const [activo, setActivo] = useState(0)
  const [recientes, setRecientes] = useState<string[]>(() => {
    const guardados = leerJson<unknown>(CLAVE_RECIENTES, [])
    return Array.isArray(guardados) ? guardados.filter((x): x is string => typeof x === 'string') : []
  })
  const lista = useRef<HTMLUListElement>(null)

  const comandos = useMemo(() => construirComandos(datos, tipoModelo), [datos, tipoModelo])

  const filas = useMemo(() => {
    if (consulta.trim() !== '') {
      return filtrarDifuso(comandos, consulta, (c) => `${c.titulo} ${c.detalle ?? ''} ${c.palabras ?? ''}`)
        .slice(0, MAX_RESULTADOS)
        .map((c) => ({ comando: c, grupo: c.grupo as string }))
    }
    // Sin búsqueda: recientes primero, luego vistas y acciones (las 50 materias aparecen al escribir).
    const porId = new Map(comandos.map((c) => [c.id, c]))
    const rec = recientes.map((id) => porId.get(id)).filter((c): c is Comando => Boolean(c))
    const resto = comandos.filter((c) => c.grupo !== 'Materias' && !rec.includes(c))
    return [
      ...rec.map((c) => ({ comando: c, grupo: 'Recientes' })),
      ...resto.map((c) => ({ comando: c, grupo: c.grupo as string })),
    ]
  }, [consulta, comandos, recientes])

  const activoSeguro = Math.min(activo, Math.max(0, filas.length - 1))

  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [activoSeguro, filas])

  function ejecutar(c: Comando) {
    const nuevos = [c.id, ...recientes.filter((id) => id !== c.id)].slice(0, MAX_RECIENTES)
    setRecientes(nuevos)
    guardarJson(CLAVE_RECIENTES, nuevos)
    onCerrar()
    // Después de cerrar, para que el foco quede donde la acción lo necesite.
    setTimeout(c.ejecutar, 0)
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((activoSeguro + 1) % Math.max(1, filas.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((activoSeguro - 1 + filas.length) % Math.max(1, filas.length))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActivo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActivo(Math.max(0, filas.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const fila = filas[activoSeguro]
      if (fila) ejecutar(fila.comando)
    }
  }

  const idOpcion = (i: number) => `${idLista}-op-${i}`
  const buscando = consulta.trim() !== ''

  return (
    <Dialog.Content className="paleta" aria-describedby={undefined} {...retornoFoco}>
      <Dialog.Title className="solo-lectores">Paleta de comandos</Dialog.Title>
      <div className="paleta-buscador">
        <Search size={16} strokeWidth={1.5} aria-hidden="true" />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={idLista}
          aria-activedescendant={filas.length > 0 ? idOpcion(activoSeguro) : undefined}
          aria-label="Buscar materia, vista o acción"
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar materia, vista o acción…"
          value={consulta}
          onChange={(e) => {
            setConsulta(e.target.value)
            setActivo(0)
          }}
          onKeyDown={alTeclear}
        />
        <kbd className="paleta-esc">Esc</kbd>
      </div>

      {filas.length === 0 ? (
        <p className="paleta-vacio" role="status">
          Nada coincide con «{consulta}». Prueba con el nombre o el código de una materia.
        </p>
      ) : (
        <ul className="paleta-lista" role="listbox" id={idLista} aria-label="Resultados" ref={lista}>
          {filas.map(({ comando: c, grupo }, i) => {
            const Icono = c.icono
            const nuevoGrupo = !buscando && (i === 0 || filas[i - 1].grupo !== grupo)
            return (
              <li key={`${grupo}:${c.id}`} role="presentation">
                {nuevoGrupo && <div className="paleta-grupo" role="presentation">{grupo}</div>}
                <div
                  id={idOpcion(i)}
                  role="option"
                  aria-selected={i === activoSeguro}
                  className={`paleta-opcion${i === activoSeguro ? ' paleta-activa' : ''}`}
                  onMouseMove={() => i !== activoSeguro && setActivo(i)}
                  onClick={() => ejecutar(c)}
                >
                  <Icono size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span className="paleta-titulo">{c.titulo}</span>
                  {c.detalle && <span className="paleta-detalle">{c.detalle}</span>}
                  {buscando && <span className="paleta-etiqueta">{c.grupo}</span>}
                  {c.atajo && <kbd className="paleta-atajo">{c.atajo}</kbd>}
                  {i === activoSeguro && <CornerDownLeft size={14} strokeWidth={1.5} className="paleta-enter" aria-hidden="true" />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog.Content>
  )
}

export function Paleta() {
  const abierta = useApp((s) => s.paletaAbierta)
  const abrirPaleta = useApp((s) => s.abrirPaleta)
  return (
    <Dialog.Root open={abierta} onOpenChange={abrirPaleta}>
      <Dialog.Portal>
        <Dialog.Overlay className="dlg-overlay" />
        <Contenido onCerrar={() => abrirPaleta(false)} />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
