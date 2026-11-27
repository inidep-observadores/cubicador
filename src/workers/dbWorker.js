import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { get, set, del } from 'idb-keyval'
import { sqlJsCompat, openFromBytes } from '../services/sqliteCompat.js'
import { initTables, seedInitialData } from '../services/schema.js'
import {
  migrateDatabase, validateSchema, getSchemaVersion, setSchemaVersion, SCHEMA_VERSION
} from '../services/migrations.js'
import { prepararRespaldo, firmar } from '../services/respaldo.js'
import { saveBackup } from '../services/storageSafety.js'

/**
 * Base de datos de la app, en un Web Worker.
 *
 * Almacenamiento principal: archivo SQLite real en el OPFS (Origin Private File
 * System) con el VFS "opfs-sahpool". Cada cambio se escribe por páginas, con el
 * journal de SQLite, sin reescribir la base entera; no requiere cabeceras
 * COOP/COEP en el servidor.
 *
 * Respaldo para navegadores sin OPFS en workers: base en memoria cuya copia
 * completa se guarda en IndexedDB después de cada escritura (el método anterior).
 *
 * Protocolo: { id, op, args } → { id, result } | { id, error }
 */

const DB_FILE = '/cubicacion.sqlite3'
const LEGACY_IDB_KEY = 'cubicacion_pozos_sqlite_db'
const POOL_NAME = 'cubicacion-pool'

let sqlite3 = null
let pool = null
let db = null
let backend = null // 'opfs' | 'memoria'

const sleep = ms => new Promise(r => setTimeout(r, ms))

function opfsSupported() {
  return typeof FileSystemSyncAccessHandle !== 'undefined' && !!navigator.storage?.getDirectory
}

/**
 * Instala el VFS. Si otra pestaña acaba de soltar la base, sus archivos pueden
 * tardar un momento en liberarse: se reintenta. `preserveOnInitFailure` es
 * imprescindible: sin él, un fallo de inicialización BORRA todo el almacenamiento.
 */
async function installPool() {
  let lastError
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      return await sqlite3.installOpfsSAHPoolVfs({
        name: POOL_NAME,
        initialCapacity: 6,
        clearOnInit: false,
        preserveOnInitFailure: true,
        forceReinitIfPreviouslyFailed: attempt > 0
      })
    } catch (err) {
      lastError = err
      await sleep(300)
    }
  }
  throw new Error(`No se pudo abrir el almacenamiento de la app (OPFS): ${lastError?.message || lastError}`)
}

const compat = () => sqlJsCompat(sqlite3, db)

function exportBytes() {
  return sqlite3.capi.sqlite3_js_db_export(db.pointer)
}

/** En modo memoria, cada escritura se guarda en IndexedDB. */
async function persistIfMemory() {
  if (backend === 'memoria') await set(LEGACY_IDB_KEY, exportBytes())
}

/** Como prepararRespaldo, guardando una copia si la base hay que actualizarla. */
function prepareBytes(bytes, backupMotivo, { exigirFirma = false } = {}) {
  return prepararRespaldo(sqlite3, bytes, {
    exigirFirma,
    antesDeMigrar: backupMotivo
      ? version => saveBackup(bytes, `${backupMotivo} (v${version} → v${SCHEMA_VERSION})`)
      : undefined
  })
}

function configureConnection() {
  // SQLite no aplica las claves foráneas salvo que se active en cada conexión
  db.exec('PRAGMA foreign_keys = ON')
}

