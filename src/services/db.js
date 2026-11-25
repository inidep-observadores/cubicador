import { get, set } from 'idb-keyval'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { migrateDatabase, setSchemaVersion, getSchemaVersion, validateSchema, SCHEMA_VERSION } from './migrations.js'
import { saveBackup, markExported } from './storageSafety.js'
import { initTables, seedInitialData } from './schema.js'

const DB_STORAGE_KEY = 'cubicacion_pozos_sqlite_db'
let dbInstance = null
// false cuando otra pestaña tomó el control de la base: esta no debe sobrescribirla
let writesEnabled = true

export function setWritesEnabled(enabled) {
  writesEnabled = enabled
}

/**
 * SQLite no aplica las claves foráneas (ni ON DELETE CASCADE) salvo que se
 * active en cada conexión.
 */
function enableForeignKeys(db) {
  db.run('PRAGMA foreign_keys = ON')
}

let sqlPromise = null

/** Carga el motor SQLite (WASM) una sola vez. */
function loadSql() {
  // Vite resuelve la URL del .wasm con la ruta base de la app y lo incluye en la caché offline
  sqlPromise ||= initSqlJs({ locateFile: () => sqlWasmUrl }).catch(err => {
    sqlPromise = null
    throw new Error(`No se pudo cargar el motor SQLite: ${err.message || err}`)
  })
  return sqlPromise
}

/**
 * Abre una base a partir de sus bytes y la lleva al esquema actual.
 * Antes de migrar guarda una copia de la versión original.
 */
async function openAndMigrate(SQL, bytes) {
  const db = new SQL.Database(new Uint8Array(bytes))
  try {
    enableForeignKeys(db)
    validateSchema(db) // antes que nada: no respaldar ni migrar archivos ajenos
    const version = getSchemaVersion(db)
    if (version < SCHEMA_VERSION) {
      await saveBackup(bytes, `Antes de actualizar el formato (v${version} → v${SCHEMA_VERSION})`)
    }
    const migrated = migrateDatabase(db)
    return { db, migrated }
  } catch (err) {
    db.close()
    throw err
  }
}

export async function getDatabase() {
  if (dbInstance) return dbInstance

  const SQL = await loadSql()

  const savedDbData = await get(DB_STORAGE_KEY)
  if (savedDbData) {
    const { db, migrated } = await openAndMigrate(SQL, savedDbData)
    dbInstance = db
    if (migrated) await persistDatabase()
  } else {
    dbInstance = new SQL.Database()
    enableForeignKeys(dbInstance)
    initTables(dbInstance)
    seedInitialData(dbInstance)
    setSchemaVersion(dbInstance)
    await persistDatabase()
  }

  return dbInstance
}

export async function persistDatabase() {
  if (!dbInstance || !writesEnabled) return
  const binaryData = dbInstance.export()
  await set(DB_STORAGE_KEY, binaryData)
}

export async function exportDatabaseFile() {
  if (!dbInstance) return null
  const binaryData = dbInstance.export()
  const blob = new Blob([binaryData], { type: 'application/x-sqlite3' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cubicacion_pozos_${new Date().toISOString().slice(0, 10)}.sqlite`
  a.click()
  // Revocar después de que el navegador tome el archivo (Firefox lo necesita)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return markExported()
}

/** Bytes de la base actual, por ejemplo para una copia de seguridad. */
export function exportDatabaseBytes() {
  return dbInstance ? dbInstance.export() : null
}

/**
 * Reemplaza la base actual por otra (copia o archivo importado).
 * La base actual se guarda antes como copia para poder volver atrás.
 */
export async function replaceDatabase(bytes, motivo) {
  const SQL = await loadSql()
  const { db } = await openAndMigrate(SQL, bytes) // falla antes de tocar la base actual
  if (dbInstance) await saveBackup(dbInstance.export(), motivo)
  dbInstance = db
  await persistDatabase()
  return dbInstance
}

export async function importDatabaseFile(file) {
  const buffer = await file.arrayBuffer()
  return replaceDatabase(buffer, 'Antes de importar un archivo')
}
