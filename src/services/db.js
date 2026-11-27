import { markExported } from './storageSafety.js'
import { nombreRespaldo } from './respaldo.js'

/**
 * Acceso a la base de datos desde el hilo principal.
 *
 * La base vive en un Web Worker (src/workers/dbWorker.js): archivo SQLite en el
 * OPFS, o en memoria con copia en IndexedDB si el navegador no admite OPFS.
 * Todas las operaciones son asíncronas y se atienden en orden.
 */

let worker = null
let nextId = 1
const pending = new Map() // id → { resolve, reject }

function rejectAll(error) {
  for (const p of pending.values()) p.reject(error)
  pending.clear()
}

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/dbWorker.js', import.meta.url), { type: 'module' })
  worker.onmessage = event => {
    const { id, result, error } = event.data
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    if (error) p.reject(new Error(error))
    else p.resolve(result)
  }
  worker.onerror = event => {
    event.preventDefault?.()
    rejectAll(new Error(`No se pudo iniciar la base de datos: ${event.message || 'error del worker'}`))
  }
  return worker
}

function call(op, args = [], transfer = []) {
  const w = worker || (op === 'open' ? getWorker() : null)
  if (!w) return Promise.reject(new Error('La base de datos no está abierta.'))
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, op, args }, transfer)
  })
}

/**
 * Abre la base (y la crea o migra si hace falta).
 * @returns {Promise<{ backend: 'opfs'|'memoria', origen: string }>}
 */
export function openDatabase() {
  return call('open')
}

/** Filas como objetos { columna: valor }. */
export function query(sql, params = []) {
  return call('query', [sql, params])
}

/** @returns {Promise<{ changes: number, lastInsertRowid: number }>} */
export function run(sql, params = []) {
  return call('run', [sql, params])
}

/** Varias sentencias [{ sql, params }] en una sola transacción. */
export function batch(statements) {
  return call('batch', [statements])
}

/** Copia completa de la base como archivo SQLite. */
export function exportDatabaseBytes() {
  return call('export')
}

/**
 * Cierra la base y termina el worker, soltando los archivos del OPFS para que
 * otra pestaña pueda abrirlos. Después de esto no se puede escribir.
 */
export async function closeDatabase() {
  if (!worker) return
  const w = worker
  try {
    await Promise.race([call('close'), new Promise(r => setTimeout(r, 1000))])
  } catch {
    // Igual se termina el worker: al terminarlo el navegador libera los archivos
  }
  w.terminate()
  if (worker === w) worker = null
  rejectAll(new Error('La base de datos se cerró.'))
}

export async function exportDatabaseFile() {
  const bytes = await exportDatabaseBytes()
  // Tipo genérico: así ningún navegador le cambia la extensión
  const blob = new Blob([bytes], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreRespaldo()
  a.click()
  // Revocar después de que el navegador tome el archivo (Firefox lo necesita)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return markExported()
}

/**
 * Reemplaza la base actual por otra (copia o archivo importado). El worker la
 * valida y migra antes de tocar la actual, y guarda la actual como copia.
 */
export function replaceDatabase(bytes, motivo, opciones) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return call('replace', [data, motivo, opciones])
}

export async function importDatabaseFile(file) {
  const buffer = await file.arrayBuffer()
  // Un archivo elegido a mano tiene que traer la firma de la app
  return replaceDatabase(buffer, 'Antes de restaurar un archivo', { exigirFirma: true })
}
