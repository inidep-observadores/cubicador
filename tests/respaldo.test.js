import { test } from 'node:test'
import assert from 'node:assert/strict'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { sqlJsCompat, openFromBytes } from '../src/services/sqliteCompat.js'
import { initTables, seedInitialData } from '../src/services/schema.js'
import { getSchemaVersion, setSchemaVersion, SCHEMA_VERSION } from '../src/services/migrations.js'
import { prepararRespaldo, firmar, nombreRespaldo, FIRMA } from '../src/services/respaldo.js'

const sqlite3 = await sqlite3InitModule()
const nueva = () => sqlJsCompat(sqlite3, new sqlite3.oo1.DB(':memory:'))
const abrir = (bytes) => sqlJsCompat(sqlite3, openFromBytes(sqlite3, bytes))
const valor = (db, sql) => db.exec(sql)[0].values[0][0]

// Qué hay que quitarle al esquema actual para dejarlo como antes de cada versión.
// Al agregar una migración, sumar acá su paso inverso
const DESHACER = {
  5: ['DROP TABLE cotas'],
  4: ['ALTER TABLE bloques DROP COLUMN desvio_largo', 'ALTER TABLE bloques DROP COLUMN desvio_ancho'],
  3: ['ALTER TABLE bloques DROP COLUMN fijada'],
  2: ['ALTER TABLE buques DROP COLUMN densidad_estiba'],
  1: [] // la versión 1 solo cambió datos
}

function respaldoDeVersion(version, { firmado = true } = {}) {
  const db = nueva()
  initTables(db)
  seedInitialData(db)
  for (let v = SCHEMA_VERSION; v > version; v--) DESHACER[v].forEach(sql => db.run(sql))
  setSchemaVersion(db, version)
  if (firmado) firmar(db)
  const bytes = db.export()
  db.close()
  return bytes
}

const columnas = (db) => Object.fromEntries(['buques', 'pozos', 'bloques', 'cotas'].map(tabla =>
  [tabla, db.exec(`PRAGMA table_info(${tabla})`)[0].values.map(r => r[1]).sort()]))

test('respaldo: hay un paso inverso por cada versión del esquema', () => {
  assert.deepEqual(Object.keys(DESHACER).map(Number), Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1))
})

for (let version = 0; version <= SCHEMA_VERSION; version++) {
  test(`respaldo: se restaura desde la versión ${version} del esquema`, async () => {
    const avisos = []
    const { bytes, migrated } = await prepararRespaldo(sqlite3, respaldoDeVersion(version), {
      exigirFirma: true,
      antesDeMigrar: v => avisos.push(v)
    })
    const db = abrir(bytes)
    const actual = nueva()
    initTables(actual)

    assert.equal(migrated, version < SCHEMA_VERSION)
    assert.deepEqual(avisos, version < SCHEMA_VERSION ? [version] : [])
    assert.equal(getSchemaVersion(db), SCHEMA_VERSION)
    assert.deepEqual(columnas(db), columnas(actual))
    assert.equal(valor(db, 'SELECT nombre FROM buques'), 'Imaginario I')
    assert.equal(valor(db, 'SELECT count(*) FROM bloques'), 1)
  })
}

test('respaldo: la firma viaja en el archivo exportado', async () => {
  const { bytes } = await prepararRespaldo(sqlite3, respaldoDeVersion(SCHEMA_VERSION, { firmado: false }))
  assert.equal(valor(abrir(bytes), 'PRAGMA application_id'), FIRMA)
})

test('respaldo: un archivo sin la firma se rechaza', async () => {
  const bytes = respaldoDeVersion(SCHEMA_VERSION, { firmado: false })
  await assert.rejects(prepararRespaldo(sqlite3, bytes, { exigirFirma: true }), /no es un respaldo/)
})

test('respaldo: rechaza archivos que no son bases de datos', async () => {
  for (const bytes of [new TextEncoder().encode('esto no es una base'.repeat(100)), new Uint8Array(0)]) {
    await assert.rejects(prepararRespaldo(sqlite3, bytes, { exigirFirma: true }), /no es un respaldo/)
  }
})

test('respaldo: rechaza un archivo cortado', async () => {
  const bytes = respaldoDeVersion(SCHEMA_VERSION)
  await assert.rejects(
    prepararRespaldo(sqlite3, bytes.slice(0, Math.floor(bytes.length / 2)), { exigirFirma: true }),
    /dañado o incompleto/)
})

test('respaldo: rechaza uno hecho con una versión más nueva', async () => {
  const db = abrir(respaldoDeVersion(SCHEMA_VERSION))
  setSchemaVersion(db, SCHEMA_VERSION + 1)
  await assert.rejects(prepararRespaldo(sqlite3, db.export(), { exigirFirma: true }), /versión más nueva/)
})

test('respaldo: el nombre lleva la fecha y la extensión propia', () => {
  assert.equal(nombreRespaldo(new Date('2026-11-27T12:00:00Z')), 'respaldo_pozos_2026-11-27.cubi')
})
