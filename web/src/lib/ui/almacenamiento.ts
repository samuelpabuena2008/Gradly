// localStorage con red de seguridad: puede estar bloqueado (ventana privada, políticas) o lleno.
// Si falla, la app sigue funcionando y la preferencia simplemente no persiste.
// IMPORTANTE: aquí solo van preferencias de interfaz. Las notas nunca se guardan sin que el
// usuario lo active (opt-in, ver Fase 5).

export function leerJson<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = window.localStorage.getItem(clave)
    if (crudo === null) return porDefecto
    return JSON.parse(crudo) as T
  } catch {
    return porDefecto
  }
}

export function guardarJson(clave: string, valor: unknown): boolean {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

export function borrarClave(clave: string): void {
  try {
    window.localStorage.removeItem(clave)
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}
