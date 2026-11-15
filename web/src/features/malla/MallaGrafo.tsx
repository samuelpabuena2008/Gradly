// Vista de grafo de la malla (estilo «Graph view» de Obsidian): nodos circulares, hover que resalta
// vecinos, columnas por semestre o disposición orgánica, panel de ajustes, minimapa, exportación PNG
// y navegación completa por teclado. Todo el estado derivado vive en useMemo con dependencias exactas.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type EdgeMarker,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useShallow } from 'zustand/react/shallow'
import { descendientes } from '../../lib/graph/dag'
import { estadoMateria, type EstadoMateria } from '../../lib/ui/estado'
import { filtrarDifuso } from '../../lib/ui/fuzzy'
import {
  aristasDeCamino,
  claveArista,
  construirVecindad,
  cuellosDeBotella,
  describirNodo,
  navegar,
  radioNodo,
  vecinos,
  type Tecla,
} from '../../lib/ui/grafo'
import { COLUMNA, interpolar, layoutSemestres, type Punto } from '../../lib/ui/layoutMalla'
import { duracion, prefiereMenosMovimiento } from '../../lib/ui/movimiento'
import { useApp } from '../../store/app'
import { useDatos, useEscenario } from '../../store/escenario'
import { useGrafo, type PrefsGrafo } from '../../store/grafo'
import { avisar } from '../../store/toasts'
import { abrirMateria, elegirMateria } from '../shell/acciones'
import { AristaMateria, type AristaMateriaTipo } from './AristaMateria'
import { BarraCamara, Leyenda } from './ControlesGrafo'
import { EncabezadosSemestre } from './EncabezadosSemestre'
import { exportarGrafoPng } from './exportarPng'
import { ANCHO_NODO, altoNodo, centroDesdeEsquina, esquinaDesdeCentro } from './geometria'
import { NodoMateria, type DatosNodo, type NodoMateriaTipo } from './NodoMateria'
import { PanelGrafo } from './PanelGrafo'
import { VariableZoom } from './VariableZoom'
import './malla.css'

// Estables fuera del render (React Flow avisa si cambian en cada render).
const nodeTypes = { materia: NodoMateria }
const edgeTypes = { materia: AristaMateria }
const marcador = (color: string): EdgeMarker => ({ type: MarkerType.ArrowClosed, color, width: 14, height: 14 })
const MARCADOR = {
  normal: marcador('var(--line-strong)'),
  blanda: marcador('var(--line)'),
  acento: marcador('var(--accent-soft)'),
}
const PADDING_AJUSTE = 0.12
const ESCALA_ORGANICO = 0.85

function colorMinimapa(n: NodoMateriaTipo): string {
  const e = n.data.estado
  if (e.tipo === 'aprobada') return 'var(--accent)'
  if (e.tipo === 'reprobada') return 'var(--risk)'
  if (e.tipo === 'disponible' && e.prediccion) {
    return { verde: 'var(--ok)', amarillo: 'var(--warn)', rojo: 'var(--risk)' }[e.prediccion.semaforo]
  }
  return 'var(--line-strong)'
}

function visibleSegun(prefs: Pick<PrefsGrafo, 'soloDisponibles' | 'ocultarBloqueadas'>, e: EstadoMateria | undefined): boolean {
  if (!e) return false
  if (prefs.soloDisponibles && e.tipo !== 'disponible') return false
  if (prefs.ocultarBloqueadas && e.tipo === 'bloqueada') return false
  return true
}

export function MallaGrafo() {
  return (
    <ReactFlowProvider>
      <Lienzo />
    </ReactFlowProvider>
  )
}

