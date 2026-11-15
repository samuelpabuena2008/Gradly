import { describe, expect, it } from 'vitest'
import { parsearNotasCsv } from '../import/csv'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import { notasACsv } from './exportar'

describe('exportar notas a CSV', () => {
  it('usa el formato de la plantilla', () => {
    const csv = notasACsv([
      { materia: 'MAT1031', periodo: '2025-1', nota: 3 },
      { materia: 'MAT1101', periodo: '2025-1', nota: 4.5 },
      { materia: 'IST0010', periodo: '2025-2', nota: 3.75 },
    ])
    expect(csv).toBe('materia,periodo,nota\nMAT1031,2025-1,3.0\nMAT1101,2025-1,4.5\nIST0010,2025-2,3.75\n')
  })

  it('lo exportado se vuelve a importar igual (ida y vuelta con la plantilla)', () => {
    const { notas, errores } = parsearNotasCsv(plantilla)
    expect(errores).toEqual([])
    expect(parsearNotasCsv(notasACsv(notas)).notas).toEqual(notas)
  })

  it('sin notas exporta solo la cabecera', () => {
    expect(notasACsv([])).toBe('materia,periodo,nota\n')
  })
})
