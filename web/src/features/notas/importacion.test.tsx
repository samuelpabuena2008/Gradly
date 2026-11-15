// @vitest-environment jsdom
// Flujo de importación (§7 y §8): leer → revisar → confirmar, con errores, cancelación y deshacer.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import plantilla from '../../../../data/plantilla_notas.csv?raw'
import type { Datos } from '../../lib/ui/arranque'
import { useApp } from '../../store/app'
import { useImportacion } from '../../store/importacion'
import { conProveedores, datosDePrueba, reiniciarApp } from '../../test/proveedores'
import { Dialogos } from '../shell/Dialogos'
import { ZonaImportar } from './ZonaImportar'

let datos: Datos
beforeEach(async () => {
  reiniciarApp()
  useImportacion.setState({ ...useImportacion.getInitialState() }, true)
  datos = await datosDePrueba()
})
afterEach(cleanup)

const montar = () =>
  render(
    conProveedores(
      datos,
      <>
        <ZonaImportar onManual={() => {}} />
        <Dialogos />
      </>,
    ),
  )
const archivo = (contenido: string, nombre: string, type = 'text/csv') => new File([contenido], nombre, { type })
const inputCsv = () => screen.getByLabelText('Elegir un archivo CSV') as HTMLInputElement
const inputPdf = () => screen.getByLabelText('Elegir el certificado de notas en PDF') as HTMLInputElement
const sinBasura = () => expect(document.body.textContent ?? '').not.toMatch(/NaN|undefined|Infinity/)

describe('importar un CSV', () => {
  it('muestra la revisión con todas las filas y confirmar carga las notas, con aviso y deshacer', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.upload(inputCsv(), archivo(plantilla, 'notas.csv'))
    const dialogo = await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
    expect(within(dialogo).getAllByRole('row').length).toBeGreaterThan(15)
    expect(within(dialogo).getByText(/notas listas para importar/)).toBeTruthy()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar y ver mi malla' }))
    expect(useApp.getState().notasReales).toHaveLength(15)
    expect(window.location.hash).toBe('#/malla')
    expect(screen.getByText(/Se importaron 15 notas/)).toBeTruthy()

    await usuario.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(useApp.getState().notasReales).toEqual([])
    sinBasura()
  })

  it('reinicia el input: reseleccionar el mismo archivo vuelve a funcionar', async () => {
    const usuario = userEvent.setup()
    montar()
    const f = archivo('materia,periodo,nota\nMAT1031,2025-1,3.0\n', 'uno.csv')
    await usuario.upload(inputCsv(), f)
    expect(inputCsv().value).toBe('')
    await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(useImportacion.getState().fase).toBe('inactivo')
    await usuario.upload(inputCsv(), f)
    await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
  })

  it('se puede corregir una fila y quitar otra antes de confirmar; las filas con error se omiten', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.upload(
      inputCsv(),
      archivo('materia,periodo,nota\nMAT1031,2025-1,3.0\nXXX9999,2025-1,4.0\nMAT1101,2025-1,2.5\nIST0010,2025-1,4.5\n', 'mixto.csv'),
    )
    const dialogo = await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
    expect(within(dialogo).getByText(/no está en la malla: se omite esta fila/)).toBeTruthy()

    const nota = within(dialogo).getByLabelText('Nota, fila 3')
    await usuario.clear(nota)
    await usuario.type(nota, '4,5')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar la fila 4' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar y ver mi malla' }))

    const notas = useApp.getState().notasReales
    expect(notas.map((n) => n.materia).sort()).toEqual(['MAT1031', 'MAT1101'])
    expect(notas.find((n) => n.materia === 'MAT1101')?.nota).toBe(4.5)
  })

  it('con notas ya cargadas se elige Reemplazar o Combinar', async () => {
    const usuario = userEvent.setup()
    useApp.getState().reemplazarNotas([
      { materia: 'MAT1031', periodo: '2024-1', nota: 2.0 },
      { materia: 'FIS1023', periodo: '2025-1', nota: 3.3 },
    ])
    montar()
    await usuario.upload(inputCsv(), archivo('materia,periodo,nota\nMAT1031,2025-1,4.0\n', 'nuevo.csv'))
    const dialogo = await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
    expect(within(dialogo).getByText(/Ya tienes 2 notas cargadas/)).toBeTruthy()

    await usuario.click(within(dialogo).getByRole('radio', { name: /Combinar/ }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar y ver mi malla' }))
    const notas = useApp.getState().notasReales
    expect(notas).toHaveLength(3) // el intento 2024-1 se conserva; el más reciente (2025-1) manda en el modelo
    expect(notas.some((n) => n.materia === 'FIS1023')).toBe(true)

    await usuario.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(useApp.getState().notasReales).toHaveLength(2)
  })

  it('Reemplazar deja solo las notas del archivo', async () => {
    const usuario = userEvent.setup()
    useApp.getState().reemplazarNotas([{ materia: 'FIS1023', periodo: '2025-1', nota: 3.3 }])
    montar()
    await usuario.upload(inputCsv(), archivo('materia,periodo,nota\nMAT1031,2025-1,4.0\n', 'nuevo.csv'))
    const dialogo = await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar y ver mi malla' }))
    expect(useApp.getState().notasReales.map((n) => n.materia)).toEqual(['MAT1031'])
  })
})

