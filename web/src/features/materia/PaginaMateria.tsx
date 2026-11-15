// Página de una materia (pestaña, estilo «nota» de Obsidian). Versión base de la Fase 2:
// título, propiedades y enlaces entre materias. La Fase 4 agrega rango, «por qué» y mini-grafo.

import { useMemo } from 'react'
import { Semaforo } from '../../components/Semaforo'
import { predecesores } from '../../lib/graph/dag'
import { estadoMateria, valorMateria } from '../../lib/ui/estado'
import { useDatos, useEscenario } from '../../store/escenario'
import { abrirMateria } from '../shell/acciones'
import './materia.css'

const ESTADO_TEXTO = {
  aprobada: 'Aprobada',
  reprobada: 'Por repetir',
  disponible: 'Disponible para inscribir',
  bloqueada: 'Bloqueada: faltan prerrequisitos',
} as const

export function PaginaMateria({ id }: { id: string }) {
  const { malla, materiaPorId } = useDatos()
  const escenario = useEscenario()
  const materia = materiaPorId.get(id)

  const { previas, dependientes } = useMemo(
    () => ({
      previas: predecesores(malla, id),
      dependientes: malla.prerrequisitos.filter((e) => e.de === id).map((e) => e.a),
    }),
    [malla, id],
  )

  if (!materia) {
    return (
      <div className="materia materia-vacia">
        <h1 className="materia-titulo">No encontramos la materia {id}</h1>
        <p className="ayuda">Ese código no está en la malla {malla.version}. Elige una materia del explorador.</p>
      </div>
    )
  }

  const estado = estadoMateria(id, malla, escenario.mapaNotas, escenario.prediccionPorId)
  const valor = valorMateria(estado)
  const enlace = (otra: string) => (
    <li key={otra}>
      <button type="button" className="materia-enlace" onClick={() => abrirMateria(otra)}>
        {materiaPorId.get(otra)?.nombre ?? otra}
        <span className="mono materia-codigo">{otra}</span>
      </button>
    </li>
  )

  return (
    <article className="materia">
      <h1 className="materia-titulo">{materia.nombre}</h1>
      <table className="materia-propiedades">
        <tbody>
          <tr>
            <th scope="row">Código</th>
            <td className="mono">{materia.id}</td>
          </tr>
          <tr>
            <th scope="row">Semestre</th>
            <td className="num">{materia.semestre}</td>
          </tr>
          <tr>
            <th scope="row">Créditos</th>
            <td className="num">{materia.creditos}</td>
          </tr>
          <tr>
            <th scope="row">Estado</th>
            <td>
              {ESTADO_TEXTO[estado.tipo]}
              {estado.tipo === 'disponible' && estado.prediccion && (
                <>
                  {' '}
                  <Semaforo nivel={estado.prediccion.semaforo} />
                </>
              )}
            </td>
          </tr>
          {valor && (
            <tr>
              <th scope="row">{estado.tipo === 'disponible' ? 'Nota esperada' : 'Nota'}</th>
              <td className="mono">{valor}</td>
            </tr>
          )}
        </tbody>
      </table>

      <section aria-labelledby="mat-previas">
        <h2 id="mat-previas" className="materia-seccion">
          Prerrequisitos
        </h2>
        {previas.length > 0 ? <ul className="materia-lista">{previas.map(enlace)}</ul> : <p className="ayuda">Esta materia no tiene prerrequisitos.</p>}
      </section>

      <section aria-labelledby="mat-entrantes">
        <h2 id="mat-entrantes" className="materia-seccion">
          Enlaces entrantes
        </h2>
        {dependientes.length > 0 ? (
          <>
            <p className="ayuda">Materias que dependen de esta:</p>
            <ul className="materia-lista">{dependientes.map(enlace)}</ul>
          </>
        ) : (
          <p className="ayuda">Ninguna materia depende directamente de esta.</p>
        )}
      </section>
    </article>
  )
}
