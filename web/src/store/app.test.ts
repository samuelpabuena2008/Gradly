// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LIMITES_PANEL, leerPrefs, limitarAncho, useApp } from './app'
import { reiniciarApp } from '../test/proveedores'

beforeEach(reiniciarApp)

describe('store de la aplicación', () => {
  it('cambiar las notas reales descarta el escenario hipotético', () => {
    const s = useApp.getState()
    s.reemplazarNotas([{ materia: 'MAT1031', periodo: '2025-1', nota: 3 }])
    s.fijarAjuste('MAT1031', 4.5)
    expect(useApp.getState().ajustes).toEqual({ MAT1031: 4.5 })
    expect(useApp.getState().notasReales[0].nota).toBe(3) // las reales no cambian
    useApp.getState().reemplazarNotas([])
    expect(useApp.getState().ajustes).toEqual({})
  })

  it('quitar y restaurar ajustes', () => {
    const s = useApp.getState()
    s.fijarAjuste('A', 1)
    s.fijarAjuste('B', 2)
    useApp.getState().quitarAjuste('A')
    expect(useApp.getState().ajustes).toEqual({ B: 2 })
    useApp.getState().restaurarAjustes()
    expect(useApp.getState().ajustes).toEqual({})
  })

  it('abrir una materia la selecciona y la agrega a las pestañas sin duplicar', () => {
    useApp.getState().abrirMateria('MAT1031')
    useApp.getState().abrirMateria('MAT1031')
    expect(useApp.getState().pestanas).toEqual(['MAT1031'])
    expect(useApp.getState().seleccionada).toBe('MAT1031')
  })

  it('el ancho de los paneles se limita a su rango', () => {
    expect(limitarAncho('explorador', 10)).toBe(LIMITES_PANEL.explorador.min)
    expect(limitarAncho('explorador', 9999)).toBe(LIMITES_PANEL.explorador.max)
    expect(limitarAncho('inspector', NaN)).toBe(LIMITES_PANEL.inspector.inicial)
    useApp.getState().fijarAnchoInspector(5000)
    expect(useApp.getState().anchoInspector).toBe(LIMITES_PANEL.inspector.max)
  })

  it('persiste solo preferencias de interfaz: nunca notas', () => {
    useApp.getState().reemplazarNotas([{ materia: 'MAT1031', periodo: '2025-1', nota: 3.7 }])
    useApp.getState().fijarAnchoExplorador(333)
    const guardado = window.localStorage.getItem('gradly:prefs')!
    expect(JSON.parse(guardado).anchoExplorador).toBe(333)
    expect(guardado).not.toMatch(/MAT1031|3\.7|notas/)
    for (let i = 0; i < window.localStorage.length; i++) {
      expect(window.localStorage.getItem(window.localStorage.key(i)!)).not.toMatch(/MAT1031/)
    }
  })

  it('preferencias guardadas corruptas o localStorage bloqueado no rompen la app', () => {
    window.localStorage.setItem('gradly:prefs', '{"anchoExplorador":"x","exploradorAbierto":3,"tabInspector":"raro"}')
    const p = leerPrefs()
    expect(p.anchoExplorador).toBe(LIMITES_PANEL.explorador.inicial)
    expect(typeof p.exploradorAbierto).toBe('boolean')
    expect(p.tabInspector).toBe('detalle')

    window.localStorage.setItem('gradly:prefs', 'no es json')
    expect(leerPrefs().anchoInspector).toBe(LIMITES_PANEL.inspector.inicial)

    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('bloqueado')
    }
    try {
      expect(leerPrefs().anchoExplorador).toBe(LIMITES_PANEL.explorador.inicial)
    } finally {
      Storage.prototype.getItem = original
    }
  })
})
