// Selector de modelo (segmented control accesible, basado en radios nativos: las flechas del
// teclado ya funcionan). Si `pesos.json` no trae red, esa opción se deshabilita y se explica por qué.

import { useId } from 'react'
import type { TipoModelo } from '../lib/model/predict'
import type { Modelo } from '../types'
import { NOMBRE_MODELO, tieneRed } from '../lib/ui/modelos'
import './selector-modelo.css'

interface Props {
  modelo: Modelo
  tipo: TipoModelo
  recomendado: TipoModelo
  onCambiar: (tipo: TipoModelo) => void
}

const OPCIONES: TipoModelo[] = ['regresion', 'red']

export function SelectorModelo({ modelo, tipo, recomendado, onCambiar }: Props) {
  const nombre = useId()
  const idNota = useId()
  const redDisponible = tieneRed(modelo)

  return (
    <div className="selector-modelo-caja">
      <div className="segmentado" role="radiogroup" aria-label="Modelo de predicción" aria-describedby={redDisponible ? undefined : idNota}>
        {OPCIONES.map((op) => {
          const deshabilitada = op === 'red' && !redDisponible
          return (
            <label key={op} className={`segmento${tipo === op ? ' segmento-activo' : ''}${deshabilitada ? ' segmento-off' : ''}`}>
              <input
                type="radio"
                name={nombre}
                value={op}
                checked={tipo === op}
                disabled={deshabilitada}
                onChange={() => onCambiar(op)}
              />
              <span>{NOMBRE_MODELO[op]}</span>
              {op === recomendado && !deshabilitada && <span className="segmento-insignia">recomendado</span>}
            </label>
          )
        })}
      </div>
      {!redDisponible && (
        <p id={idNota} className="ayuda selector-modelo-nota">
          Este modelo no trae red neuronal, así que solo está disponible la regresión.
        </p>
      )}
    </div>
  )
}
