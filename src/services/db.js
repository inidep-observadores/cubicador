import { get, set } from 'idb-keyval'
import { migrateDatabase, setSchemaVersion } from './migrations.js'

const DB_STORAGE_KEY = 'cubicacion_pozos_sqlite_db'
let dbInstance = null

export async function getDatabase() {
  if (dbInstance) return dbInstance

  // Obtener initSqlJs cargado en window por /sql-wasm.js
  const initSqlJs = window.initSqlJs
  if (!initSqlJs) {
    throw new Error('No se pudo encontrar el motor SQLite (initSqlJs no está disponible).')
  }

  const SQL = await initSqlJs({
    locateFile: file => `/${file}`
  })

  const savedDbData = await get(DB_STORAGE_KEY)
  if (savedDbData) {
    dbInstance = new SQL.Database(new Uint8Array(savedDbData))
    if (migrateDatabase(dbInstance)) await persistDatabase()
  } else {
    dbInstance = new SQL.Database()
    initTables(dbInstance)
    seedInitialData(dbInstance)
    setSchemaVersion(dbInstance)
    await persistDatabase()
  }

  return dbInstance
}

export function initTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS buques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      matricula TEXT,
      armador TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pozos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buque_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      volumen_total REAL DEFAULT 0.0,
      densidad_estiba REAL DEFAULT 800.0, -- kg/m³
      notas TEXT,
      FOREIGN KEY (buque_id) REFERENCES buques (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bloques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pozo_id INTEGER NOT NULL,
      orden INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      tipo_figura TEXT NOT NULL, -- 'caja', 'cuna_regular', 'cuna_irregular', 'trapezoide', 'cilindro', 'tronco_cono', 'piramidal'
      operacion TEXT NOT NULL,    -- 'UNION' o 'SUBSTRACCION'
      
      -- Dimensiones paramétricas (metros)
      largo REAL DEFAULT 5.0,
      ancho REAL DEFAULT 4.0,
      alto REAL DEFAULT 3.0,
      base_a REAL DEFAULT 4.0,
      base_b REAL DEFAULT 2.0,
      diametro_d REAL DEFAULT 2.0,
      diametro_d_menor REAL DEFAULT 1.0,

      -- Transformaciones 3D
      pos_x REAL DEFAULT 0,
      pos_y REAL DEFAULT 0,
      pos_z REAL DEFAULT 0,
      rot_x REAL DEFAULT 0,
      rot_y REAL DEFAULT 0,
      rot_z REAL DEFAULT 0,

      volumen_individual REAL DEFAULT 0.0,
      FOREIGN KEY (pozo_id) REFERENCES pozos (id) ON DELETE CASCADE
    );
  `)
}

function seedInitialData(db) {
  db.run(`
    INSERT INTO buques (id, nombre, matricula, armador) 
    VALUES (1, 'B/P Atlántico Austral', '01842-M', 'Pesquera del Sur S.A.');

    INSERT INTO pozos (id, buque_id, nombre, volumen_total, densidad_estiba, notas)
    VALUES (1, 1, 'Pozo N° 1 (Proa Babor)', 84.5, 850.0, 'Pozo principal con rampa de descarga y columna de refrigeración');

    -- 1. Prisma principal (Caja)
    INSERT INTO bloques (id, pozo_id, orden, nombre, tipo_figura, operacion, largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual)
    VALUES (1, 1, 1, 'Cuerpo Principal Pozo', 'caja', 'UNION', 6.0, 5.0, 3.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90.0);

    -- 2. Rampa de proa (Cuña irregular típica de pozo)
    INSERT INTO bloques (id, pozo_id, orden, nombre, tipo_figura, operacion, largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual)
    VALUES (2, 1, 2, 'Rampa de Fondo Pozo', 'cuna_irregular', 'UNION', 4.0, 5.0, 1.5, 5.0, 3.0, 0, 0, 5.0, 0, 0, 0, 0, 0, 11.0);

    -- 3. Columna estructural a restar (Sustracción)
    INSERT INTO bloques (id, pozo_id, orden, nombre, tipo_figura, operacion, largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual)
    VALUES (3, 1, 3, 'Columna / Tubería de Paso', 'caja', 'SUBSTRACCION', 0.8, 0.8, 3.2, 0, 0, 0, 0, 1.5, 0, 1.5, 0, 0, 0, 2.05);
  `)
}

export async function persistDatabase() {
  if (!dbInstance) return
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
  URL.revokeObjectURL(url)
}

export async function importDatabaseFile(file) {
  const buffer = await file.arrayBuffer()
  const initSqlJs = window.initSqlJs
  const SQL = await initSqlJs({ locateFile: file => `/${file}` })
  const imported = new SQL.Database(new Uint8Array(buffer))
  migrateDatabase(imported) // valida la versión antes de reemplazar la base actual
  dbInstance = imported
  await persistDatabase()
  return dbInstance
}
