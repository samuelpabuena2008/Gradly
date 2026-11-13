import { useMemo, useState } from 'react'
import type { Malla, Modelo, Nota } from './types'
import mallaJson from '../../data/malla_sistemas.json'
import pesosJson from '../../data/pesos.json'
import { predecirSiguientes, tipoRecomendado, ultimasNotas, type TipoModelo } from './lib/model/predict'
import { MallaGrafo } from './features/malla/MallaGrafo'
import { AnalisisMalla } from './features/malla/AnalisisMalla'
import { ImportarNotas } from './features/notas/ImportarNotas'
import { PanelPrediccion } from './features/prediccion/PanelPrediccion'

const malla = mallaJson as Malla
const modelo = pesosJson as Modelo
// La validación cruzada de model/ decide qué modelo se ofrece primero.
const recomendado = tipoRecomendado(modelo)

export default function App() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [tipoModelo, setTipoModelo] = useState<TipoModelo>(recomendado)

  const mapaNotas = useMemo(() => ultimasNotas(notas), [notas])
  const predicciones = useMemo(
    () => predecirSiguientes(malla, modelo, notas, tipoModelo),
    [notas, tipoModelo],
  )

  return (
    <div className="app">
      <header>
        <h1>Gradly</h1>
        <p>
          {malla.programa} · malla {malla.version}
        </p>
      </header>
      <main>
        <MallaGrafo
          malla={malla}
          notas={mapaNotas}
          predicciones={predicciones}
          seleccionada={seleccionada}
          onSeleccionar={setSeleccionada}
        />
        <aside>
          <ImportarNotas malla={malla} notas={notas} onCambiar={setNotas} />
          <PanelPrediccion
            malla={malla}
            predicciones={predicciones}
            onSeleccionar={setSeleccionada}
            tipoModelo={tipoModelo}
            recomendado={recomendado}
            onCambiarTipo={setTipoModelo}
          />
          <AnalisisMalla malla={malla} seleccionada={seleccionada} />
        </aside>
      </main>
    </div>
  )
}
