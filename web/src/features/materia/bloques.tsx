// Bloques de la página de materia (estilo «nota» de Obsidian): predicción, por qué, temas a reforzar,
// relaciones (prerrequisitos, enlaces entrantes, mini-grafo), comparación de modelos e historial.

import { useMemo } from 'react'
import type { Malla, Materia, Modelo, Nota, Prediccion } from '../../types'
import { AnilloProbabilidad } from '../../components/AnilloProbabilidad'
import { BarraRango } from '../../components/BarraRango'
import { GrafoSvg, type AristaSvg, type NodoSvg } from '../../components/GrafoSvg'
import { Semaforo } from '../../components/Semaforo'
import { recomendarContenidosCruzados } from '../../lib/model/predict'
import { compararModelos } from '../../lib/ui/comparar'
import type { EstadoMateria } from '../../lib/ui/estado'
import { fmtDelta, fmtNota } from '../../lib/ui/formato'
import { historialIntentos } from '../../lib/ui/intentos'
import { NOMBRE_MODELO } from '../../lib/ui/modelos'
import type { TipoModelo } from '../../lib/model/predict'
import { layoutVecindario, vecindario } from '../../lib/ui/vecindario'
import { abrirMateria } from '../shell/acciones'

type NombreDe = (id: string) => string

