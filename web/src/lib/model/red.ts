// Red neuronal en el navegador (alternativa a la regresión de predict.ts).
//
// Una red pequeña por materia, entrenada en model/gradly_model/red.py y exportada en data/pesos.json:
//   x_p = y(s,p) − ȳ(s)                (0 si no cursó la materia previa p)
//   ŷ   = ȳ(s) + tanh(x·W1 + b1)·W2 + b2
//
// Es la misma cuenta que model/gradly_model/predict.py (predecir_materia_red); las dos se
// comparan con data/fixtures/red_caso_conocido.json.

import type { Contribucion, Malla, Modelo, Prediccion, RedCurso, Semaforo } from '../../types'
import { normalCdf, predecirMateria, promedio, UMBRALES } from './predict'

const limitar = (x: number) => Math.min(5, Math.max(0, x))

function semaforo(prob: number): Semaforo {
  if (prob >= UMBRALES.rojo) return 'rojo'
  if (prob >= UMBRALES.amarillo) return 'amarillo'
  return 'verde'
}

/** Propagación hacia adelante: o = tanh(x·W1 + b1)·W2 + b2. */
export function salidaRed(red: RedCurso, x: number[]): number {
  let salida = red.b2
  for (let j = 0; j < red.b1.length; j++) {
    let suma = red.b1[j]
    for (let i = 0; i < x.length; i++) suma += x[i] * red.W1[i][j]
    salida += Math.tanh(suma) * red.W2[j]
  }
  return salida
}

/**
 * Predice una materia con la red. El "por qué" se calcula por oclusión: cuánto cambia la
 * predicción si se "olvida" la nota de una materia previa (su desviación pasa a 0).
 * Si el modelo no trae red para la materia, usa la regresión.
 */
export function predecirMateriaRed(
  materia: string,
  malla: Malla,
  modelo: Modelo,
  notas: Map<string, number>,
): Prediccion | null {
  const red = modelo.red?.cursos[materia]
  if (notas.size === 0 || !red) return predecirMateria(materia, malla, modelo, notas)

  const ybar = promedio(notas)
  const x = red.previas.map((p) => (notas.has(p) ? notas.get(p)! - ybar : 0))
  const salida = salidaRed(red, x)

  const contribuciones: Contribucion[] = []
  red.previas.forEach((previa, i) => {
    if (!notas.has(previa)) return
    const sinPrevia = x.map((v, j) => (j === i ? 0 : v))
    contribuciones.push({ materia: previa, aporte: salida - salidaRed(red, sinPrevia) })
  })

  const nota = limitar(ybar + salida)
  const probNoAprobar = normalCdf((malla.nota_aprobacion - nota) / red.sigma)
  return {
    materia,
    nota,
    rango: [limitar(nota - red.sigma), limitar(nota + red.sigma)],
    probNoAprobar,
    semaforo: semaforo(probNoAprobar),
    porQue: contribuciones
      .filter((c) => Math.abs(c.aporte) > 0.005)
      .sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte))
      .slice(0, 3),
    usaModelo: true,
  }
}