function Lienzo() {
  const { malla, orden, camino, intermediacion: inter, materiaPorId } = useDatos()
  const escenario = useEscenario()
  const seleccionada = useApp((s) => s.seleccionada)
  const seleccionar = useApp((s) => s.seleccionar)
  const hayNotas = useApp((s) => s.notasReales.length > 0)
  const prefs = useGrafo(
    useShallow((s) => ({
      blandas: s.blandas,
      soloDisponibles: s.soloDisponibles,
      ocultarBloqueadas: s.ocultarBloqueadas,
      cadena: s.cadena,
      flujo: s.flujo,
      cuellos: s.cuellos,
      descendientes: s.descendientes,
      tamano: s.tamano,
      grosor: s.grosor,
      umbralTexto: s.umbralTexto,
      colorearPor: s.colorearPor,
      disposicion: s.disposicion,
      minimapa: s.minimapa,
      busqueda: s.busqueda,
      solicitud: s.solicitud,
    })),
  )
  const flujo = useReactFlow<NodoMateriaTipo, AristaMateriaTipo>()
  const contenedor = useRef<HTMLDivElement>(null)
  const idAyuda = useId()
  const organico = prefs.disposicion === 'organico'

  // ---- Datos estáticos de la malla ----
  const layout = useMemo(() => layoutSemestres(malla, orden), [malla, orden])
  const semestreDe = useMemo(() => new Map(malla.materias.map((m) => [m.id, m.semestre])), [malla])
  const vecindad = useMemo(() => construirVecindad(malla, prefs.blandas), [malla, prefs.blandas])
  const cuellos = useMemo(() => new Set(cuellosDeBotella(inter)), [inter])
  const enCadena = useMemo(() => new Set(camino), [camino])
  const aristasCadena = useMemo(() => aristasDeCamino(camino), [camino])
  const maxInter = useMemo(() => Math.max(0, ...Object.values(inter).filter(Number.isFinite)), [inter])
  const radios = useMemo(
    () => new Map(malla.materias.map((m) => [m.id, radioNodo(m, prefs.tamano, inter, maxInter)])),
    [malla, prefs.tamano, inter, maxInter],
  )

  // ---- Estado de cada materia según las notas vigentes ----
  const estados = useMemo(
    () => new Map(malla.materias.map((m) => [m.id, estadoMateria(m.id, malla, escenario.mapaNotas, escenario.prediccionPorId)])),
    [malla, escenario.mapaNotas, escenario.prediccionPorId],
  )
  const { soloDisponibles, ocultarBloqueadas } = prefs
  const visible = useCallback(
    (id: string) => visibleSegun({ soloDisponibles, ocultarBloqueadas }, estados.get(id)),
    [soloDisponibles, ocultarBloqueadas, estados],
  )
  const visibles = useMemo(() => malla.materias.filter((m) => visible(m.id)).map((m) => m.id), [malla, visible])
  const firmaVisibles = visibles.join(',')

  // ---- Posiciones (centros de círculo). Se animan entre disposiciones. ----
  const [centros, setCentros] = useState<Map<string, Punto>>(layout.centros)
  const centrosRef = useRef(centros)
  useEffect(() => {
    centrosRef.current = centros
  }, [centros])
  const animacion = useRef(0)
  const [iniciado, setIniciado] = useState(false)

  const ajustar = useCallback(() => {
    void flujo.fitView({ padding: PADDING_AJUSTE, duration: duracion(400) })
  }, [flujo])

  const animarHacia = useCallback(
    (destino: Map<string, Punto>, alTerminar?: () => void) => {
      cancelAnimationFrame(animacion.current)
      const desde = centrosRef.current
      const ms = duracion(520)
      if (ms === 0) {
        setCentros(destino)
        requestAnimationFrame(() => alTerminar?.())
        return
      }
      const t0 = performance.now()
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / ms)
        const suave = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
        setCentros(k >= 1 ? destino : interpolar(desde, destino, suave))
        if (k < 1) animacion.current = requestAnimationFrame(paso)
        else alTerminar?.()
      }
      animacion.current = requestAnimationFrame(paso)
    },
    [],
  )
  useEffect(() => () => cancelAnimationFrame(animacion.current), [])

  const calcularOrganico = useCallback(async () => {
    const { simularFuerzas } = await import('../../lib/ui/fuerzas')
    return simularFuerzas(
      malla.materias.map((m) => m.id),
      [...malla.prerrequisitos, ...malla.aristas_blandas],
      layout.centros,
      {
        radio: (id) => (radios.get(id) ?? 17) + 40,
        anclaX: (id) => ((semestreDe.get(id) ?? 1) - 1) * COLUMNA * ESCALA_ORGANICO,
        fuerzaAncla: 0.08,
        fuerzaCentro: 0.06,
      },
    )
  }, [malla, layout, radios, semestreDe])

  const aplicarDisposicion = useCallback(
    (disposicion: PrefsGrafo['disposicion']) => {
      let vigente = true
      if (disposicion === 'semestre') animarHacia(layout.centros, ajustar)
      else
        void calcularOrganico().then((destino) => {
          if (vigente) animarHacia(destino, ajustar)
        })
      return () => {
        vigente = false
      }
    },
    [animarHacia, layout, calcularOrganico, ajustar],
  )

  // Cambiar de disposición anima la transición. Al montar en «semestre» no hay nada que animar; si
  // quedó guardada la orgánica, se calcula al montar. Solo reacciona al cambio de disposición.
  const disposicionAplicada = useRef<PrefsGrafo['disposicion']>('semestre')
  const aplicarRef = useRef(aplicarDisposicion)
  useEffect(() => {
    aplicarRef.current = aplicarDisposicion
  }, [aplicarDisposicion])
  useEffect(() => {
    if (disposicionAplicada.current === prefs.disposicion) return
    disposicionAplicada.current = prefs.disposicion
    return aplicarRef.current(prefs.disposicion)
  }, [prefs.disposicion])

  const restablecer = useCallback(() => {
    aplicarDisposicion(prefs.disposicion)
  }, [aplicarDisposicion, prefs.disposicion])

  // ---- Hover, búsqueda y descendientes → foco (lo demás se atenúa) ----
  const [hover, setHover] = useState<string | null>(null)
  const coincidencias = useMemo(() => {
    if (!prefs.busqueda.trim()) return null
    return filtrarDifuso(malla.materias.filter((m) => visible(m.id)), prefs.busqueda, (m) => `${m.nombre} ${m.id}`).map((m) => m.id)
  }, [malla, prefs.busqueda, visible])
  const descendientesSel = useMemo(
    () => (prefs.descendientes && seleccionada ? new Set([seleccionada, ...descendientes(malla, seleccionada)]) : null),
    [prefs.descendientes, seleccionada, malla],
  )
  const foco = useMemo<Set<string> | null>(() => {
    if (hover) return vecinos(vecindad, hover)
    if (coincidencias) return new Set(coincidencias)
    return descendientesSel
  }, [hover, vecindad, coincidencias, descendientesSel])

  // ---- Encendido escalonado por semestre la primera vez que llegan notas ----
  const [encendiendo, setEncendiendo] = useState(false)
  const habiaNotas = useRef(hayNotas)
  useEffect(() => {
    const antes = habiaNotas.current
    habiaNotas.current = hayNotas
    if (!hayNotas || antes || prefiereMenosMovimiento()) return
    setEncendiendo(true)
    const t = setTimeout(() => setEncendiendo(false), 1200)
    return () => clearTimeout(t)
  }, [hayNotas])

  // ---- Nodos y aristas para React Flow ----
  const datosNodo = useMemo(() => {
    const m = new Map<string, DatosNodo>()
    for (const materia of malla.materias) {
      const id = materia.id
      m.set(id, {
        materia,
        estado: estados.get(id)!,
        radio: radios.get(id)!,
        seleccionada: seleccionada === id,
        atenuada: foco !== null && !foco.has(id),
        enfocada: hover === id,
        enCadena: prefs.cadena && enCadena.has(id),
        cuello: prefs.cuellos && cuellos.has(id),
        hipotetica: escenario.hipoteticas.has(id),
        colorSemestre: prefs.colorearPor === 'semestre' ? materia.semestre : null,
        retraso: encendiendo ? (materia.semestre - 1) * 30 : null,
      })
    }
    return m
  }, [malla, estados, radios, seleccionada, foco, hover, prefs.cadena, enCadena, prefs.cuellos, cuellos, prefs.colorearPor, encendiendo, escenario.hipoteticas])

  const nodos = useMemo<NodoMateriaTipo[]>(
    () =>
      malla.materias.map((m) => {
        const data = datosNodo.get(m.id)!
        return {
          id: m.id,
          type: 'materia',
          position: esquinaDesdeCentro(centros.get(m.id) ?? { x: 0, y: 0 }, data.radio),
          width: ANCHO_NODO,
          height: altoNodo(data.radio),
          hidden: !visible(m.id),
          draggable: organico,
          selectable: false,
          zIndex: hover === m.id ? 10 : seleccionada === m.id ? 5 : 0,
          data,
        }
      }),
    [malla, datosNodo, centros, visible, organico, hover, seleccionada],
  )

  const aristas = useMemo<AristaMateriaTipo[]>(() => {
    const lista = [
      ...malla.prerrequisitos.map((e) => ({ ...e, blanda: false })),
      ...(prefs.blandas ? malla.aristas_blandas.map((e) => ({ ...e, blanda: true })) : []),
    ]
    return lista.map(({ de, a, blanda }) => {
      const critica = !blanda && prefs.cadena && aristasCadena.has(claveArista(de, a))
      let modo: 'normal' | 'resaltada' | 'atenuada' = 'normal'
      if (hover) modo = de === hover || a === hover ? 'resaltada' : 'atenuada'
      else if (foco) modo = foco.has(de) && foco.has(a) ? 'normal' : 'atenuada'
      const acento = critica || modo === 'resaltada'
      return {
        id: `${blanda ? 'b' : 'p'}:${claveArista(de, a)}`,
        source: de,
        target: a,
        type: 'materia',
        hidden: !visible(de) || !visible(a),
        markerEnd: acento ? MARCADOR.acento : blanda ? MARCADOR.blanda : MARCADOR.normal,
        zIndex: acento ? 1 : 0,
        selectable: false,
        focusable: false,
        data: { blanda, critica, flujo: critica && prefs.flujo, modo },
      }
    })
  }, [malla, prefs.blandas, prefs.cadena, prefs.flujo, aristasCadena, hover, foco, visible])

  // Arrastrar (solo en orgánico) mueve el centro guardado de la materia.
  const alCambiarNodos = useCallback(
    (cambios: NodeChange<NodoMateriaTipo>[]) => {
      const movidos = cambios.filter((c) => c.type === 'position' && c.position)
      if (movidos.length === 0) return
      cancelAnimationFrame(animacion.current)
      setCentros((prev) => {
        const n = new Map(prev)
        for (const c of movidos) {
          if (c.type !== 'position' || !c.position) continue
          n.set(c.id, centroDesdeEsquina(c.position, radios.get(c.id) ?? 17))
        }
        return n
      })
    },
    [radios],
  )

  // Al filtrar, reencuadra lo que quedó visible.
  const primeraFirma = useRef(firmaVisibles)
  useEffect(() => {
    if (!iniciado || primeraFirma.current === firmaVisibles) return
    primeraFirma.current = firmaVisibles
    const r = requestAnimationFrame(ajustar)
    return () => cancelAnimationFrame(r)
  }, [firmaVisibles, iniciado, ajustar])

  // ---- Cámara ----
  const centrar = useCallback(
    (id: string, forzar = false) => {
      const c = centrosRef.current.get(id)
      const caja = contenedor.current?.getBoundingClientRect()
      if (!c || !caja) return
      const { x, y, zoom } = flujo.getViewport()
      const sx = c.x * zoom + x
      const sy = c.y * zoom + y
      const margen = 80
      const dentro = sx > margen && sx < caja.width - margen && sy > margen && sy < caja.height - margen
      if (dentro && !forzar) return
      void flujo.setCenter(c.x, c.y, { zoom: Math.max(zoom, 0.8), duration: duracion(300) })
    },
    [flujo],
  )

  const [anuncio, setAnuncio] = useState('')
  const anunciar = useCallback(
    (id: string) => {
      const m = materiaPorId.get(id)
      const e = estados.get(id)
      if (m && e) setAnuncio(describirNodo(m, e, vecindad))
    },
    [materiaPorId, estados, vecindad],
  )

  const centrarBusqueda = useCallback(() => {
    const primera = coincidencias?.[0]
    if (!primera) return
    seleccionar(primera)
    centrar(primera, true)
    anunciar(primera)
  }, [coincidencias, seleccionar, centrar, anunciar])

  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement === contenedor.current)
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])
  const alternarPantallaCompleta = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await contenedor.current?.requestFullscreen()
    } catch {
      avisar('Tu navegador no permitió la pantalla completa.')
    }
  }, [])

  const [exportando, setExportando] = useState(false)
  const exportandoRef = useRef(false)
  const exportar = useCallback(async () => {
    if (exportandoRef.current || !contenedor.current) return
    exportandoRef.current = true
    setExportando(true)
    try {
      await exportarGrafoPng(contenedor.current, flujo.getNodesBounds(flujo.getNodes().filter((n) => !n.hidden)))
      avisar('Guardé la imagen de tu malla como gradly-malla.png.')
    } catch {
      avisar('No pude exportar la imagen del grafo. Intenta de nuevo.')
    } finally {
      exportandoRef.current = false
      setExportando(false)
    }
  }, [flujo])

  // Pedidos desde la paleta de comandos.
  const solicitar = useGrafo((s) => s.solicitar)
  useEffect(() => {
    if (!iniciado || !prefs.solicitud) return
    const s = prefs.solicitud
    solicitar(null)
    if (s === 'ajustar') ajustar()
    else if (s === 'exportar') void exportar()
    else restablecer()
  }, [iniciado, prefs.solicitud, solicitar, ajustar, exportar, restablecer])

  // ---- Teclado ----
  const ctxNavegacion = useMemo(
    () => ({ vecindad, centros, columnas: layout.columnas, semestreDe, orden, visible }),
    [vecindad, centros, layout.columnas, semestreDe, orden, visible],
  )

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const siguiente = navegar(e.key as Tecla, seleccionada, ctxNavegacion)
        if (siguiente) {
          seleccionar(siguiente)
          centrar(siguiente)
          anunciar(siguiente)
        }
        break
      }
      case 'Enter':
        if (!seleccionada) return
        abrirMateria(seleccionada)
        break
      case 'Escape':
        if (!seleccionada) return
        seleccionar(null)
        setAnuncio('Ninguna materia seleccionada.')
        break
      case 'f':
      case 'F':
        ajustar()
        break
      case '+':
      case '=':
        void flujo.zoomIn({ duration: duracion(200) })
        break
      case '-':
        void flujo.zoomOut({ duration: duracion(200) })
        break
      case '/':
        useGrafo.getState().fijar('panelAbierto', true)
        requestAnimationFrame(() => contenedor.current?.querySelector<HTMLInputElement>('[data-buscador="grafo"]')?.focus())
        break
      default:
        return
    }
    e.preventDefault()
  }

  // Etiquetas que se desvanecen al alejar.
  const umbral = prefs.umbralTexto
  const conTexto = useStore((s) => s.transform[2] >= umbral)

  const clases = ['malla', !conTexto && 'malla-sin-texto', organico && 'malla-organico', foco && 'malla-con-foco']
    .filter(Boolean)
    .join(' ')
  const estilo = { '--grosor': `${prefs.grosor}px` } as CSSProperties
  const sinNodos = visibles.length === 0

  return (
    <div
      ref={contenedor}
      className={clases}
      style={estilo}
      tabIndex={0}
      role="group"
      aria-roledescription="grafo"
      aria-label="Malla de la carrera como grafo"
      aria-describedby={idAyuda}
      onKeyDown={alTeclear}
    >
      <p id={idAyuda} className="solo-lectores">
        Usa las flechas para recorrer las materias: izquierda a un prerrequisito, derecha a una materia que depende de
        ella, arriba y abajo dentro del semestre. Enter abre la materia, Escape quita la selección, F ajusta a la
        pantalla y barra diagonal busca.
      </p>
      <div className="solo-lectores" role="status" aria-live="polite">
        {anuncio}
      </div>

      <ReactFlow<NodoMateriaTipo, AristaMateriaTipo>
        colorMode="dark"
        nodes={nodos}
        edges={aristas}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={alCambiarNodos}
        onInit={() => setIniciado(true)}
        onNodeClick={(_, n) => elegirMateria(n.id)}
        onNodeDoubleClick={(_, n) => abrirMateria(n.id)}
        onNodeMouseEnter={(_, n) => setHover(n.id)}
        onNodeMouseLeave={() => setHover(null)}
        onPaneClick={() => seleccionar(null)}
        nodesDraggable={organico}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        disableKeyboardA11y
        zoomOnDoubleClick={false}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: PADDING_AJUSTE }}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
        <VariableZoom contenedor={contenedor} />
        {!organico && <EncabezadosSemestre columnas={layout.encabezados} />}

        <Panel position="top-right" className="malla-panel-ajustes">
          <PanelGrafo
            coincidencias={coincidencias?.length ?? 0}
            haySeleccion={seleccionada !== null}
            onBuscarEnter={centrarBusqueda}
            onRestablecerDisposicion={restablecer}
          />
        </Panel>

        <Panel position="bottom-left" className="malla-panel-camara">
          <BarraCamara
            onAcercar={() => void flujo.zoomIn({ duration: duracion(200) })}
            onAlejar={() => void flujo.zoomOut({ duration: duracion(200) })}
            onAjustar={ajustar}
            minimapa={prefs.minimapa}
            onMinimapa={() => useGrafo.getState().alternar('minimapa')}
            pantallaCompleta={pantallaCompleta}
            onPantallaCompleta={() => void alternarPantallaCompleta()}
            exportando={exportando}
            onExportar={() => void exportar()}
          />
        </Panel>

        <Panel position="bottom-center" className="malla-panel-leyenda">
          <Leyenda hayNotas={hayNotas} cadena={prefs.cadena} cuellos={prefs.cuellos} />
        </Panel>

        {prefs.minimapa && (
          <MiniMap<NodoMateriaTipo>
            className="malla-minimapa"
            pannable
            zoomable
            ariaLabel="Minimapa de la malla"
            nodeColor={colorMinimapa}
            nodeStrokeWidth={0}
            nodeBorderRadius={999}
          />
        )}
      </ReactFlow>

      {sinNodos && (
        <div className="malla-vacia" role="status">
          <p>Con estos filtros no queda ninguna materia a la vista.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const g = useGrafo.getState()
              g.fijar('soloDisponibles', false)
              g.fijar('ocultarBloqueadas', false)
            }}
          >
            Quitar filtros
          </button>
        </div>
      )}
    </div>
  )
}
