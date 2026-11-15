// Vista Predicciones: panel del próximo semestre con KPIs, filtro por semáforo, orden y tarjetas
// compactas. Lenguaje: «enfócate en esto», nunca «vas a perder».

import { useMemo, useState } from 'react'
import { PartyPopper, Sparkles } from 'lucide-react'
import { AvisoPocasNotas } from '../../components/AvisoPocasNotas'
import { BarraRango } from '../../components/BarraRango'
import { Semaforo } from '../../components/Semaforo'
import { SelectorModelo } from '../../components/SelectorModelo'
import { Tip } from '../../components/Tip'
import { recomendarContenidosCruzados, recomendarEnfoque } from '../../lib/model/predict'
import { fmtNota, fmtPct, plural } from '../../lib/ui/formato'
import {
  CREDITOS_CARGA_ORIENTATIVA,
  filtrarPredicciones,
  ordenarPredicciones,
  resumirPredicciones,
  type FiltroSemaforo,
  type OrdenPrediccion,
} from '../../lib/ui/predicciones'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { abrirMateria, cargarEjemplo, irA } from '../shell/acciones'
import './prediccion.css'

const FILTROS: { id: FiltroSemaforo; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todas' },
  { id: 'rojo', etiqueta: 'Dale prioridad' },
  { id: 'amarillo', etiqueta: 'Conviene reforzar' },
  { id: 'verde', etiqueta: 'Vas bien preparado' },
]

const ORDENES: { id: OrdenPrediccion; etiqueta: string }[] = [
  { id: 'riesgo', etiqueta: 'Mayor riesgo primero' },
  { id: 'nota', etiqueta: 'Nota esperada (menor primero)' },
  { id: 'semestre', etiqueta: 'Semestre' },
]