describe('estados de error y vacío', () => {
  it('CSV sin notas: estado vacío explicado', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.upload(inputCsv(), archivo('materia,periodo,nota\n', 'vacio.csv'))
    expect(await screen.findByRole('dialog', { name: 'No encontramos notas en este archivo' })).toBeTruthy()
  })

  it('CSV con la cabecera mala: lista qué falta', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.upload(inputCsv(), archivo('a,b,c\n1,2,3\n', 'malo.csv'))
    const dialogo = await screen.findByRole('dialog', { name: 'No encontramos notas en este archivo' })
    await usuario.click(within(dialogo).getByText(/Detalles/))
    expect(within(dialogo).getByText(/Faltan columnas/)).toBeTruthy()
  })

  it('un archivo que no es PDF ni CSV: mensaje accionable y la app sigue usable', async () => {
    // El navegador deja elegir «todos los archivos»: el filtro del selector no es una garantía.
    const usuario = userEvent.setup({ applyAccept: false })
    montar()
    await usuario.upload(inputCsv(), archivo('x', 'foto.png', 'image/png'))
    const dialogo = await screen.findByRole('dialog', { name: 'No podemos leer este archivo' })
    expect(within(dialogo).getByText(/PDF y tablas en CSV/)).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /Subir certificado PDF/ })).toBeTruthy()
  })

  it('un PDF corrupto: dice que está dañado y qué hacer', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.upload(inputPdf(), archivo('esto no es un pdf', 'certificado.pdf', 'application/pdf'))
    const dialogo = await screen.findByRole('dialog', { name: /no es un PDF válido/ })
    expect(within(dialogo).getByText(/Descárgalo de nuevo/)).toBeTruthy()
  })

  it('un PDF que no es un certificado (o está escaneado): lo explica', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.upload(inputPdf(), archivo('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', 'foto.pdf', 'application/pdf'))
    const dialogo = await screen.findByRole('dialog', { name: /no parece un certificado de notas/ })
    expect(within(dialogo).getByText(/escaneado/)).toBeTruthy()
  })

  it('un archivo de más de 10 MB se rechaza con el tamaño', async () => {
    const usuario = userEvent.setup()
    montar()
    const grande = archivo('x', 'enorme.pdf', 'application/pdf')
    Object.defineProperty(grande, 'size', { value: 11 * 1024 * 1024 })
    await usuario.upload(inputPdf(), grande)
    const dialogo = await screen.findByRole('dialog', { name: 'No podemos leer este archivo' })
    expect(within(dialogo).getByText(/11\.0 MB/)).toBeTruthy()
  })

  it('cancelar mientras lee descarta el resultado', async () => {
    const usuario = userEvent.setup()
    montar()
    const lento = archivo(plantilla, 'lento.csv')
    Object.defineProperty(lento, 'text', { value: () => new Promise<string>((r) => setTimeout(() => r(plantilla), 500)) })
    await usuario.upload(inputCsv(), lento)
    const dialogo = await screen.findByRole('dialog', { name: 'Leyendo tus notas' })
    expect(within(dialogo).getByRole('progressbar')).toBeTruthy()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useApp.getState().notasReales).toEqual([])
  })
})

describe('pegar texto y arrastrar y soltar', () => {
  it('pegar texto abre la revisión', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: /Pegar texto/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Pegar texto' })
    const area = within(dialogo).getByLabelText('Texto con tus notas')
    fireEvent.change(area, { target: { value: 'materia;periodo;nota\nMAT1031;2025-1;3,5\n' } })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Revisar' }))
    const revision = await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })
    expect((within(revision).getByLabelText('Nota, fila 1') as HTMLInputElement).value).toBe('3.5')
  })

  it('arrastrar un archivo muestra «Suelta tu certificado aquí» y soltarlo lo lee', async () => {
    montar()
    const f = archivo('materia,periodo,nota\nMAT1031,2025-1,3.0\n', 'soltado.csv')
    const evento = (tipo: string) => {
      const e = new Event(tipo, { bubbles: true, cancelable: true })
      Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'], files: [f], dropEffect: '' } })
      return e
    }
    act(() => {
      window.dispatchEvent(evento('dragenter'))
    })
    expect(await screen.findByText('Suelta tu certificado aquí')).toBeTruthy()
    act(() => {
      window.dispatchEvent(evento('drop'))
    })
    expect(screen.queryByText('Suelta tu certificado aquí')).toBeNull()
    expect(await screen.findByRole('dialog', { name: 'Revisa lo que encontramos' })).toBeTruthy()
  })

  it('arrastrar algo que no es un archivo no hace nada', () => {
    montar()
    const e = new Event('dragenter', { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'dataTransfer', { value: { types: ['text/plain'], files: [] } })
    act(() => {
      window.dispatchEvent(e)
    })
    expect(screen.queryByText('Suelta tu certificado aquí')).toBeNull()
  })

  it('las notas de ejemplo se cargan sin pasar por archivos', async () => {
    montar()
    await userEvent.setup().click(screen.getByRole('button', { name: /Ver con notas de ejemplo/ }))
    await waitFor(() => expect(useApp.getState().notasReales).toHaveLength(15))
  })
})
