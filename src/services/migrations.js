import * as THREE from 'three'
import { getBlockBounds } from './csgService.js'

/**
 * Versionado del esquema de la base SQLite.
 * La versión se guarda en `PRAGMA user_version`; las bases anteriores a este
 * mecanismo tienen versión 0.
 */
export const SCHEMA_VERSION = 1

// Figuras cuya malla se giró 90° en planta en la versión 1 (antes el largo iba sobre Z)
const FIGURAS_GIRADAS_V1 = ['trapezoide', 'trapezoide_conico_1', 'trapezoide_conico_2']

export function getSchemaVersion(db) {
  return db.exec('PRAGMA user_version')[0].values[0][0]
}

// Columnas mínimas que necesita la aplicación en cada tabla
const COLUMNAS_REQUERIDAS = {
  buques: ['id', 'nombre'],
  pozos: ['id', 'buque_id', 'nombre', 'densidad_estiba'],
  bloques: [
    'id', 'pozo_id', 'orden', 'nombre', 'tipo_figura', 'operacion',
    'largo', 'ancho', 'alto', 'base_a', 'base_b', 'diametro_d', 'diametro_d_menor',
    'pos_x', 'pos_y', 'pos_z', 'rot_x', 'rot_y', 'rot_z'
  ]
}

/**
 * Comprueba que el archivo sea una base de esta aplicación antes de usarlo.
 * Lanza un error con un mensaje claro si no lo es.
 */
export function validateSchema(db) {
  let tablas
  try {
    tablas = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")
  } catch {
    throw new Error('El archivo no es una base de datos SQLite válida.')
  }
  const existentes = new Set(tablas.length ? tablas[0].values.map(r => r[0]) : [])

  for (const [tabla, columnas] of Object.entries(COLUMNAS_REQUERIDAS)) {
    if (!existentes.has(tabla)) {
      throw new Error(`El archivo no es una base de Cubicación 3D: falta la tabla "${tabla}".`)
    }
    const info = db.exec(`PRAGMA table_info(${tabla})`)
    const tiene = new Set(info.length ? info[0].values.map(r => r[1]) : [])
    const faltan = columnas.filter(c => !tiene.has(c))
    if (faltan.length) {
      throw new Error(`El archivo no es una base de Cubicación 3D: a la tabla "${tabla}" le faltan columnas (${faltan.join(', ')}).`)
    }
  }
}

export function setSchemaVersion(db, version = SCHEMA_VERSION) {
  db.run(`PRAGMA user_version = ${Number(version)}`)
}

/**
 * Lleva la base a la versión actual. Devuelve true si hubo cambios que persistir.
 */
export function migrateDatabase(db) {
  validateSchema(db)
  const version = getSchemaVersion(db)
  if (version > SCHEMA_VERSION) {
    throw new Error(`La base fue creada con una versión más nueva de la aplicación (esquema ${version}).`)
  }
  if (version === SCHEMA_VERSION) return false

  db.run('BEGIN')
  try {
    if (version < 1) migrarAV1(db)
    setSchemaVersion(db)
    db.run('COMMIT')
  } catch (err) {
    db.run('ROLLBACK')
    throw err
  }
  return true
}

function leerBloques(db) {
  const stmt = db.prepare('SELECT * FROM bloques')
  const list = []
  while (stmt.step()) list.push(stmt.getAsObject())
  stmt.free()
  return list
}

/**
 * V1: conserva el aspecto de los pozos guardados tras los cambios de convención.
 * - Los trapezoides ahora tienen el largo sobre X: se compensa con -90° en planta
 *   para que sigan ocupando el mismo lugar.
 * - Las piezas se creaban flotando a media altura: cada pozo se baja en bloque
 *   hasta que su pieza de unión más baja apoye en y = 0. Al mover todas las piezas
 *   juntas, las posiciones relativas (y por lo tanto el volumen) no cambian.
 */
function migrarAV1(db) {
  const bloques = leerBloques(db)
  const compensacion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)

  for (const b of bloques) {
    if (!FIGURAS_GIRADAS_V1.includes(b.tipo_figura)) continue
    const q = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(b.rot_x || 0, b.rot_y || 0, b.rot_z || 0))
      .multiply(compensacion)
    const e = new THREE.Euler().setFromQuaternion(q)
    b.rot_x = e.x
    b.rot_y = e.y
    b.rot_z = e.z
  }

  const porPozo = new Map()
  for (const b of bloques) {
    if (!porPozo.has(b.pozo_id)) porPozo.set(b.pozo_id, [])
    porPozo.get(b.pozo_id).push(b)
  }
  for (const piezas of porPozo.values()) {
    const pisos = piezas
      .filter(b => b.operacion === 'UNION')
      .map(b => getBlockBounds(b))
      .filter(Boolean)
      .map(box => box.min.y)
    if (pisos.length === 0) continue
    const dy = -Math.min(...pisos)
    if (Math.abs(dy) < 1e-9) continue
    piezas.forEach(b => { b.pos_y = (b.pos_y || 0) + dy })
  }

  const update = db.prepare('UPDATE bloques SET pos_y = ?, rot_x = ?, rot_y = ?, rot_z = ? WHERE id = ?')
  for (const b of bloques) {
    update.run([b.pos_y || 0, b.rot_x || 0, b.rot_y || 0, b.rot_z || 0, b.id])
  }
  update.free()
}
