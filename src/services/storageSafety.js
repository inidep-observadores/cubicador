import { get, set } from 'idb-keyval'

/**
 * Protecciones del almacenamiento local:
 * - almacenamiento persistente (el navegador no lo borra por falta de espacio)
 * - candado para que la base se use en una sola pestaña a la vez
 * - copias automáticas dentro del navegador
 * - registro de la última exportación a archivo
 */

const LOCK_NAME = 'cubicacion-pozos-db'
const BACKUPS_KEY = 'cubicacion_copias'
const LAST_EXPORT_KEY = 'cubicacion_ultima_exportacion'
const MAX_BACKUPS = 10
const DAY_MS = 24 * 60 * 60 * 1000

export const MOTIVO_DIARIA = 'Copia diaria'

// --- Almacenamiento persistente ---

/**
 * Pide que el navegador no borre los datos de la app (por falta de espacio o,
 * en Safari, por inactividad). Devuelve true/false, o null si no hay soporte.
 */
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return null
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

// --- Candado de pestaña única ---

/**
 * Intenta tomar el candado de la base. Resuelve:
 * - 'adquirida': esta pestaña es la dueña de la base
 * - 'ocupada': otra pestaña la tiene abierta
 * - 'sin-soporte': el navegador no tiene Web Locks; se sigue sin candado
 * Con `steal: true` se lo quita a la otra pestaña, que recibe `onLost`.
 */
export function acquireTabLock({ steal = false, onLost } = {}) {
  if (!navigator.locks?.request) return Promise.resolve('sin-soporte')
  return new Promise(resolve => {
    navigator.locks
      .request(LOCK_NAME, steal ? { steal: true } : { ifAvailable: true }, lock => {
        if (!lock) {
          resolve('ocupada')
          return undefined
        }
        resolve('adquirida')
        // Se mantiene tomado mientras la pestaña siga abierta
        return new Promise(() => {})
      })
      .catch(err => {
        if (err?.name === 'AbortError') onLost?.()
        else resolve('sin-soporte')
      })
  })
}

// --- Copias automáticas dentro del navegador ---

/** Lista de copias, de la más nueva a la más vieja. */
export async function listBackups() {
  return (await get(BACKUPS_KEY)) || []
}

/** Lista sin el contenido binario, para mostrar en la interfaz. */
export async function listBackupsInfo() {
  return (await listBackups()).map(({ id, fecha, motivo, tamano }) => ({ id, fecha, motivo, tamano }))
}

export async function saveBackup(data, motivo) {
  const bytes = new Uint8Array(data)
  const copias = await listBackups()
  copias.unshift({
    id: Date.now(),
    fecha: new Date().toISOString(),
    motivo,
    tamano: bytes.byteLength,
    data: bytes
  })
  await set(BACKUPS_KEY, copias.slice(0, MAX_BACKUPS))
}

export async function getBackupData(id) {
  const copia = (await listBackups()).find(c => c.id === id)
  return copia ? copia.data : null
}

/** Guarda una copia diaria si pasaron más de 24 h desde la última. */
export async function ensureDailyBackup(data) {
  const ultima = (await listBackups()).find(c => c.motivo === MOTIVO_DIARIA)
  if (!ultima || Date.now() - Date.parse(ultima.fecha) > DAY_MS) {
    await saveBackup(data, MOTIVO_DIARIA)
    return true
  }
  return false
}

// --- Última exportación a archivo ---

export async function getLastExport() {
  return (await get(LAST_EXPORT_KEY)) || null
}

export async function markExported() {
  const ahora = Date.now()
  await set(LAST_EXPORT_KEY, ahora)
  return ahora
}
