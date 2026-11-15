// Página de una materia (pestaña, estilo «nota» de Obsidian): título, propiedades y bloques de
// predicción, por qué, temas a reforzar, relaciones, comparación de modelos e historial de intentos.

import { useCallback, useMemo } from 'react'
import { AvisoPocasNotas } from '../../components/AvisoPocasNotas'
import { Semaforo } from '../../components/Semaforo'
import { predecesores } from '../../lib/graph/dag'
import { estadoMateria } from '../../lib/ui/estado'
import { fmtNota } from '../../lib/ui/formato'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { BloqueComparar, BloqueIntentos, BloquePorQue, BloquePrediccion, BloqueRelaciones, BloqueTemas } from './bloques'
import './materia.css'

const ESTADO_TEXTO = {
  aprobada: 'Aprobada',
  reprobada: 'Por repetir',
  disponible: 'Disponible para inscribir',
  bloqueada: 'Bloqueada: faltan prerrequisitos',
} as const

export function PaginaMateria({ id }: { id: string }) {
  const { malla, modelo, materiaPorId } = useDatos()
  const escenario = useEscenario()
  const notasReales = useApp((s) => s.notasReales)
  const materia = materiaPorId.get(id)

  const { previas, dependientes } = useMemo(
    () => ({
      previas: predecesores(malla, id),
      dependientes: malla.prerrequisitos.filter((e) => e.de === id).map((e) => e.a),
    }),
    [malla, id],
  )
  const estadoDe = useCallback(
    (otra: string) => estadoMateria(otra, malla, escenario.mapaNotas, escenario.prediccionPorId),
    [malla, escenario.mapaNotas, escenario.prediccionPorId],
  )
  const nombreDe = useCallback((otra: string) => materiaPorId.get(otra)?.nombre ?? otra, [materiaPorId])

  if (!materia) {
    return (
      <div className="materia materia-vacia">
        <h1 className="materia-titulo">No encontramos la materia {id}</h1>
        <p className="ayuda">Ese código no está en la malla {malla.version}. Elige una materia del explorador.</p>
      </div>
    )
  }

  const estado = estadoDe(id)
  const p = estado.prediccion
  const faltantes = previas.filter((previa) => estadoDe(previa).tipo !== 'aprobada')
  const notaVigente = estado.nota ?? p?.nota

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
              {p && (
                <>
                  {' '}
                  <Semaforo nivel={p.semaforo} />
                </>
              )}
            </td>
          </tr>
          {notaVigente !== undefined && Number.isFinite(notaVigente) && (
            <tr>
              <th scope="row">{estado.tipo === 'disponible' ? 'Nota esperada' : 'Nota'}</th>
              <td className="mono">{fmtNota(notaVigente)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {p && <AvisoPocasNotas cantidad={escenario.mapaReales.size} />}
      <BloquePrediccion
        estado={estado}
        hayNotas={escenario.mapaNotas.size > 0}
        aprobacion={malla.nota_aprobacion}
        tipoModelo={escenario.tipoModelo}
        faltantes={faltantes}
        nombreDe={nombreDe}
        hipotetica={escenario.hipoteticas.has(id)}
      />
      <BloquePorQue p={p} nombreDe={nombreDe} />
      <BloqueTemas p={p} malla={malla} nombreDe={nombreDe} />
      <BloqueRelaciones
        malla={malla}
        materia={materia}
        previas={previas}
        dependientes={dependientes}
        materiaPorId={materiaPorId}
        estadoDe={estadoDe}
      />
      <BloqueComparar
        id={id}
        malla={malla}
        modelo={modelo}
        notas={escenario.mapaNotas}
        tipoModelo={escenario.tipoModelo}
        hayPrediccion={Boolean(p)}
      />
      <BloqueIntentos id={id} reales={notasReales} aprobacion={malla.nota_aprobacion} />
    </article>
  )
}
