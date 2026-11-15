// Formato de números para la interfaz. Nunca devuelve «NaN» ni «undefined»: si el valor no es
// un número válido muestra una raya.

const VACIO = '—'

export function fmtNota(n: number | null | undefined, decimales = 1): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(decimales) : VACIO
}

/** Probabilidad (0–1) como porcentaje entero: 0.234 → «23 %». */
export function fmtPct(p: number | null | undefined): string {
  return typeof p === 'number' && Number.isFinite(p) ? `${Math.round(p * 100)} %` : VACIO
}

/** Diferencia con signo y menos tipográfico: +0.3, −0.2, 0.0. */
export function fmtDelta(d: number | null | undefined, decimales = 1): string {
  if (typeof d !== 'number' || !Number.isFinite(d)) return VACIO
  const redondeado = Number(d.toFixed(decimales))
  if (redondeado === 0) return (0).toFixed(decimales)
  return `${redondeado > 0 ? '+' : '−'}${Math.abs(redondeado).toFixed(decimales)}`
}

/** «1 nota», «31 notas». */
export const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`
