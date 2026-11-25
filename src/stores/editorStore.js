import { defineStore } from 'pinia'
import {
  getDatabase, persistDatabase, setWritesEnabled, exportDatabaseFile,
  exportDatabaseBytes, replaceDatabase, importDatabaseFile
} from '../services/db'
import {
  requestPersistentStorage, acquireTabLock, ensureDailyBackup, listBackupsInfo,
  getBackupData, getLastExport
} from '../services/storageSafety'
import { GEOMETRY_TYPES, calculateAnalyticalTotal } from '../services/geometryCatalog'
import { computeComposite, compositeKey } from '../services/csgClient'

const HISTORY_LIMIT = 50
// Las ediciones continuas se agrupan en un solo paso al quedar quietas este tiempo
const HISTORY_DEBOUNCE_MS = 600

export const useEditorStore = defineStore('editor', {
  state: () => ({
    isLoading: true,
    loadError: null,
    db: null,

    // Protecciones del almacenamiento
    storagePersisted: null, // true/false; null = el navegador no informa
    tabStatus: 'ok', // 'ok' | 'ocupada' (otra pestaña la tiene) | 'desplazada' (otra la tomó)
    backups: [], // copias automáticas dentro del navegador (sin el binario)
    lastExportAt: null, // última exportación a archivo .sqlite (ms)

    // Buque y Pozo actual
    buques: [],
    selectedBuqueId: null,
    pozos: [],
    selectedPozoId: null,

    // Bloques del pozo actual
    bloques: [],
    selectedBlockId: null,

    // Configuración de visualización 3D
    viewMode: 'solido', // 'solido' | 'rayosX' | 'alambrico'
    modelMode: 'edicion', // 'edicion' (bloques individuales) | 'solidoFinal' (malla combinada CSG)
    // Volumen del sólido booleano. null = no hay un cálculo 3D confiable (ver csgError)
    volumenMallaCSG: null,
    csgError: null,
    csgPending: false, // hay un cálculo 3D en curso
    showDimensions: true,
    showGrid: true,
    snapToGrid: true,
    gridStep: 0.25, // metros
    transformMode: 'translate', // 'translate' | 'rotate'

    // Historial para Undo / Redo
    history: [],
    historyIndex: -1,
    historyPending: false, // hay una edición continua todavía sin registrar

    // Modo modal / diálogos
    isProjectModalOpen: false,
    isExportModalOpen: false,
    isReportModalOpen: false
  }),

  getters: {
    selectedBuque(state) {
      return state.buques.find(b => b.id === state.selectedBuqueId) || null
    },
    selectedPozo(state) {
      return state.pozos.find(p => p.id === state.selectedPozoId) || null
    },
    selectedBlock(state) {
      return state.bloques.find(b => b.id === state.selectedBlockId) || null
    },
    volumenNominal(state) {
      return calculateAnalyticalTotal(state.bloques)
    },
    // true cuando el volumen informado sale del sólido 3D (intersecciones reales)
    volumenEsReal(state) {
      return state.volumenMallaCSG !== null
    },
    volumenTotal(state) {
      // Prioridad: volumen real calculado por CSG (puede ser 0 de forma legítima).
      // Si el cálculo 3D no es confiable, se informa la suma nominal y la UI lo advierte.
      if (state.volumenMallaCSG !== null) {
        return state.volumenMallaCSG
      }
      return calculateAnalyticalTotal(state.bloques)
    },
    capturaEstimadaKg(state) {
      const densidad = state.selectedPozo ? (state.selectedPozo.densidad_estiba || 800) : 800
      return this.volumenTotal * densidad
    },
    capturaEstimadaToneladas() {
      return this.capturaEstimadaKg / 1000
    },
    canUndo(state) {
      return state.historyIndex > 0 || state.historyPending
    },
    canRedo(state) {
      return state.historyIndex < state.history.length - 1
    }
  },

  actions: {
    async init() {
      this.isLoading = true
      try {
        this.storagePersisted = await requestPersistentStorage()
        const lock = await acquireTabLock({ onLost: () => this.onTabLockLost() })
        if (lock === 'ocupada') {
          this.tabStatus = 'ocupada'
          return
        }
        await this.openDatabase()
      } catch (err) {
        console.error('Error al inicializar base de datos SQLite:', err)
        this.loadError = err.message || String(err)
      } finally {
        this.isLoading = false
      }
    },

    async openDatabase() {
      this.tabStatus = 'ok'
      setWritesEnabled(true)
      this.db = await getDatabase()
      await this.reloadFromDb()
      try {
        await ensureDailyBackup(exportDatabaseBytes())
      } catch (err) {
        console.warn('No se pudo guardar la copia diaria:', err)
      }
      await this.refreshBackupInfo()
    },

    async reloadFromDb() {
      this.selectedBlockId = null
      await this.loadBuques()
      if (this.buques.length > 0) {
        await this.selectBuque(this.buques[0].id)
      } else {
        this.selectedBuqueId = null
        this.pozos = []
        this.selectedPozoId = null
        this.bloques = []
      }
    },

    async refreshBackupInfo() {
      this.backups = await listBackupsInfo()
      this.lastExportAt = await getLastExport()
    },

    // --- Pestaña única ---

    /** Toma el control de la base desde esta pestaña (la otra queda bloqueada). */
    async useInThisTab() {
      this.isLoading = true
      try {
        await acquireTabLock({ steal: true, onLost: () => this.onTabLockLost() })
        await this.openDatabase()
      } catch (err) {
        this.loadError = err.message || String(err)
      } finally {
        this.isLoading = false
      }
    },

    /** Otra pestaña tomó el control: esta deja de escribir para no pisar sus datos. */
    onTabLockLost() {
      clearTimeout(this._debounceTimer)
      clearTimeout(this._debounceVolTimer)
      this._debounceTimer = null
      this._debounceVolTimer = null
      setWritesEnabled(false)
      this.tabStatus = 'desplazada'
    },

    /**
     * Si hay una edición esperando para guardarse, la guarda ya en el pozo actual.
     * Se llama antes de cambiar de pozo: si no, el guardado diferido se haría
     * sobre el pozo nuevo y la edición del anterior se perdería.
     */
    savePendingEditsNow() {
      if (this._debounceTimer) this.flushPendingSave()
    },

    /** Guarda ya lo pendiente (al cerrar u ocultar la pestaña). */
    flushPendingSave() {
      if (this.tabStatus !== 'ok') return
      clearTimeout(this._debounceVolTimer)
      this._debounceVolTimer = null
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer)
        this._debounceTimer = null
        this.updateVolumenReal()
        this.saveBloquesToDb()
      } else {
        persistDatabase()
      }
    },

    // --- Copias y respaldos ---

    async exportDatabase() {
      this.flushPendingSave()
      this.lastExportAt = await exportDatabaseFile()
    },

    /** Reemplaza la base por un archivo .sqlite exportado antes (con copia previa). */
    async importDatabase(file) {
      if (!file) return
      const ok = confirm(
        `¿Importar "${file.name}"?\n\n` +
        'Reemplazará todos los buques, pozos y piezas actuales. ' +
        'La base actual se guardará como copia antes de reemplazarla.'
      )
      if (!ok) return
      this.isLoading = true
      try {
        this.flushPendingSave()
        this.db = await importDatabaseFile(file)
        await this.reloadFromDb()
        await this.refreshBackupInfo()
      } catch (err) {
        alert(`No se pudo importar el archivo.\n\n${err.message || err}\n\nLa base actual no se modificó.`)
      } finally {
        this.isLoading = false
      }
    },

    async restoreBackup(id) {
      const copia = this.backups.find(c => c.id === id)
      if (!copia) return
      const fecha = new Date(copia.fecha).toLocaleString('es-AR')
      if (!confirm(`¿Restaurar la copia del ${fecha}?\n\nLa base actual se guardará como copia antes de reemplazarla.`)) return
      this.isLoading = true
      try {
        this.flushPendingSave()
        const data = await getBackupData(id)
        if (!data) throw new Error('La copia ya no existe.')
        this.db = await replaceDatabase(data, 'Antes de restaurar una copia')
        await this.reloadFromDb()
        await this.refreshBackupInfo()
      } catch (err) {
        alert(`No se pudo restaurar la copia: ${err.message || err}`)
      } finally {
        this.isLoading = false
      }
    },

    async loadBuques() {
      if (!this.db) return
      const res = this.db.exec("SELECT * FROM buques ORDER BY id ASC")
      if (res.length > 0) {
        const cols = res[0].columns
        this.buques = res[0].values.map(row => {
          const item = {}
          cols.forEach((col, i) => item[col] = row[i])
          return item
        })
      } else {
        this.buques = []
      }
    },

    async selectBuque(buqueId) {
      this.savePendingEditsNow()
      this.selectedBuqueId = buqueId
      await this.loadPozos(buqueId)
      if (this.pozos.length > 0) {
        await this.selectPozo(this.pozos[0].id)
      } else {
        this.selectedPozoId = null
        this.bloques = []
      }
    },

    async loadPozos(buqueId) {
      if (!this.db) return
      const stmt = this.db.prepare("SELECT * FROM pozos WHERE buque_id = ? ORDER BY id ASC")
      stmt.bind([buqueId])
      const list = []
      while (stmt.step()) {
        list.push(stmt.getAsObject())
      }
      stmt.free()
      this.pozos = list
    },

    async selectPozo(pozoId) {
      this.savePendingEditsNow()
      this.selectedPozoId = pozoId
      await this.loadBloques(pozoId)
      this.resetHistory()
    },

    async loadBloques(pozoId) {
      if (!this.db) return
      const stmt = this.db.prepare("SELECT * FROM bloques WHERE pozo_id = ? ORDER BY orden ASC")
      stmt.bind([pozoId])
      const list = []
      while (stmt.step()) {
        const b = stmt.getAsObject()
        // Asegurar tipos numéricos
        b.largo = Number(b.largo) || 1
        b.ancho = Number(b.ancho) || 1
        b.alto = Number(b.alto) || 1
        b.base_a = Number(b.base_a) || 0
        b.base_b = Number(b.base_b) || 0
        b.diametro_d = Number(b.diametro_d) || 0
        b.diametro_d_menor = Number(b.diametro_d_menor) || 0
        b.pos_x = Number(b.pos_x) || 0
        b.pos_y = Number(b.pos_y) || 0
        b.pos_z = Number(b.pos_z) || 0
        b.rot_x = Number(b.rot_x) || 0
        b.rot_y = Number(b.rot_y) || 0
        b.rot_z = Number(b.rot_z) || 0
        // Recalcular siempre: el valor guardado puede venir de una fórmula anterior
        const def = GEOMETRY_TYPES[b.tipo_figura]
        b.volumen_individual = def ? def.calculateVolume(b) : (Number(b.volumen_individual) || 0)
        list.push(b)
      }
      stmt.free()
      this.bloques = list
      // Al cambiar de pozo, la selección anterior pertenece a otro pozo
      this.ensureValidSelection()
      // El volumen del pozo anterior no vale para este: queda "calculando"
      this.volumenMallaCSG = null
      this.csgError = null
      this.updateVolumenReal()
    },

    addBlockFromPalette(tipoFigura, operacion = 'UNION') {
      const def = GEOMETRY_TYPES[tipoFigura]
      if (!def || !this.selectedPozoId) return

      const defaults = {}
      def.params.forEach(p => {
        defaults[p.key] = p.default
      })

      // Posicionar convenientemente
      const nuevoBloque = {
        id: this.nextBlockId(),
        pozo_id: this.selectedPozoId,
        orden: this.bloques.length + 1,
        nombre: `${def.nombre.split(' ')[0]} ${this.bloques.length + 1}`,
        tipo_figura: tipoFigura,
        operacion: operacion,
        largo: defaults.largo || 4.0,
        ancho: defaults.ancho || 3.0,
        alto: defaults.alto || 2.5,
        base_a: defaults.base_a || 4.0,
        base_b: defaults.base_b || 2.0,
        diametro_d: defaults.diametro_d || 1.5,
        diametro_d_menor: defaults.diametro_d_menor || 1.0,
        pos_x: (this.bloques.length * 1.5) % 6,
        pos_y: 0, // las geometrías apoyan su base en y=0
        pos_z: 0,
        rot_x: 0,
        rot_y: 0,
        rot_z: 0,
        volumen_individual: 0
      }

      nuevoBloque.volumen_individual = def.calculateVolume(nuevoBloque)
      this.bloques.push(nuevoBloque)
      this.selectedBlockId = nuevoBloque.id
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    updateBlockProperty(blockId, property, value) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b) return
      // Nunca guardar NaN/Infinity: dejarían la pieza con volumen inválido
      if (typeof value === 'number' && !Number.isFinite(value)) return
      if (b[property] === value) return
      b[property] = value
      const def = GEOMETRY_TYPES[b.tipo_figura]
      if (def) {
        b.volumen_individual = def.calculateVolume(b)
      }
      this.saveBloquesToDbDebounced()
      this.pushHistoryStateDebounced()
    },

    deleteBlock(blockId) {
      const idx = this.bloques.findIndex(b => b.id === blockId)
      if (idx === -1) return
      this.bloques.splice(idx, 1)
      if (this.selectedBlockId === blockId) {
        this.selectedBlockId = this.bloques.length > 0 ? this.bloques[0].id : null
      }
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    duplicateBlock(blockId) {
      const original = this.bloques.find(b => b.id === blockId)
      if (!original) return
      const clon = JSON.parse(JSON.stringify(original))
      clon.id = this.nextBlockId()
      clon.nombre = `${original.nombre} (Copia)`
      clon.orden = this.bloques.length + 1
      clon.pos_x += 1.0
      this.bloques.push(clon)
      this.selectedBlockId = clon.id
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    toggleBlockOperation(blockId) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b) return
      b.operacion = b.operacion === 'UNION' ? 'SUBSTRACCION' : 'UNION'
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    clearCurrentPozo() {
      if (!confirm('¿Deseas reiniciar este pozo con una figura base limpia?')) return
      this.bloques = []
      this.selectedBlockId = null
      // addBlockFromPalette ya registra el historial y guarda
      this.addBlockFromPalette('caja', 'UNION')
    },

    async createNewPozo() {
      const nombre = prompt('Nombre del nuevo pozo (ej: Pozo N° 2 Estribor):', `Pozo N° ${this.pozos.length + 1}`)
      if (!nombre || !nombre.trim()) return

      if (!this.db || !this.selectedBuqueId) return
      this.db.run(
        "INSERT INTO pozos (buque_id, nombre, volumen_total, densidad_estiba, notas) VALUES (?, ?, 0, 800, '')",
        [this.selectedBuqueId, nombre.trim()]
      )
      await persistDatabase()
      await this.loadPozos(this.selectedBuqueId)
      const nuevo = this.pozos[this.pozos.length - 1]
      if (nuevo) {
        await this.selectPozo(nuevo.id)
        this.addBlockFromPalette('caja', 'UNION')
        // El pozo nace con su caja base: que deshacer no lo deje vacío
        this.resetHistory()
      }
    },

    /**
     * Pide el volumen del sólido 3D. El cálculo corre en segundo plano; mientras
     * tanto `csgPending` es true. Si llega un pedido más nuevo (otra edición u
     * otro pozo), el resultado viejo se descarta.
     */
    async updateVolumenReal() {
      const pozoId = this.selectedPozoId
      const key = compositeKey(this.bloques)
      this._csgKey = key
      this.csgPending = true

      let res
      try {
        res = await computeComposite(this.bloques)
      } catch (err) {
        res = { volume: 0, error: err.message || String(err) }
      }
      if (res.superseded || this._csgKey !== key || this.selectedPozoId !== pozoId) return
      this.csgPending = false

      if (res.error) {
        // Nunca dejar el valor del cálculo anterior (podría ser de otro pozo)
        this.volumenMallaCSG = null
        this.csgError = res.error
        console.warn('Volumen 3D no confiable:', res.error)
      } else {
        this.volumenMallaCSG = res.volume
        this.csgError = null
      }

      if (this.db && pozoId) {
        this.db.run("UPDATE pozos SET volumen_total = ? WHERE id = ?", [this.volumenTotal, pozoId])
      }
    },

    updateVolumenRealDebounced() {
      if (this._debounceVolTimer) clearTimeout(this._debounceVolTimer)
      this._debounceVolTimer = setTimeout(() => {
        this.updateVolumenReal()
      }, 150)
    },

    async saveBloquesToDb() {
      if (!this.db || !this.selectedPozoId) return
      // Todo cambio de piezas pasa por acá (agregar, borrar, duplicar, cambiar rol…):
      // recalcular el volumen real. Si las piezas no cambiaron, sale de la caché.
      this.updateVolumenReal()
      try {
        // Eliminar y reinsertar bloques del pozo actual
        this.db.run("DELETE FROM bloques WHERE pozo_id = ?", [this.selectedPozoId])
        const insertStmt = this.db.prepare(`
          INSERT INTO bloques (id, pozo_id, orden, nombre, tipo_figura, operacion,
                               largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor,
                               pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        this.bloques.forEach((b, idx) => {
          insertStmt.run([
            b.id,
            this.selectedPozoId,
            idx + 1,
            b.nombre,
            b.tipo_figura,
            b.operacion,
            b.largo || 0,
            b.ancho || 0,
            b.alto || 0,
            b.base_a || 0,
            b.base_b || 0,
            b.diametro_d || 0,
            b.diametro_d_menor || 0,
            b.pos_x || 0,
            b.pos_y || 0,
            b.pos_z || 0,
            b.rot_x || 0,
            b.rot_y || 0,
            b.rot_z || 0,
            b.volumen_individual || 0
          ])
        })
        insertStmt.free()

        // Actualizar volumen total en la tabla pozos
        this.db.run("UPDATE pozos SET volumen_total = ? WHERE id = ?", [this.volumenTotal, this.selectedPozoId])

        await persistDatabase()
      } catch (e) {
        console.error('Error al persistir bloques en SQLite:', e)
      }
    },

    saveBloquesToDbDebounced() {
      this.updateVolumenRealDebounced()
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null
        this.saveBloquesToDb()
      }, 300)
    },

    // --- Historial (Deshacer / Rehacer) ---
    // Cada entrada es una foto de los bloques. Las acciones puntuales (agregar,
    // borrar, cambiar rol…) la registran enseguida; las ediciones continuas
    // (escribir una medida, arrastrar) se agrupan y se registran al quedar quietas.

    resetHistory() {
      clearTimeout(this._historyTimer)
      this._historyTimer = null
      this.historyPending = false
      this.history = [JSON.stringify(this.bloques)]
      this.historyIndex = 0
    },

    pushHistoryState() {
      clearTimeout(this._historyTimer)
      this._historyTimer = null
      this.historyPending = false

      const snapshot = JSON.stringify(this.bloques)
      // Sin cambios respecto de la entrada actual: no duplicar
      if (snapshot === this.history[this.historyIndex]) return

      // Si estamos en un punto anterior, descartar los futuros
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }
      this.history.push(snapshot)
      this.historyIndex++
      if (this.history.length > HISTORY_LIMIT) {
        this.history.shift()
        this.historyIndex--
      }
    },

    /** Registra en el historial una edición continua cuando deja de cambiar. */
    pushHistoryStateDebounced() {
      clearTimeout(this._historyTimer)
      this.historyPending = true
      this._historyTimer = setTimeout(() => this.pushHistoryState(), HISTORY_DEBOUNCE_MS)
    },

    /** Si quedó una edición sin registrar, la registra ya (antes de deshacer). */
    flushPendingHistory() {
      if (this._historyTimer || this.historyPending) this.pushHistoryState()
    },

    applyHistoryEntry() {
      this.bloques = JSON.parse(this.history[this.historyIndex])
      this.ensureValidSelection()
      this.updateVolumenReal()
      this.saveBloquesToDb()
    },

    undo() {
      this.flushPendingHistory()
      if (this.historyIndex <= 0) return
      this.historyIndex--
      this.applyHistoryEntry()
    },

    redo() {
      this.flushPendingHistory()
      if (!this.canRedo) return
      this.historyIndex++
      this.applyHistoryEntry()
    },

    /** Mantiene la selección en una pieza que exista en el pozo actual. */
    ensureValidSelection() {
      if (!this.bloques.some(b => b.id === this.selectedBlockId)) {
        this.selectedBlockId = this.bloques.length > 0 ? this.bloques[0].id : null
      }
    },

    /**
     * Identificador nuevo para una pieza. Los ids son únicos en toda la tabla
     * (no por pozo), así que se toma el mayor entre la base y la memoria.
     */
    nextBlockId() {
      let max = 0
      if (this.db) {
        const res = this.db.exec('SELECT COALESCE(MAX(id), 0) FROM bloques')
        max = Number(res[0]?.values[0][0]) || 0
      }
      for (const b of this.bloques) max = Math.max(max, Number(b.id) || 0)
      return max + 1
    }
  }
})
