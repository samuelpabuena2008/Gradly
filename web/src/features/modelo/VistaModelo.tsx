// Vista Modelo («Cómo piensa Gradly»): la fórmula, cada término con un ejemplo sobre las notas del
// usuario y las métricas REALES de pesos.json. Los gráficos son SVG/CSS hechos a mano.

import { useId, useMemo, useState, type CSSProperties } from 'react'
import { FlaskConical, Info } from 'lucide-react'
import { Tip } from '../../components/Tip'
import { descomponerRegresion } from '../../lib/ui/descomposicion'
import { fmtDelta, fmtNota, fmtPct } from '../../lib/ui/formato'
import { leerMetricas, type Calibracion, type Intervalo } from '../../lib/ui/metricas'
import { NOMBRE_MODELO, tieneRed } from '../../lib/ui/modelos'
import type { TipoModelo } from '../../lib/model/predict'
import { useDatos, useEscenario } from '../../store/escenario'
import { irA } from '../shell/acciones'
import './modelo.css'

// Fórmula en MathML (texto estático y de confianza: no contiene datos del usuario).
const FORMULA_MATHML = `
<math display="block" aria-label="y gorro igual a mu más b más beta por a más la suma sobre p de w sub p por z sub p">
  <mrow>
    <mover><mi>y</mi><mo>^</mo></mover><mo>=</mo>
    <mi>μ</mi><mo>+</mo><mi>b</mi><mo>+</mo><mi>β</mi><mo>·</mo><mi>a</mi><mo>+</mo>
    <munder><mo>∑</mo><mi>p</mi></munder>
    <msub><mi>w</mi><mi>p</mi></msub><mo>·</mo><msub><mi>z</mi><mi>p</mi></msub>
  </mrow>
</math>`

const COLORES = ['verde', 'amarillo', 'rojo'] as const
const RANGO_SEMAFORO = { verde: [0, 0.2], amarillo: [0.2, 0.5], rojo: [0.5, 1] } as const
const TEXTO_SEMAFORO = { verde: 'Vas bien preparado', amarillo: 'Conviene reforzar', rojo: 'Dale prioridad' } as const

function InfoSimulado({ texto }: { texto: string }) {
  return (
    <Tip texto={texto} side="top">
      <button type="button" className="modelo-info" aria-label="Aviso sobre estas métricas">
        <Info size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Tip>
  )
}

/** Diferencias de MAE con su intervalo de confianza al 95 %: puntos y bigotes sobre una línea en 0. */
function GraficoIntervalos({ filas }: { filas: { etiqueta: string; dato: Intervalo }[] }) {
  const ancho = 560
  const margen = { izq: 190, der: 24 }
  const alto = 34 + filas.length * 44
  const valores = filas.flatMap((f) => [f.dato.ic95[0], f.dato.ic95[1], f.dato.diferencia, 0])
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const holgura = (max - min) * 0.15 || 0.01
  const dominio: [number, number] = [min - holgura, max + holgura]
  const x = (v: number) => margen.izq + ((v - dominio[0]) / (dominio[1] - dominio[0])) * (ancho - margen.izq - margen.der)
  const marcas = [dominio[0], 0, dominio[1]].map((v) => Number(v.toFixed(2)))

  return (
    <svg className="modelo-intervalos" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Diferencias de error medio con su intervalo de confianza del 95 %">
      <line x1={x(0)} x2={x(0)} y1={6} y2={alto - 22} className="modelo-eje-cero" />
      {filas.map((f, i) => {
        const y = 24 + i * 44
        const mejora = f.dato.ic95[1] < 0
        return (
          <g key={f.etiqueta}>
            <text x={margen.izq - 12} y={y + 4} textAnchor="end" className="modelo-svg-texto">
              {f.etiqueta}
            </text>
            <line x1={x(f.dato.ic95[0])} x2={x(f.dato.ic95[1])} y1={y} y2={y} className="modelo-bigote" />
            <line x1={x(f.dato.ic95[0])} x2={x(f.dato.ic95[0])} y1={y - 5} y2={y + 5} className="modelo-bigote" />
            <line x1={x(f.dato.ic95[1])} x2={x(f.dato.ic95[1])} y1={y - 5} y2={y + 5} className="modelo-bigote" />
            <circle cx={x(f.dato.diferencia)} cy={y} r={5.5} className={mejora ? 'modelo-punto-mejora' : 'modelo-punto-peor'} />
          </g>
        )
      })}
      {marcas.map((v) => (
        <text key={v} x={x(v)} y={alto - 6} textAnchor="middle" className="modelo-svg-texto modelo-svg-tenue">
          {v > 0 ? `+${v}` : v}
        </text>
      ))}
    </svg>
  )
}

