/**
 * Archivos de respaldo (.cubi). Por dentro son la base SQLite completa, marcada
 * con una firma propia. Módulo puro, para poder usarlo desde las pruebas.
 */
import { sqlJsCompat, openFromBytes } from './sqliteCompat.js'
import { migrateDatabase, validateSchema, getSchemaVersion, SCHEMA_VERSION } from './migrations.js'

export const EXTENSION = '.cubi'

// "CUBI" en ASCII, guardado en PRAGMA application_id (cabecera del archivo)
export const FIRMA = 0x43554249

const NO_ES_RESPALDO = 'El archivo no es un respaldo de Cubicación 3D.'
const DANADO = 'El archivo está dañado o incompleto.'

export const nombreRespaldo = (fecha = new Date()) =>
  `respaldo_pozos_${fecha.toISOString().slice(0, 10)}${EXTENSION}`

const firmaDe = (db) => db.exec('PRAGMA application_id')[0].values[0][0]

export function firmar(db) {
  if (firmaDe(db) !== FIRMA) db.run(`PRAGMA application_id = ${FIRMA}`)
}

/**
 * Firma leída de la cabecera del archivo, o null si no es una base SQLite. Se
 * lee de los bytes porque un archivo cortado ya no se puede consultar, y hay que
 * distinguir "no es un respaldo" de "está dañado".
 */
function firmaEnCabecera(bytes) {
  if (bytes.length < 100) return null
  if (String.fromCharCode(...bytes.subarray(0, 15)) !== 'SQLite format 3') return null
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(68)
}

function comprobarIntegridad(db) {
  if (db.exec('PRAGMA quick_check(1)')[0]?.values[0][0] !== 'ok') throw new Error(DANADO)
}

/**
 * Comprueba y actualiza una base recibida como bytes, en memoria: la base en uso
 * no se toca. Devuelve los bytes listos, firmados y en la versión actual.
 *
 * - exigirFirma: para archivos elegidos por el usuario. Las copias internas y
 *   las bases guardadas antes de que existiera la firma no la tienen.
 * - antesDeMigrar(version): para guardar una copia de la base sin actualizar.
 */
export async function prepararRespaldo(sqlite3, datos, { exigirFirma = false, antesDeMigrar } = {}) {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos)
  const firma = firmaEnCabecera(bytes)
  if (firma === null || (exigirFirma && firma !== FIRMA)) throw new Error(NO_ES_RESPALDO)

  let tmp
  let c
  try {
    tmp = openFromBytes(sqlite3, bytes)
    c = sqlJsCompat(sqlite3, tmp)
    comprobarIntegridad(c)
  } catch {
    tmp?.close()
    throw new Error(DANADO)
  }
  try {
    validateSchema(c)
    const version = getSchemaVersion(c)
    if (version < SCHEMA_VERSION) await antesDeMigrar?.(version)
    const migrated = migrateDatabase(c)
    firmar(c)
    return { bytes: c.export(), migrated }
  } finally {
    tmp.close()
  }
}
