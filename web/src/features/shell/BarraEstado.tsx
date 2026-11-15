// Barra de estado inferior (24 px): privacidad, notas, promedio, nivel, modelo, versión de la malla y atajos.

import { CircleHelp, Lock } from 'lucide-react'
import { Tip } from '../../components/Tip'
import { usePantalla } from '../../components/usePantalla'
import { describirNivel } from '../../lib/ui/estado'
import { NOMBRE_MODELO, tieneRed } from '../../lib/ui/modelos'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { alternarModelo } from './acciones'

export function BarraEstado() {
  const datos = useDatos()
  const escenario = useEscenario()
  const abrirAtajos = useApp((s) => s.abrirAtajos)
  const movil = usePantalla() === 'movil'
  const persistirNotas = useApp((s) => s.persistirNotas)
  const redDisponible = tieneRed(datos.modelo)
  const nNotas = escenario.mapaReales.size
  const textoNotas = nNotas === 1 ? '1 nota' : `${nNotas} notas`

  return (
    <footer className="statusbar" aria-label="Estado">
      <span className="status-item status-privacidad">
        <Lock size={12} strokeWidth={1.75} aria-hidden="true" />
        {persistirNotas ? 'Tus notas se guardan solo en este navegador' : 'Tus notas no salen de este navegador'}
      </span>
      <span className="status-sep" aria-hidden="true" />
      <span className="status-item num">{textoNotas}</span>
      {escenario.promedio !== null && (
        <>
          <span className="status-sep status-no-movil" aria-hidden="true" />
          <span className="status-item status-no-movil">
            Promedio <span className="mono">{escenario.promedio.toFixed(2)}</span>
          </span>
        </>
      )}
      {escenario.nivel !== null && (
        <>
          <span className="status-sep status-opcional" aria-hidden="true" />
          <span className="status-item status-opcional">{describirNivel(escenario.nivel)}</span>
        </>
      )}
      {escenario.hipotetico && (
        <>
          <span className="status-sep" aria-hidden="true" />
          <span className="status-item status-hipotetico">Escenario hipotético</span>
        </>
      )}

      <span className="status-relleno" />

      {movil ? (
        // En el celular la barra solo informa: el modelo se cambia en Predicciones, con un control de tamaño táctil.
        <span className="status-item">{NOMBRE_MODELO[escenario.tipoModelo]}</span>
      ) : (
        <Tip texto={redDisponible ? 'Cambiar de modelo' : 'Este modelo no incluye red neuronal'} side="top">
          <button
            type="button"
            className="status-boton"
            onClick={() => alternarModelo(datos, escenario.tipoModelo)}
            aria-label={`Modelo activo: ${NOMBRE_MODELO[escenario.tipoModelo]}. ${redDisponible ? 'Clic para cambiar.' : 'No hay otro modelo disponible.'}`}
          >
            {NOMBRE_MODELO[escenario.tipoModelo]}
          </button>
        </Tip>
      )}
      <span className="status-sep status-opcional" aria-hidden="true" />
      <span className="status-item status-opcional">Malla {datos.malla.version}</span>
      {!movil && (
        <Tip texto="Atajos de teclado" atajo="?" side="top">
          <button type="button" className="status-boton" aria-label="Atajos de teclado" onClick={() => abrirAtajos(true)}>
            <CircleHelp size={13} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Tip>
      )}
    </footer>
  )
}