export function VistaPredicciones() {
  const datos = useDatos()
  const { malla, modelo, recomendado, materiaPorId } = datos
  const escenario = useEscenario()
  const elegirModelo = useApp((s) => s.elegirModelo)
  const seleccionar = useApp((s) => s.seleccionar)
  const [filtro, setFiltro] = useState<FiltroSemaforo>('todos')
  const [orden, setOrden] = useState<OrdenPrediccion>('riesgo')

  const { predicciones } = escenario
  const nombreDe = (id: string) => materiaPorId.get(id)?.nombre ?? id
  const resumen = useMemo(() => resumirPredicciones(predicciones, malla), [predicciones, malla])
  const enfoque = useMemo(() => recomendarEnfoque(predicciones, malla), [predicciones, malla])
  const visibles = useMemo(
    () => ordenarPredicciones(filtrarPredicciones(predicciones, filtro), orden, (id) => materiaPorId.get(id)?.semestre ?? 99),
    [predicciones, filtro, orden, materiaPorId],
  )

  const todasAprobadas = useMemo(
    () => malla.materias.every((m) => (escenario.mapaNotas.get(m.id) ?? -1) >= malla.nota_aprobacion),
    [malla, escenario.mapaNotas],
  )

  const encabezado = (
    <header className="pred-cabecera">
      <div>
        <h2 className="pred-titulo">Próximo semestre</h2>
        <p className="ayuda">Así te podría ir en las materias que ya puedes inscribir.</p>
      </div>
      <SelectorModelo modelo={modelo} tipo={escenario.tipoModelo} recomendado={recomendado} onCambiar={elegirModelo} />
    </header>
  )

  if (escenario.mapaNotas.size === 0) {
    return (
      <div className="pred">
        {encabezado}
        <div className="pred-vacio">
          <Sparkles size={28} strokeWidth={1.25} aria-hidden="true" />
          <h3>Aún no hay predicciones</h3>
          <p className="ayuda">Carga tus notas y Gradly te dirá cómo te puede ir en las materias que vienen, con su rango y el porqué.</p>
          <div className="fila">
            <button type="button" className="btn btn-primario" onClick={() => irA({ tipo: 'vista', vista: 'notas' })}>
              Cargar mis notas
            </button>
            <button type="button" className="btn" onClick={() => cargarEjemplo(datos)}>
              Ver con notas de ejemplo
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (todasAprobadas) {
    return (
      <div className="pred">
        {encabezado}
        <div className="pred-vacio pred-celebra">
          <PartyPopper size={28} strokeWidth={1.25} aria-hidden="true" />
          <h3>Completaste la malla</h3>
          <p className="ayuda">Aprobaste las {malla.materias.length} materias. No quedan predicciones por hacer: ¡felicitaciones!</p>
        </div>
      </div>
    )
  }

  if (predicciones.length === 0) {
    return (
      <div className="pred">
        {encabezado}
        <AvisoPocasNotas cantidad={escenario.mapaReales.size} />
        <div className="pred-vacio">
          <Sparkles size={28} strokeWidth={1.25} aria-hidden="true" />
          <h3>No hay materias disponibles por ahora</h3>
          <p className="ayuda">Cuando apruebes los prerrequisitos de más materias, aparecerán aquí con su predicción.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pred">
      {encabezado}
      <AvisoPocasNotas cantidad={escenario.mapaReales.size} />

      <section className="pred-kpis" aria-label="Resumen del próximo semestre">
        <div className="kpi kpi-verde">
          <span className="kpi-valor mono">{resumen.verde}</span>
          <span className="kpi-etiqueta">Vas bien preparado</span>
        </div>
        <div className="kpi kpi-amarillo">
          <span className="kpi-valor mono">{resumen.amarillo}</span>
          <span className="kpi-etiqueta">Conviene reforzar</span>
        </div>
        <div className="kpi kpi-rojo">
          <span className="kpi-valor mono">{resumen.rojo}</span>
          <span className="kpi-etiqueta">Dale prioridad</span>
        </div>
        <div className="kpi">
          <span className="kpi-valor mono">{fmtNota(resumen.notaPromedio)}</span>
          <span className="kpi-etiqueta">Nota promedio esperada</span>
        </div>
        <div className="kpi">
          <span className="kpi-valor mono">{resumen.carga.creditos}</span>
          <span className="kpi-etiqueta">
            Créditos de carga sugerida
            <Tip
              texto={`Orientativo: hasta ${CREDITOS_CARGA_ORIENTATIVA} créditos, empezando por las materias más atrasadas. No es una regla de la universidad.`}
              side="top"
            >
              <button type="button" className="kpi-info" aria-label="Cómo se calcula la carga sugerida">
                ?
              </button>
            </Tip>
          </span>
          <span className="kpi-detalle">{plural(resumen.carga.materias.length, 'materia', 'materias')}</span>
        </div>
      </section>

      {enfoque.length > 0 && (
        <section className="pred-enfoque" aria-labelledby="pred-enfoque-t">
          <h3 id="pred-enfoque-t">Enfócate en repasar</h3>
          <ul>
            {enfoque.map((e) => (
              <li key={e.materia}>
                <button type="button" className="materia-enlace" onClick={() => abrirMateria(e.materia)}>
                  {nombreDe(e.materia)}
                </button>
              </li>
            ))}
          </ul>
          <p className="ayuda">Son las materias previas que más pesan en tus predicciones más delicadas.</p>
        </section>
      )}

      <div className="pred-controles">
        <div className="pred-filtros" role="group" aria-label="Filtrar por semáforo">
          {FILTROS.map((f) => {
            const cantidad = f.id === 'todos' ? resumen.total : resumen[f.id]
            return (
              <button
                key={f.id}
                type="button"
                className={`exp-chip${filtro === f.id ? ' exp-chip-activo' : ''}`}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.etiqueta} <span className="mono">{cantidad}</span>
              </button>
            )
          })}
        </div>
        <label className="pred-orden">
          Ordenar por
          <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenPrediccion)}>
            {ORDENES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="ayuda pred-sin-resultados">No hay materias con ese semáforo.</p>
      ) : (
        <ul className="pred-lista">
          {visibles.map((p) => {
            const temas = recomendarContenidosCruzados(p, malla)
            const materia = materiaPorId.get(p.materia)
            return (
              <li key={p.materia} className={`pred-tarjeta pred-${p.semaforo}`} onClick={() => seleccionar(p.materia)}>
                <div className="pred-fila-1">
                  <div className="pred-nombre">
                    <button type="button" className="pred-abrir" onClick={() => abrirMateria(p.materia)}>
                      {nombreDe(p.materia)}
                    </button>
                    <span className="mono materia-codigo">
                      {p.materia}
                      {materia ? ` · Sem. ${materia.semestre} · ${materia.creditos} cr.` : ''}
                    </span>
                  </div>
                  <Semaforo nivel={p.semaforo} />
                </div>
                <div className="pred-fila-2">
                  <div className="pred-nota">
                    <span className="mono pred-nota-valor">{fmtNota(p.nota)}</span>
                    <span className="pred-nota-pie">esperada</span>
                  </div>
                  <div className="pred-barra">
                    <BarraRango nota={p.nota} rango={p.rango} aprobacion={malla.nota_aprobacion} semaforo={p.semaforo} compacto />
                    <span className="ayuda mono">
                      {fmtNota(p.rango[0])} – {fmtNota(p.rango[1])} · {fmtPct(p.probNoAprobar)} de no aprobar
                    </span>
                  </div>
                </div>
                {p.porQue.length > 0 ? (
                  <p className="ayuda pred-porque">
                    Por qué:{' '}
                    {p.porQue
                      .map((c) => `${nombreDe(c.materia)} ${c.aporte >= 0 ? '+' : '−'}${Math.abs(c.aporte).toFixed(2)}`)
                      .join(', ')}
                  </p>
                ) : (
                  !p.usaModelo && <p className="ayuda pred-porque">Basado en la media de la materia y tu nivel.</p>
                )}
                {temas.length > 0 && (
                  <p className="pred-temas">
                    <strong>Temas a reforzar:</strong> {temas.map((t) => `${nombreDe(t.previa)}: ${t.temas.map((x) => x.trim()).join(' · ')}`).join(' — ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