function CalibracionSemaforo({ cal }: { cal: Calibracion }) {
  return (
    <ul className="modelo-calibracion" aria-label="Porcentaje que de verdad reprobó en cada color del semáforo">
      {COLORES.map((c) => {
        const fila = cal.semaforo[c]
        if (!fila) return null
        const [ini, fin] = RANGO_SEMAFORO[c]
        return (
          <li key={c} className="modelo-cal-fila">
            <span className={`modelo-cal-nombre modelo-cal-${c}`}>{TEXTO_SEMAFORO[c]}</span>
            <span className="modelo-cal-pista">
              <span className="modelo-cal-esperado" style={{ left: `${ini * 100}%`, width: `${(fin - ini) * 100}%` }} title="Rango de probabilidad que define este color" />
              <span className={`modelo-cal-barra modelo-cal-barra-${c}`} style={{ width: `${Math.min(100, Math.max(0, fila.reprobaron * 100))}%` }} />
            </span>
            <span className="mono modelo-cal-valor">{fmtPct(fila.reprobaron)}</span>
            <span className="modelo-cal-n">de {fila.n.toLocaleString('es-CO')} notas</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function VistaModelo() {
  const { modelo, malla, materiaPorId, recomendado } = useDatos()
  const escenario = useEscenario()
  const metricas = useMemo(() => leerMetricas(modelo), [modelo])
  const [calibModelo, setCalibModelo] = useState<TipoModelo>(recomendado)
  const [materiaEjemplo, setMateriaEjemplo] = useState<string | null>(null)
  const idEjemplo = useId()
  const redDisponible = tieneRed(modelo)

  // Materias de ejemplo: las del próximo semestre que tienen pesos propios.
  const candidatas = useMemo(() => escenario.predicciones.filter((p) => p.usaModelo && modelo.cursos[p.materia]), [escenario.predicciones, modelo])
  const elegida = materiaEjemplo && candidatas.some((p) => p.materia === materiaEjemplo) ? materiaEjemplo : (candidatas[0]?.materia ?? null)
  const desglose = useMemo(
    () => (elegida ? descomponerRegresion(elegida, modelo, escenario.mapaNotas) : null),
    [elegida, modelo, escenario.mapaNotas],
  )

  const nombreDe = (id: string) => materiaPorId.get(id)?.nombre ?? id
  const simulado = metricas?.fuente ? metricas.fuente.toLowerCase().includes('simul') : true
  const avisoCorto = `Medido con ${metricas?.nEstudiantes ?? 'varios'} estudiantes simulados, no con notas reales.`

  const pasos = desglose
    ? [
        { id: 'mu', simbolo: 'μ', nombre: 'Media de la materia', valor: desglose.media, absoluto: true },
        { id: 'b', simbolo: 'b', nombre: 'Ajuste propio de la materia', valor: desglose.ajuste, absoluto: false },
        { id: 'ba', simbolo: 'β·a', nombre: 'Tu nivel pesa en esta materia', valor: desglose.aporteNivel, absoluto: false },
        { id: 'wz', simbolo: 'Σ w·z', nombre: 'Cómo te fue en las materias previas', valor: desglose.aportePrevias, absoluto: false },
      ]
    : []
  let acumulado = 0
  const filasDesglose = pasos.map((p) => {
    acumulado = p.absoluto ? p.valor : acumulado + p.valor
    return { ...p, acumulado }
  })

  const cal = calibModelo === 'red' ? metricas?.validacion.calibracionRed : metricas?.validacion.calibracionRegresion
  const intervalos = [
    metricas?.validacion.regresionVsBaseline && { etiqueta: 'Regresión − baseline', dato: metricas.validacion.regresionVsBaseline },
    metricas?.validacion.redVsRegresion && { etiqueta: 'Red − regresión', dato: metricas.validacion.redVsRegresion },
  ].filter((f): f is { etiqueta: string; dato: Intervalo } => Boolean(f))
  const maxMae = Math.max(0.01, ...[metricas?.baseline.mae, metricas?.regresion.mae, metricas?.red.mae].filter((v): v is number => v !== undefined))

  return (
    <div className="modelo">
      <header>
        <h1 className="modelo-titulo">Cómo piensa Gradly</h1>
        <p className="ayuda">La fórmula con la que estima tu nota, y qué tan bien acierta.</p>
      </header>

      <aside className="modelo-aviso" role="note">
        <FlaskConical size={20} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <strong>El modelo se entrenó con estudiantes simulados.</strong>
          <p>
            {simulado
              ? `Los datos de entrenamiento no son notas reales de estudiantes de Uninorte${metricas?.nEstudiantes ? `: son ${metricas.nEstudiantes} estudiantes generados` : ''}. `
              : ''}
            Por eso las métricas de abajo muestran que el método funciona, no cuánto acertaría hoy con personas reales. Además, los pesos
            son <em>asociaciones</em> entre materias, no causas: que una materia pese mucho en otra no significa que una provoque la otra.
          </p>
        </div>
      </aside>

      <section className="modelo-seccion" aria-labelledby="modelo-formula">
        <h2 id="modelo-formula">La fórmula</h2>
        <div className="modelo-formula" dangerouslySetInnerHTML={{ __html: FORMULA_MATHML }} />
        <dl className="modelo-terminos">
          <div>
            <dt>
              <span className="mono">ŷ</span> Tu nota esperada
            </dt>
            <dd>Lo que Gradly cree que sacarás, entre 0 y 5.</dd>
          </div>
          <div>
            <dt>
              <span className="mono">μ</span> Media de la materia
            </dt>
            <dd>La nota promedio histórica de la materia: el punto de partida.</dd>
          </div>
          <div>
            <dt>
              <span className="mono">b</span> Ajuste de la materia
            </dt>
            <dd>Corrige la media cuando la materia suele quedar por encima o por debajo de lo que sugiere el resto.</dd>
          </div>
          <div>
            <dt>
              <span className="mono">β·a</span> Tu nivel
            </dt>
            <dd>
              <span className="mono">a</span> mide si en general te va mejor o peor que el promedio (con pocas notas se encoge hacia 0);{' '}
              <span className="mono">β</span> dice cuánto importa tu nivel en esta materia.
            </dd>
          </div>
          <div>
            <dt>
              <span className="mono">Σ w·z</span> Tus materias previas
            </dt>
            <dd>
              Para cada materia previa <span className="mono">p</span>: <span className="mono">z</span> es cuánto te fue mejor o peor de lo que tu nivel
              predecía, y <span className="mono">w</span> cuánto pesa esa materia en esta.
            </dd>
          </div>
        </dl>
      </section>

      <section className="modelo-seccion" aria-labelledby="modelo-ejemplo">
        <h2 id="modelo-ejemplo">Un ejemplo con tus notas</h2>
        {desglose && elegida ? (
          <>
            <div className="modelo-ejemplo-cabecera">
              <label htmlFor={idEjemplo}>Materia</label>
              <select id={idEjemplo} value={elegida} onChange={(e) => setMateriaEjemplo(e.target.value)}>
                {candidatas.map((p) => (
                  <option key={p.materia} value={p.materia}>
                    {nombreDe(p.materia)}
                  </option>
                ))}
              </select>
            </div>
            <ol className="modelo-cascada" key={elegida}>
              {filasDesglose.map((f, i) => (
                <li key={f.id} style={{ '--i': i } as CSSProperties}>
                  <span className="modelo-cascada-nombre">
                    <span className="mono">{f.simbolo}</span> {f.nombre}
                  </span>
                  <span className="modelo-cascada-pista" aria-hidden="true">
                    <span className="modelo-cascada-barra" style={{ width: `${Math.min(100, Math.max(0, (f.acumulado / 5) * 100))}%` }} />
                  </span>
                  <span className="mono modelo-cascada-valor">{f.absoluto ? fmtNota(f.valor, 2) : fmtDelta(f.valor, 2)}</span>
                  <span className="mono modelo-cascada-total">{fmtNota(f.acumulado, 2)}</span>
                </li>
              ))}
              <li className="modelo-cascada-final" style={{ '--i': filasDesglose.length } as CSSProperties}>
                <span className="modelo-cascada-nombre">
                  <span className="mono">ŷ</span> Nota esperada (limitada a 0–5)
                </span>
                <span className="modelo-cascada-pista" aria-hidden="true">
                  <span className="modelo-cascada-barra modelo-cascada-barra-final" style={{ width: `${Math.min(100, Math.max(0, (desglose.bruta / 5) * 100))}%` }} />
                </span>
                <span />
                <span className="mono modelo-cascada-total">{fmtNota(Math.min(5, Math.max(0, desglose.bruta)), 2)}</span>
              </li>
            </ol>
            {desglose.previas.length > 0 && (
              <p className="ayuda">
                Entre tus materias previas, las que más pesan aquí:{' '}
                {desglose.previas
                  .slice(0, 3)
                  .map((p) => `${nombreDe(p.materia)} (${fmtDelta(p.aporte, 2)})`)
                  .join(', ')}
                .
              </p>
            )}
            {escenario.tipoModelo === 'red' && (
              <p className="ayuda">Este desglose es el de la regresión; la red neuronal hace una cuenta distinta pero parecida.</p>
            )}
          </>
        ) : (
          <div className="modelo-sin-ejemplo">
            <p className="ayuda">
              Con tus notas, aquí verías esta fórmula armada paso a paso para una materia que puedes inscribir. Todavía no hay una materia con pesos
              propios que mostrar.
            </p>
            <button type="button" className="btn" onClick={() => irA({ tipo: 'vista', vista: 'notas' })}>
              Cargar mis notas
            </button>
          </div>
        )}
      </section>

      {metricas ? (
        <section className="modelo-seccion" aria-labelledby="modelo-metricas">
          <h2 id="modelo-metricas">
            Qué tan bien acierta <InfoSimulado texto={avisoCorto} />
          </h2>
          <p className="ayuda">
            Validación: {metricas.validacion.tipo ?? 'cruzada por estudiante'}
            {metricas.validacion.notasEvaluadas ? `, ${metricas.validacion.notasEvaluadas.toLocaleString('es-CO')} notas evaluadas` : ''}. {avisoCorto}
          </p>

          <h3>Error medio (MAE): cuántos puntos de nota se equivoca</h3>
          <ul className="modelo-mae">
            {(
              [
                ['Baseline: siempre la media de la materia', metricas.baseline.mae, 'base'],
                [NOMBRE_MODELO.regresion, metricas.regresion.mae, 'regresion'],
                [NOMBRE_MODELO.red, metricas.red.mae, 'red'],
              ] as const
            ).map(([nombre, valor, clave]) =>
              valor === undefined ? null : (
                <li key={clave}>
                  <span>{nombre}</span>
                  <span className="modelo-mae-pista" aria-hidden="true">
                    <span className={`modelo-mae-barra modelo-mae-${clave}`} style={{ width: `${(valor / maxMae) * 100}%` }} />
                  </span>
                  <span className="mono">{fmtNota(valor, 3)}</span>
                </li>
              ),
            )}
          </ul>
          <p className="ayuda">Menos es mejor.</p>

          {intervalos.length > 0 && (
            <>
              <h3>Diferencia de error, con intervalo de confianza al 95 %</h3>
              <GraficoIntervalos filas={intervalos} />
              <ul className="modelo-lecturas">
                {metricas.validacion.regresionVsBaseline && (
                  <li>
                    La regresión se equivoca <strong className="mono">{fmtNota(Math.abs(metricas.validacion.regresionVsBaseline.diferencia), 3)}</strong> puntos{' '}
                    {metricas.validacion.regresionVsBaseline.diferencia < 0 ? 'menos' : 'más'} que el baseline (IC 95 %:{' '}
                    <span className="mono">
                      {fmtDelta(metricas.validacion.regresionVsBaseline.ic95[0], 3)} a {fmtDelta(metricas.validacion.regresionVsBaseline.ic95[1], 3)}
                    </span>
                    ).
                  </li>
                )}
                {metricas.validacion.redVsRegresion && (
                  <li>
                    {metricas.validacion.redVsRegresion.ic95[0] > 0
                      ? 'La red no mejora a la regresión: se equivoca '
                      : metricas.validacion.redVsRegresion.ic95[1] < 0
                        ? 'La red mejora a la regresión: se equivoca '
                        : 'Entre la red y la regresión no hay una diferencia clara: '}
                    <strong className="mono">{fmtNota(Math.abs(metricas.validacion.redVsRegresion.diferencia), 3)}</strong> puntos{' '}
                    {metricas.validacion.redVsRegresion.diferencia > 0 ? 'más' : 'menos'} (IC 95 %:{' '}
                    <span className="mono">
                      {fmtDelta(metricas.validacion.redVsRegresion.ic95[0], 3)} a {fmtDelta(metricas.validacion.redVsRegresion.ic95[1], 3)}
                    </span>
                    ). {metricas.validacion.recomendado && `El modelo recomendado es ${metricas.validacion.recomendado === 'red' ? 'la red' : 'la regresión'}.`}
                  </li>
                )}
              </ul>
            </>
          )}

          {(metricas.validacion.calibracionRegresion || metricas.validacion.calibracionRed) && (
            <>
              <h3>Calibración del semáforo: ¿qué porcentaje reprobó en cada color?</h3>
              {redDisponible && metricas.validacion.calibracionRed && metricas.validacion.calibracionRegresion && (
                <div className="segmentado modelo-segmentado" role="group" aria-label="Modelo a mostrar en la calibración">
                  {(['regresion', 'red'] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={calibModelo === t} className={`segmento${calibModelo === t ? ' segmento-activo' : ''}`} onClick={() => setCalibModelo(t)}>
                      {NOMBRE_MODELO[t]}
                    </button>
                  ))}
                </div>
              )}
              {cal && <CalibracionSemaforo cal={cal} />}
              <p className="ayuda">
                La franja tenue marca el riesgo que define cada color (verde &lt; 20 %, amarillo 20–50 %, rojo ≥ 50 %). Si el semáforo está bien calibrado, la barra
                cae dentro de su franja.
              </p>
            </>
          )}

          <h3>Regresión frente a red neuronal</h3>
          <div className="modelo-tabla-caja">
            <table className="modelo-tabla">
              <thead>
                <tr>
                  <th scope="col">Métrica</th>
                  <th scope="col">{NOMBRE_MODELO.regresion}</th>
                  <th scope="col">{NOMBRE_MODELO.red}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Error medio (MAE)', metricas.regresion.mae, metricas.red.mae, 3],
                    ['Precisión al marcar «nota < 3.0»', metricas.regresion.precisionRiesgo, metricas.red.precisionRiesgo, 3],
                    ['Recall: reprobadas que detectó', metricas.regresion.recallRiesgo, metricas.red.recallRiesgo, 3],
                    ['Cobertura del rango ŷ ± σ', metricas.validacion.calibracionRegresion?.coberturaRango, metricas.validacion.calibracionRed?.coberturaRango, 3],
                    ['AUC del riesgo', metricas.validacion.calibracionRegresion?.auc, metricas.validacion.calibracionRed?.auc, 3],
                  ] as const
                ).map(([nombre, a, b, d]) => (
                  <tr key={nombre}>
                    <th scope="row">{nombre}</th>
                    <td className="mono">{fmtNota(a, d)}</td>
                    <td className="mono">{fmtNota(b, d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ayuda">
            Cobertura: el rango ŷ ± σ debería contener la nota real cerca del 68 % de las veces. AUC: 1 es perfecto y 0.5 es lanzar una moneda. Precisión: de las notas que el modelo
            predijo bajo 3.0, cuántas de verdad quedaron ahí. Recall: de las que de verdad quedaron bajo 3.0, cuántas había anticipado.
          </p>
        </section>
      ) : (
        <section className="modelo-seccion" aria-labelledby="modelo-metricas">
          <h2 id="modelo-metricas">Qué tan bien acierta</h2>
          <p className="ayuda">Este archivo de pesos no trae métricas de validación, así que no hay números que mostrar.</p>
        </section>
      )}

      <p className="ayuda modelo-pie">
        Malla {malla.version}
        {metricas?.versionMalla && metricas.versionMalla !== malla.version ? ` (los pesos son de la malla ${metricas.versionMalla})` : ''}. Las notas que cargas se procesan en tu
        navegador y no salen de tu computador.
      </p>
    </div>
  )
}
