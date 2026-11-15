// Arranque de la app: carga la malla y los pesos, valida que la malla sea un DAG y precalcula
// una sola vez los análisis de grafos que la interfaz reutiliza. Cada etapa es trabajo real.

import type { Malla, Materia, Modelo } from '../../types'
import {
  caminoMasLargo,
  gradoSalida,
  intermediacion,
  ordenTopologico,
} from '../graph/dag'
import { tipoRecomendado, type TipoModelo } from '../model/predict'

export const ETAPAS = [
  'Cargando malla',
  'Verificando que la malla no tenga ciclos',
  'Calculando cuellos de botella',
  'Cargando pesos del modelo',
  'Listo',
] as const

/** Datos inmutables de la sesión: lo que carga el arranque y lo que se precalcula una vez. */
export interface Datos {
  malla: Malla
  modelo: Modelo
  recomendado: TipoModelo
  materiaPorId: Map<string, Materia>
  /** Orden topológico (Kahn) de las materias. */
  orden: string[]
  /** Cadena de prerrequisitos más larga (cadena crítica). */
  camino: string[]
  /** Centralidad de intermediación por materia. */
  intermediacion: Record<string, number>
  /** Grado de salida por materia. */
  salida: Record<string, number>
}

/** Error de arranque con un título claro y el detalle técnico plegable. */
export class ErrorArranque extends Error {
  constructor(
    public titulo: string,
    public detalle: string,
  ) {
    super(titulo)
    this.name = 'ErrorArranque'
  }
}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

export function validarMalla(x: unknown): Malla {
  if (!esObjeto(x)) throw new ErrorArranque('La malla no tiene el formato esperado', 'El archivo no es un objeto JSON.')
  const problemas: string[] = []
  if (!Array.isArray(x.materias) || x.materias.length === 0) problemas.push('«materias» debe ser una lista con al menos una materia')
  if (!Array.isArray(x.prerrequisitos)) problemas.push('«prerrequisitos» debe ser una lista')
  if (!Array.isArray(x.aristas_blandas)) problemas.push('«aristas_blandas» debe ser una lista')
  if (typeof x.nota_aprobacion !== 'number') problemas.push('«nota_aprobacion» debe ser un número')
  if (Array.isArray(x.materias)) {
    const ids = new Set<string>()
    x.materias.forEach((m, i) => {
      if (!esObjeto(m) || typeof m.id !== 'string' || typeof m.nombre !== 'string') {
        problemas.push(`materias[${i}] necesita «id» y «nombre» de texto`)
        return
      }
      if (typeof m.semestre !== 'number' || typeof m.creditos !== 'number') {
        problemas.push(`${m.id}: «semestre» y «creditos» deben ser números`)
      }
      if (ids.has(m.id)) problemas.push(`El código ${m.id} está repetido`)
      ids.add(m.id)
    })
  }
  if (problemas.length > 0) {
    throw new ErrorArranque('La malla no tiene el formato esperado', problemas.join('\n'))
  }
  return x as unknown as Malla
}

export function validarModelo(x: unknown): Modelo {
  if (!esObjeto(x)) throw new ErrorArranque('Los pesos del modelo no tienen el formato esperado', 'El archivo no es un objeto JSON.')
  const problemas: string[] = []
  if (!esObjeto(x.medias)) problemas.push('«medias» debe ser un objeto materia → media')
  if (!esObjeto(x.cursos)) problemas.push('«cursos» debe ser un objeto materia → pesos')
  if (typeof x.k_nivel !== 'number') problemas.push('«k_nivel» debe ser un número')
  if (typeof x.sigma_global !== 'number') problemas.push('«sigma_global» debe ser un número')
  if (problemas.length > 0) {
    throw new ErrorArranque('Los pesos del modelo no tienen el formato esperado', problemas.join('\n'))
  }
  return x as unknown as Modelo
}

export interface OpcionesArranque {
  /** Carga la malla (por defecto, el JSON oficial del repositorio). */
  cargarMalla?: () => Promise<unknown>
  /** Carga los pesos (por defecto, data/pesos.json). */
  cargarModelo?: () => Promise<unknown>
  /** Tiempo mínimo visible por etapa para evitar parpadeo. 0 desactiva la espera. */
  minimoPorEtapaMs?: number
}

const porDefecto = {
  cargarMalla: async () => (await import('../../../../data/malla_sistemas.json')).default,
  cargarModelo: async () => (await import('../../../../data/pesos.json')).default,
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Ejecuta el arranque etapa por etapa. `onEtapa(i)` avisa cuál etapa de `ETAPAS` empieza.
 * Lanza `ErrorArranque` con un mensaje claro si algo falla (ciclo, JSON inválido…).
 */
export async function cargarDatos(
  onEtapa: (indice: number) => void = () => {},
  opciones: OpcionesArranque = {},
): Promise<Datos> {
  const { cargarMalla = porDefecto.cargarMalla, cargarModelo = porDefecto.cargarModelo, minimoPorEtapaMs = 180 } = opciones

  /** Corre una etapa y, si terminó muy rápido, la deja visible el mínimo acordado. */
  async function etapa<T>(indice: number, trabajo: () => T | Promise<T>): Promise<T> {
    onEtapa(indice)
    const inicio = performance.now()
    const resultado = await trabajo()
    const falta = minimoPorEtapaMs - (performance.now() - inicio)
    if (falta > 0) await esperar(falta)
    return resultado
  }

  try {
    const malla = await etapa(0, async () => validarMalla(await cargarMalla()))

    const orden = await etapa(1, () => {
      try {
        return ordenTopologico(malla)
      } catch (e) {
        throw new ErrorArranque(
          'La malla tiene un problema en sus prerrequisitos',
          e instanceof Error ? e.message : String(e),
        )
      }
    })

    const { inter, camino, salida } = await etapa(2, () => ({
      inter: intermediacion(malla),
      camino: caminoMasLargo(malla),
      salida: gradoSalida(malla),
    }))

    const modelo = await etapa(3, async () => validarModelo(await cargarModelo()))

    await etapa(4, () => undefined)

    return {
      malla,
      modelo,
      recomendado: tipoRecomendado(modelo),
      materiaPorId: new Map(malla.materias.map((m) => [m.id, m])),
      orden,
      camino,
      intermediacion: inter,
      salida,
    }
  } catch (e) {
    if (e instanceof ErrorArranque) throw e
    throw new ErrorArranque(
      'No se pudo iniciar Gradly',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    )
  }
}