async function openOpfs() {
  pool = await installPool()
  let origen = 'existente'

  if (!pool.getFileNames().includes(DB_FILE)) {
    const legacy = await get(LEGACY_IDB_KEY)
    if (legacy) {
      // Primera vez con OPFS: se trae la base que estaba en IndexedDB
      const { bytes } = await prepareBytes(legacy, 'Antes de actualizar el formato')
      await pool.importDb(DB_FILE, bytes)
      await saveBackup(legacy, 'Base anterior al cambio de almacenamiento (IndexedDB)')
      await del(LEGACY_IDB_KEY)
      origen = 'migrada'
    } else {
      origen = 'nueva'
    }
  }

  db = new pool.OpfsSAHPoolDb(DB_FILE)
  configureConnection()

  if (origen === 'nueva') {
    initTables(compat())
    seedInitialData(compat())
    setSchemaVersion(compat())
  } else if (origen === 'existente') {
    // Si una migración anterior se interrumpió después de copiar la base al OPFS,
    // la versión de IndexedDB quedó vieja: se guarda como copia y se quita
    const legacy = await get(LEGACY_IDB_KEY)
    if (legacy) {
      await saveBackup(legacy, 'Base anterior al cambio de almacenamiento (IndexedDB)')
      await del(LEGACY_IDB_KEY)
    }
    validateSchema(compat())
    const version = getSchemaVersion(compat())
    if (version < SCHEMA_VERSION) {
      await saveBackup(exportBytes(), `Antes de actualizar el formato (v${version} → v${SCHEMA_VERSION})`)
      migrateDatabase(compat())
    }
  }
  firmar(compat())
  return origen
}

async function openMemory() {
  const legacy = await get(LEGACY_IDB_KEY)
  let origen = 'nueva'
  if (legacy) {
    const { bytes, migrated } = await prepareBytes(legacy, 'Antes de actualizar el formato')
    db = openFromBytes(sqlite3, bytes)
    origen = 'existente'
    configureConnection()
    if (migrated) await persistIfMemory()
  } else {
    db = new sqlite3.oo1.DB(':memory:')
    configureConnection()
    initTables(compat())
    seedInitialData(compat())
    setSchemaVersion(compat())
    await persistIfMemory()
  }
  firmar(compat())
  return origen
}

const ops = {
  async open() {
    if (db) return { backend, origen: 'abierta' }
    sqlite3 ??= await sqlite3InitModule()
    let origen
    if (opfsSupported()) {
      backend = 'opfs'
      origen = await openOpfs()
    } else {
      backend = 'memoria'
      origen = await openMemory()
    }
    return { backend, origen }
  },

  query(sql, params) {
    return db.exec({ sql, bind: params?.length ? params : undefined, rowMode: 'object', returnValue: 'resultRows' })
  },

  async run(sql, params) {
    db.exec({ sql, bind: params?.length ? params : undefined })
    const result = {
      changes: db.changes(),
      lastInsertRowid: Number(sqlite3.capi.sqlite3_last_insert_rowid(db.pointer))
    }
    await persistIfMemory()
    return result
  },

  /** Varias sentencias en una sola transacción: o se aplican todas o ninguna. */
  async batch(statements) {
    db.transaction(() => {
      for (const { sql, params } of statements) {
        db.exec({ sql, bind: params?.length ? params : undefined })
      }
    })
    await persistIfMemory()
    return true
  },

  export() {
    return exportBytes()
  },

  /** Reemplaza la base actual (importación o restauración de una copia). */
  async replace(bytes, motivo, opciones) {
    const prepared = await prepareBytes(bytes, null, opciones) // falla antes de tocar la base actual
    await saveBackup(exportBytes(), motivo)
    db.close()
    db = null
    if (backend === 'opfs') {
      await pool.importDb(DB_FILE, prepared.bytes)
      db = new pool.OpfsSAHPoolDb(DB_FILE)
    } else {
      db = openFromBytes(sqlite3, prepared.bytes)
    }
    configureConnection()
    await persistIfMemory()
    return true
  },

  /** Cierra la base y suelta los archivos del OPFS para que otra pestaña los use. */
  close() {
    db?.close()
    db = null
    if (pool && !pool.isPaused()) pool.pauseVfs()
    return true
  }
}

// Las operaciones se atienden de a una y en orden de llegada
let queue = Promise.resolve()

self.onmessage = event => {
  const { id, op, args = [] } = event.data
  queue = queue.then(async () => {
    try {
      if (!ops[op]) throw new Error(`Operación desconocida: ${op}`)
      if (op !== 'open' && op !== 'close' && !db) throw new Error('La base de datos no está abierta.')
      const result = await ops[op](...args)
      const transfer = result instanceof Uint8Array ? [result.buffer] : []
      self.postMessage({ id, result }, transfer)
    } catch (err) {
      self.postMessage({ id, error: err?.message || String(err) })
    }
  })
}
