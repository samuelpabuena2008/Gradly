// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { PREFS_GRAFO_INICIALES, leerPrefsGrafo, useGrafo } from './grafo'

describe('preferencias del grafo', () => {
  beforeEach(() => window.localStorage.clear())

  it('sin nada guardado usa los valores por defecto', () => {
    expect(leerPrefsGrafo()).toEqual(PREFS_GRAFO_INICIALES)
  })

  it('valida cada campo: valores corruptos vuelven al predeterminado y los números se limitan', () => {
    window.localStorage.setItem(
      'gradly:grafo',
      JSON.stringify({ blandas: 'si', tamano: 'gigante', grosor: 99, umbralTexto: -4, disposicion: 'organico', cadena: true }),
    )
    const p = leerPrefsGrafo()
    expect(p.blandas).toBe(PREFS_GRAFO_INICIALES.blandas)
    expect(p.tamano).toBe('creditos')
    expect(p.grosor).toBe(3)
    expect(p.umbralTexto).toBe(0)
    expect(p.disposicion).toBe('organico')
    expect(p.cadena).toBe(true)
  })

  it('JSON inválido no rompe nada', () => {
    window.localStorage.setItem('gradly:grafo', '{no es json')
    expect(leerPrefsGrafo()).toEqual(PREFS_GRAFO_INICIALES)
  })

  it('guarda las preferencias pero no la búsqueda', () => {
    useGrafo.getState().alternar('cuellos')
    useGrafo.getState().buscar('cálculo')
    const guardado = JSON.parse(window.localStorage.getItem('gradly:grafo') ?? '{}')
    expect(guardado.cuellos).toBe(!PREFS_GRAFO_INICIALES.cuellos)
    expect(guardado).not.toHaveProperty('busqueda')
    expect(guardado).not.toHaveProperty('solicitud')
  })
})
