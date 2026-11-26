/**
 * Adaptador: expone una base `oo1.DB` de @sqlite.org/sqlite-wasm con la API
 * mínima de sql.js que usan schema.js y migrations.js (exec, run, prepare).
 * Así el esquema y las migraciones funcionan igual en el worker de la app y en
 * las pruebas, sin depender del motor.
 */
export function sqlJsCompat(sqlite3, db) {
  return {
    /** Como sql.js: [{ columns, values }] por resultado, o [] si no hay filas. */
    exec(sql) {
      const columnNames = []
      const values = db.exec({ sql, rowMode: 'array', returnValue: 'resultRows', columnNames })
      return values.length ? [{ columns: columnNames, values }] : []
    },

    run(sql, params) {
      if (params && params.length) db.exec({ sql, bind: params })
      else db.exec(sql)
      return this
    },

    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        bind(params) {
          stmt.bind(params)
          return true
        },
        step() {
          return stmt.step()
        },
        getAsObject() {
          return stmt.get({})
        },
        run(params) {
          if (params) stmt.bind(params)
          stmt.step()
          stmt.reset(true)
        },
        free() {
          stmt.finalize()
        }
      }
    },

    export() {
      return sqlite3.capi.sqlite3_js_db_export(db.pointer)
    },

    close() {
      db.close()
    }
  }
}

/**
 * Abre en memoria una base a partir de sus bytes (archivo SQLite completo).
 */
export function openFromBytes(sqlite3, bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const db = new sqlite3.oo1.DB(':memory:')
  const { capi, wasm } = sqlite3
  const ptr = wasm.allocFromTypedArray(data)
  const rc = capi.sqlite3_deserialize(
    db.pointer, 'main', ptr, data.byteLength, data.byteLength,
    capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE
  )
  if (rc) {
    db.close()
    throw new Error('El archivo no es una base de datos SQLite válida.')
  }
  return db
}
