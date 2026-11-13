// Predicción por materia, semáforo, "por qué" y recomendación de enfoque.
// Lenguaje: "enfócate en esto", nunca "vas a perder".

import type { Malla, Prediccion } from '../../types'
import type { TipoModelo } from '../../lib/model/predict'
import { recomendarContenidosCruzados, recomendarEnfoque } from '../../lib/model/predict'
import './prediccion.css'

interface Props {
  malla: Malla
  predicciones: Prediccion[]
  onSeleccionar: (id: string) => void
  /** Modelo con el que se calcularon las predicciones. */
  tipoModelo: TipoModelo
  /** Modelo que recomienda la validación cruzada de model/. */
  recomendado: TipoModelo
  onCambiarTipo: (tipo: TipoModelo) => void
}

const TEXTO_SEMAFORO = {
  verde: 'Vas bien preparado',
  amarillo: 'Conviene reforzar',
  rojo: 'Dale prioridad',
} as const

const NOMBRE_MODELO: Record<TipoModelo, string> = {
  regresion: 'Regresión',
  red: 'Red neuronal (MLP)',
}

export function PanelPrediccion({
  malla,
  predicciones,
  onSeleccionar,
  tipoModelo,
  recomendado,
  onCambiarTipo,
}: Props) {
  const nombre = (id: string) => malla.materias.find((m) => m.id === id)?.nombre ?? id
  const enfoque = recomendarEnfoque(predicciones, malla)

  // Selector compacto: dos botones con el modelo activo marcado.
  const selector = (
    <div className="selector-modelo" role="group" aria-label="Modelo de predicción">
      {(['regresion', 'red'] as const).map((tipo) => (
        <button
          key={tipo}
          type="button"
          className={tipo === tipoModelo ? 'activo' : undefined}
          aria-pressed={tipo === tipoModelo}
          onClick={() => onCambiarTipo(tipo)}
        >
          {NOMBRE_MODELO[tipo]}
          {tipo === recomendado ? ' (recomendado)' : ''}
        </button>
      ))}
    </div>
  )

  if (predicciones.length === 0) {
    return (
      <section className="tarjeta">
        <div className="fila-entre">
          <h2>Próximo semestre</h2>
          {selector}
        </div>
        <p className="ayuda">Carga tus notas para ver cómo te puede ir en las materias que vienen.</p>
      </section>
    )
  }

  return (
    <section className="tarjeta">
      <div className="fila-entre">
        <h2>Próximo semestre</h2>
        {selector}
      </div>
      <p className="ayuda modelo-activo">
        Predicciones con {NOMBRE_MODELO[tipoModelo].toLowerCase()}. Cambia de modelo para comparar notas,
        rangos y explicaciones.
      </p>
      {enfoque.length > 0 && (
        <div className="enfoque">
          <strong>Enfócate en repasar:</strong> {enfoque.map((e) => nombre(e.materia)).join(', ')}
        </div>
      )}
      <ul className="predicciones">
        {[...predicciones]
          .sort((a, b) => b.probNoAprobar - a.probNoAprobar)
          .map((p) => {
            // La propia función devuelve [] cuando el semáforo está en verde.
            const contenidos = recomendarContenidosCruzados(p, malla)
            return (
              <li key={p.materia} className={`prediccion borde-${p.semaforo}`} onClick={() => onSeleccionar(p.materia)}>
                <div className="fila-entre">
                  <strong>{nombre(p.materia)}</strong>
                  <span className={`chip chip-${p.semaforo}`}>{TEXTO_SEMAFORO[p.semaforo]}</span>
                </div>
                <div>
                  Nota esperada {p.nota.toFixed(1)} (entre {p.rango[0].toFixed(1)} y {p.rango[1].toFixed(1)})
                </div>
                {p.porQue.length > 0 ? (
                  <div className="ayuda">
                    Por qué:{' '}
                    {p.porQue
                      .map((c) => `${nombre(c.materia)} ${c.aporte >= 0 ? '+' : '−'}${Math.abs(c.aporte).toFixed(2)}`)
                      .join(', ')}
                  </div>
                ) : (
                  !p.usaModelo && <div className="ayuda">Basado en la media de la materia y en tu nivel (aún no hay pesos para esta materia).</div>
                )}
                {contenidos.length > 0 && (
                  <div className="contenidos">
                    <div className="contenidos-titulo">Temas puntuales a reforzar:</div>
                    <ul>
                      {contenidos.map((c) => (
                        <li key={c.previa}>
                          <span className="contenidos-previa">{nombre(c.previa)}</span>
                          <span className="contenidos-temas">{c.temas.map((t) => t.trim()).join(' · ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
      </ul>
    </section>
  )
}