export function EnlaceMateria({ id, nombreDe }: { id: string; nombreDe: NombreDe }) {
  return (
    <button type="button" className="materia-enlace" onClick={() => abrirMateria(id)}>
      {nombreDe(id)}
      <span className="mono materia-codigo">{id}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Predicción
// ---------------------------------------------------------------------------

interface PropsPrediccion {
  estado: EstadoMateria
  hayNotas: boolean
  aprobacion: number
  tipoModelo: TipoModelo
  faltantes: string[]
  nombreDe: NombreDe
  hipotetica: boolean
}

export function BloquePrediccion({ estado, hayNotas, aprobacion, tipoModelo, faltantes, nombreDe, hipotetica }: PropsPrediccion) {
  const p = estado.prediccion
  if (estado.tipo === 'aprobada' || estado.tipo === 'reprobada') {
    return (
      <section className="materia-bloque" aria-labelledby="mat-prediccion">
        <h2 id="mat-prediccion" className="materia-seccion">
          Tu nota
        </h2>
        <p className="materia-nota-grande mono">
          {fmtNota(estado.nota)}
          {hipotetica && <span className="etiqueta-hipotetica">hipotética</span>}
        </p>
        <p className="ayuda">
          {estado.tipo === 'aprobada'
            ? `Aprobada: se aprueba con ${fmtNota(aprobacion)} o más.`
            : 'Quedó por debajo de la nota de aprobación. Cuenta tu intento más reciente; puedes repetirla.'}
        </p>
      </section>
    )
  }

  if (!p) {
    return (
      <section className="materia-bloque" aria-labelledby="mat-prediccion">
        <h2 id="mat-prediccion" className="materia-seccion">
          Predicción
        </h2>
        {!hayNotas ? (
          <p className="ayuda">Carga tus notas para ver cómo te puede ir en esta materia.</p>
        ) : faltantes.length > 0 ? (
          <>
            <p className="ayuda">Todavía no hay predicción: primero faltan estos prerrequisitos por aprobar.</p>
            <ul className="materia-lista">
              {faltantes.map((id) => (
                <li key={id}>
                  <EnlaceMateria id={id} nombreDe={nombreDe} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="ayuda">Todavía no hay una predicción para esta materia.</p>
        )}
      </section>
    )
  }

  return (
    <section className="materia-bloque" aria-labelledby="mat-prediccion">
      <h2 id="mat-prediccion" className="materia-seccion">
        Predicción
      </h2>
      <div className="prediccion-hero">
        <div className="prediccion-nota">
          <span className="prediccion-etiqueta">Nota esperada</span>
          <span className="prediccion-valor mono">{fmtNota(p.nota)}</span>
          <Semaforo nivel={p.semaforo} />
          {hipotetica && <span className="etiqueta-hipotetica">escenario hipotético</span>}
        </div>
        <AnilloProbabilidad probabilidad={p.probNoAprobar} semaforo={p.semaforo} />
        <div className="prediccion-rango">
          <span className="prediccion-etiqueta">
            Rango probable: <span className="mono">{fmtNota(p.rango[0])} – {fmtNota(p.rango[1])}</span>
          </span>
          <BarraRango nota={p.nota} rango={p.rango} aprobacion={aprobacion} semaforo={p.semaforo} />
        </div>
      </div>
      <p className="ayuda">
        Es una estimación con {NOMBRE_MODELO[tipoModelo].toLowerCase()}, no una sentencia. La línea discontinua marca la nota de
        aprobación ({fmtNota(aprobacion)}).
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Por qué
// ---------------------------------------------------------------------------

export function BloquePorQue({ p, nombreDe }: { p: Prediccion | undefined; nombreDe: NombreDe }) {
  if (!p) return null
  const contribuciones = p.porQue.filter((c) => Number.isFinite(c.aporte))
  const maximo = Math.max(0.01, ...contribuciones.map((c) => Math.abs(c.aporte)))
  return (
    <section className="materia-bloque" aria-labelledby="mat-porque">
      <h2 id="mat-porque" className="materia-seccion">
        Por qué
      </h2>
      {contribuciones.length === 0 ? (
        <p className="ayuda">
          {p.usaModelo
            ? 'Ninguna materia previa pesa lo suficiente como para destacarla: la estimación parte de la media de la materia y de tu nivel.'
            : 'Esta predicción está basada en la media de la materia y tu nivel: aún no hay pesos propios para ella.'}
        </p>
      ) : (
        <>
          <p className="ayuda">Las materias previas que más pesan. Hacia la derecha suben la estimación; hacia la izquierda la bajan.</p>
          <ul className="divergente" aria-label="Aporte de cada materia previa a la predicción">
            {contribuciones.map((c) => {
              const positivo = c.aporte >= 0
              return (
                <li key={c.materia} className="divergente-fila">
                  <EnlaceMateria id={c.materia} nombreDe={nombreDe} />
                  <span className="divergente-pista" aria-hidden="true">
                    <span
                      className={`divergente-barra ${positivo ? 'divergente-mas' : 'divergente-menos'}`}
                      style={{ width: `${(Math.abs(c.aporte) / maximo) * 50}%` }}
                    />
                  </span>
                  <span className={`mono divergente-valor ${positivo ? 'divergente-mas-texto' : 'divergente-menos-texto'}`}>
                    {fmtDelta(c.aporte, 2)}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Temas puntuales a reforzar
// ---------------------------------------------------------------------------

export function BloqueTemas({ p, malla, nombreDe }: { p: Prediccion | undefined; malla: Malla; nombreDe: NombreDe }) {
  const grupos = useMemo(() => (p ? recomendarContenidosCruzados(p, malla) : []), [p, malla])
  if (!p || (p.semaforo === 'verde') || grupos.length === 0) return null
  return (
    <section className="materia-bloque" aria-labelledby="mat-temas">
      <h2 id="mat-temas" className="materia-seccion">
        Temas puntuales a reforzar
      </h2>
      <p className="ayuda">Conviene repasar estos contenidos de materias previas, porque se usan directamente aquí.</p>
      <div className="temas">
        {grupos.map((g) => (
          <div key={g.previa} className="temas-grupo">
            <EnlaceMateria id={g.previa} nombreDe={nombreDe} />
            <ul>
              {g.temas.map((t) => (
                <li key={t}>{t.trim()}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Relaciones: prerrequisitos, enlaces entrantes y mini-grafo local
// ---------------------------------------------------------------------------

interface PropsRelaciones {
  malla: Malla
  materia: Materia
  previas: string[]
  dependientes: string[]
  materiaPorId: Map<string, Materia>
  estadoDe: (id: string) => EstadoMateria
}

export function BloqueRelaciones({ malla, materia, previas, dependientes, materiaPorId, estadoDe }: PropsRelaciones) {
  const nombreDe: NombreDe = (id) => materiaPorId.get(id)?.nombre ?? id
  const { nodos, aristas, ancho, alto } = useMemo(() => {
    const v = vecindario(malla, materia.id, 2)
    const l = layoutVecindario(v)
    const nodos: NodoSvg[] = [...v.niveles].map(([id, nivel]) => {
      const p = l.puntos.get(id)!
      const nombre = materiaPorId.get(id)?.nombre ?? id
      const estado = estadoDe(id)
      return {
        id,
        x: p.x,
        y: p.y,
        etiqueta: nombre.length > 18 ? `${nombre.slice(0, 17)}…` : nombre,
        tono: nivel === 0 ? 'actual' : estado.tipo === 'aprobada' ? 'hecho' : Math.abs(nivel) === 1 ? 'resaltado' : 'normal',
        descripcion: `${nombre} (${id}), ${nivel === 0 ? 'esta materia' : nivel < 0 ? `prerrequisito a distancia ${-nivel}` : `depende de esta, a distancia ${nivel}`}`,
        radio: nivel === 0 ? 11 : 8,
      }
    })
    const aristas: AristaSvg[] = v.aristas.map((e) => ({ de: e.de, a: e.a, resaltada: e.de === materia.id || e.a === materia.id }))
    return { nodos, aristas, ancho: l.ancho, alto: l.alto + 18 }
  }, [malla, materia.id, materiaPorId, estadoDe])

  const lista = (ids: string[]) => (
    <ul className="materia-lista">
      {ids.map((id) => (
        <li key={id}>
          <EnlaceMateria id={id} nombreDe={nombreDe} />
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <section className="materia-bloque" aria-labelledby="mat-previas">
        <h2 id="mat-previas" className="materia-seccion">
          Prerrequisitos
        </h2>
        {previas.length > 0 ? lista(previas) : <p className="ayuda">Esta materia no tiene prerrequisitos.</p>}
      </section>

      <section className="materia-bloque" aria-labelledby="mat-entrantes">
        <h2 id="mat-entrantes" className="materia-seccion">
          Enlaces entrantes
        </h2>
        {dependientes.length > 0 ? (
          <>
            <p className="ayuda">Materias que dependen de esta:</p>
            {lista(dependientes)}
          </>
        ) : (
          <p className="ayuda">Ninguna materia depende directamente de esta.</p>
        )}
      </section>

      {nodos.length > 1 && (
        <section className="materia-bloque" aria-labelledby="mat-mini">
          <h2 id="mat-mini" className="materia-seccion">
            Vecindad en la malla
          </h2>
          <p className="ayuda">Prerrequisitos a la izquierda y dependientes a la derecha, hasta dos pasos. Toca o haz clic en una materia para abrirla.</p>
          <div className="mini-grafo">
            <GrafoSvg nodos={nodos} aristas={aristas} ancho={ancho} alto={alto} etiqueta={`Vecindad de ${materia.nombre} en la malla`} onElegir={abrirMateria} />
          </div>
        </section>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Comparar modelos
// ---------------------------------------------------------------------------

interface PropsComparar {
  id: string
  malla: Malla
  modelo: Modelo
  notas: Map<string, number>
  tipoModelo: TipoModelo
  hayPrediccion: boolean
}

export function BloqueComparar({ id, malla, modelo, notas, tipoModelo, hayPrediccion }: PropsComparar) {
  const c = useMemo(() => compararModelos(id, malla, modelo, notas), [id, malla, modelo, notas])
  if (!hayPrediccion || !c.regresion) return null

  const columna = (tipo: TipoModelo, p: Prediccion | null) => (
    <div className={`comparar-col${tipoModelo === tipo ? ' comparar-activo' : ''}`}>
      <h3>
        {NOMBRE_MODELO[tipo]}
        {tipoModelo === tipo && <span className="comparar-uso">en uso</span>}
      </h3>
      {p ? (
        <>
          <span className="comparar-nota mono">{fmtNota(p.nota)}</span>
          <Semaforo nivel={p.semaforo} />
          <BarraRango nota={p.nota} rango={p.rango} aprobacion={malla.nota_aprobacion} semaforo={p.semaforo} compacto />
          <span className="ayuda mono">
            {fmtNota(p.rango[0])} – {fmtNota(p.rango[1])}
          </span>
        </>
      ) : (
        <p className="ayuda">No hay red entrenada para esta materia.</p>
      )}
    </div>
  )

  return (
    <section className="materia-bloque" aria-labelledby="mat-comparar">
      <h2 id="mat-comparar" className="materia-seccion">
        Comparar modelos
      </h2>
      <div className="comparar">
        {columna('regresion', c.regresion)}
        {columna('red', c.red)}
      </div>
      {c.diferencia !== null ? (
        <p className="ayuda">
          Diferencia (red − regresión): <span className="mono">{fmtDelta(c.diferencia, 2)}</span> puntos de nota.
          {c.semaforosDistintos
            ? ' Los dos modelos no coinciden en el semáforo: tómalo como una señal de que la estimación es incierta.'
            : ' Los dos modelos coinciden en el semáforo.'}
        </p>
      ) : (
        <p className="ayuda">Para esta materia solo hay predicción por regresión, así que no hay con qué compararla.</p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Historial de intentos
// ---------------------------------------------------------------------------

export function BloqueIntentos({ id, reales, aprobacion }: { id: string; reales: Nota[]; aprobacion: number }) {
  const intentos = useMemo(() => historialIntentos(reales, id, aprobacion), [reales, id, aprobacion])
  // Solo aporta cuando hubo más de un intento o el único quedó reprobado.
  if (intentos.length === 0 || (intentos.length === 1 && intentos[0].aprobado)) return null
  return (
    <section className="materia-bloque" aria-labelledby="mat-intentos">
      <h2 id="mat-intentos" className="materia-seccion">
        Historial de intentos
      </h2>
      <table className="intentos">
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            <th scope="col">Nota</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {intentos.map((i) => (
            <tr key={i.periodo} className={i.vigente ? 'intento-vigente' : undefined}>
              <td className="mono">{i.periodo}</td>
              <td className="mono">{fmtNota(i.nota)}</td>
              <td>
                {i.aprobado ? 'Aprobada' : 'Por repetir'}
                {i.vigente && <span className="intento-cuenta">cuenta este intento</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
