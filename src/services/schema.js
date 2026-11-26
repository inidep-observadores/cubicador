/**
 * Esquema de la base y datos de ejemplo. Módulo puro (sin dependencias del
 * navegador) para poder usarlo también desde las pruebas.
 */

export function initTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS buques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      matricula TEXT, -- opcional, sin uso en la interfaz
      armador TEXT,   -- opcional, sin uso en la interfaz
      densidad_estiba REAL DEFAULT 800.0, -- factor de captura del buque (kg/m³)
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
      fijada INTEGER DEFAULT 0, -- 1: no se puede mover ni cambiar sus medidas
      FOREIGN KEY (pozo_id) REFERENCES pozos (id) ON DELETE CASCADE
    );
  `)
}

export function seedInitialData(db) {
  db.run(`
    INSERT INTO buques (id, nombre, densidad_estiba)
    VALUES (1, 'Imaginario I', 850.0);

    INSERT INTO pozos (id, buque_id, nombre, volumen_total, notas)
    VALUES (1, 1, 'Pozo 1 (Popa)', 90.0, '');

    -- Pozo de ejemplo: solo el cuerpo principal
    INSERT INTO bloques (id, pozo_id, orden, nombre, tipo_figura, operacion, largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual)
    VALUES (1, 1, 1, 'Cuerpo Principal Pozo', 'caja', 'UNION', 6.0, 5.0, 3.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90.0);
  `)
}
