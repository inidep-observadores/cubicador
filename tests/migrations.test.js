import { test } from 'node:test'
import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import { initTables } from '../src/services/schema.js'
import { migrateDatabase, getSchemaVersion, SCHEMA_VERSION } from '../src/services/migrations.js'
import { buildCompositePozo, getBlockBounds } from '../src/services/csgService.js'

const SQL = await initSqlJs()

const COLS = 'id, pozo_id, orden, nombre, tipo_figura, operacion, largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual'

// Base tal como la dejaba la versión anterior: sin user_version y con piezas flotando
function baseLegacy() {
  const db = new SQL.Database()
  initTables(db)
  db.run(`INSERT INTO buques (id, nombre) VALUES (1, 'B/P Prueba');
    INSERT INTO pozos (id, buque_id, nombre) VALUES (1, 1, 'Pozo 1'), (2, 1, 'Pozo 2');
    INSERT INTO bloques (${COLS}) VALUES
      (1, 1, 1, 'Caja', 'caja', 'UNION', 6, 5, 3, 0, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 90),
      (2, 1, 2, 'Trapecio', 'trapezoide', 'UNION', 4, 0, 2, 3, 1, 0, 0, 5, 1.5, 0, 0, 0, 0, 8),
      (3, 1, 3, 'Columna', 'caja', 'SUBSTRACCION', 0.8, 0.8, 3.2, 0, 0, 0, 0, 1.5, 1.6, 1.5, 0, 0, 0, 2.05),
      (4, 2, 1, 'Caja apoyada', 'caja', 'UNION', 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8);`)
  return db
}

function bloques(db, pozoId) {
  const stmt = db.prepare('SELECT * FROM bloques WHERE pozo_id = ? ORDER BY orden')
  stmt.bind([pozoId])
  const list = []
  while (stmt.step()) list.push(stmt.getAsObject())
  stmt.free()
  return list
}

// Forma vieja del trapezoide: misma malla actual girada -90° en planta
const legacyBounds = b => getBlockBounds(b.tipo_figura === 'trapezoide' ? { ...b, rot_y: (b.rot_y || 0) - Math.PI / 2 } : b)

test('migración v1: apoya el pozo en y=0 sin cambiar el volumen ni la forma', () => {
  const db = baseLegacy()
  const antes = bloques(db, 1)
  const volAntes = buildCompositePozo(antes.map(b => b.tipo_figura === 'trapezoide' ? { ...b, rot_y: -Math.PI / 2 } : b)).volume

  assert.equal(migrateDatabase(db), true)
  assert.equal(getSchemaVersion(db), SCHEMA_VERSION)

  const despues = bloques(db, 1)
  const [caja, trap, col] = despues
  assert.ok(Math.abs(caja.pos_y) < 1e-9, `caja pos_y = ${caja.pos_y}`)
  assert.ok(Math.abs(trap.pos_y) < 1e-9, `trapecio pos_y = ${trap.pos_y}`)
  assert.ok(Math.abs(col.pos_y - 0.1) < 1e-9, `columna pos_y = ${col.pos_y}`)

  // El trapecio ocupa el mismo lugar que antes (salvo el descenso del pozo)
  const viejo = legacyBounds(antes[1]); const nuevo = getBlockBounds(trap)
  for (const eje of ['x', 'z']) {
    assert.ok(Math.abs(viejo.min[eje] - nuevo.min[eje]) < 1e-6 && Math.abs(viejo.max[eje] - nuevo.max[eje]) < 1e-6, `eje ${eje}`)
  }

  const volDespues = buildCompositePozo(despues).volume
  assert.ok(Math.abs(volDespues - volAntes) < 1e-6, `${volAntes} → ${volDespues}`)
})

test('migración v1: no toca un pozo que ya apoya en el piso', () => {
  const db = baseLegacy()
  migrateDatabase(db)
  assert.equal(bloques(db, 2)[0].pos_y, 0)
})

test('migración: es idempotente', () => {
  const db = baseLegacy()
  migrateDatabase(db)
  const una = JSON.stringify(bloques(db, 1))
  assert.equal(migrateDatabase(db), false)
  assert.equal(JSON.stringify(bloques(db, 1)), una)
})

test('migración: rechaza una base de una versión más nueva', () => {
  const db = baseLegacy()
  db.run(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
  assert.throws(() => migrateDatabase(db), /más nueva/)
})

test('validación: rechaza un archivo que no es SQLite', () => {
  const garbage = new TextEncoder().encode('esto no es una base de datos'.repeat(40))
  assert.throws(() => migrateDatabase(new SQL.Database(garbage)), /no es una base de datos SQLite válida/)
})

test('validación: rechaza una base SQLite de otra aplicación', () => {
  const db = new SQL.Database()
  db.run('CREATE TABLE clientes (id INTEGER, nombre TEXT)')
  assert.throws(() => migrateDatabase(db), /falta la tabla "buques"/)
})

test('validación: rechaza una tabla incompleta', () => {
  const db = new SQL.Database()
  db.run(`CREATE TABLE buques (id INTEGER, nombre TEXT);
    CREATE TABLE pozos (id INTEGER, buque_id INTEGER, nombre TEXT, densidad_estiba REAL);
    CREATE TABLE bloques (id INTEGER, pozo_id INTEGER, nombre TEXT)`)
  assert.throws(() => migrateDatabase(db), /"bloques" le faltan columnas/)
})

test('esquema: las claves foráneas borran en cascada cuando están activas', () => {
  const db = baseLegacy()
  db.run('PRAGMA foreign_keys = ON')
  db.run('DELETE FROM pozos WHERE id = 2')
  assert.equal(db.exec('SELECT COUNT(*) FROM bloques WHERE pozo_id = 2')[0].values[0][0], 0)
  assert.throws(() => db.run(`INSERT INTO bloques (${COLS}) VALUES (99, 999, 1, 'x', 'caja', 'UNION', 1,1,1,0,0,0,0,0,0,0,0,0,0,1)`), /FOREIGN KEY/)
})

test('sql.js: exportar la base no desactiva las claves foráneas', () => {
  // La app guarda con export() muchas veces; si una versión nueva de sql.js
  // reabriera la conexión sin el PRAGMA, las claves foráneas dejarían de aplicarse
  const db = baseLegacy()
  db.run('PRAGMA foreign_keys = ON')
  db.export()
  assert.equal(db.exec('PRAGMA foreign_keys')[0].values[0][0], 1)
})
