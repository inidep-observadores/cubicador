import { defineStore } from 'pinia'
import {
  openDatabase, closeDatabase, query, run, batch, exportDatabaseFile,
  exportDatabaseBytes, replaceDatabase, importDatabaseFile
} from '../services/db'
import {
  requestPersistentStorage, acquireTabLock, ensureDailyBackup, listBackupsInfo,
  getBackupData, getLastExport, saveBackup
} from '../services/storageSafety'
import { confirmDialog, alertDialog } from '../services/dialog'
import { GEOMETRY_TYPES, calculateAnalyticalTotal } from '../services/geometryCatalog'
import { computeComposite, compositeKey } from '../services/csgClient'
import { mirrorBlock as espejarPieza } from '../services/mirror'

// Factor de captura inicial de un buque nuevo (kg/m³)
export const DENSIDAD_POR_DEFECTO = 800

// Reintentos para tomar el candado de pestaña al arrancar (~2 s en total)
const LOCK_RETRIES = 8
const LOCK_RETRY_MS = 250

const HISTORY_LIMIT = 50
// Las ediciones continuas se agrupan en un solo paso al quedar quietas este tiempo
const HISTORY_DEBOUNCE_MS = 600

export const useEditorStore = defineStore('editor', {
  state: () => ({
    isLoading: true,
    loadError: null,
    dbReady: false, // la base está abierta en esta pestaña
    storageBackend: null, // 'opfs' (archivo SQLite) | 'memoria' (copia en IndexedDB)

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
    // Piezas ocultas en el visor. Es solo de visualización: no se guarda en la
    // base ni en el historial, y no cambia el volumen
    hiddenBlockIds: [],

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

    // Formulario de buque o pozo abierto: { tipo: 'buque'|'pozo', id: number|null }
    recordForm: null
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
    // true cuando el volumen informado sale del sólido 3D (intersecciones reales)
    volumenEsReal(state) {
      return state.volumenMallaCSG !== null
    },
    volumenTotal(state) {
      // Prioridad: volumen real calculado por CSG (puede ser 0 de forma legítima).
      // Si el cálculo 3D no es confiable, se informa el valor por fórmulas y la UI avisa que es aproximado.
      if (state.volumenMallaCSG !== null) {
        return state.volumenMallaCSG
      }
      return calculateAnalyticalTotal(state.bloques)
    },
    // Factor de captura (kg/m³): es propio de cada buque
    densidadEstiba() {
      return this.selectedBuque?.densidad_estiba || DENSIDAD_POR_DEFECTO
    },
    capturaEstimadaKg() {
      return this.volumenTotal * this.densidadEstiba
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
        // Al recargar (por ejemplo, tras una actualización automática) la página
        // anterior puede tardar un instante en soltar el candado: se reintenta
        let lock
        for (let intento = 0; intento < LOCK_RETRIES; intento++) {
          lock = await acquireTabLock({ onLost: () => this.onTabLockLost() })
          if (lock !== 'ocupada') break
          await new Promise(r => setTimeout(r, LOCK_RETRY_MS))
        }
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
      const { backend } = await openDatabase()
      this.storageBackend = backend
      this.dbReady = true
      await this.reloadFromDb()
      try {
        await ensureDailyBackup(await exportDatabaseBytes())
      } catch (err) {
        console.warn('No se pudo guardar la copia diaria:', err)
      }
      await this.refreshBackupInfo()
    },

    async reloadFromDb() {
      this.selectedBlockId = null
      this.hiddenBlockIds = [] // otra base: los ids pueden ser de otras piezas
      const [{ maxId }] = await query('SELECT COALESCE(MAX(id), 0) AS maxId FROM bloques')
      this._maxBlockId = Number(maxId) || 0
      await this.loadBuques()
      if (this.buques.length > 0) {
        await this.selectBuque(this.buques[0].id)
      } else {
        this.selectedBuqueId = null
        this.pozos = []
        this.clearPozoSelection()
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

    /**
     * Otra pestaña tomó el control: esta cierra la base (suelta los archivos del
     * OPFS para que la otra pueda abrirlos) y deja de escribir.
     */
    onTabLockLost() {
      clearTimeout(this._debounceTimer)
      clearTimeout(this._debounceVolTimer)
      this._debounceTimer = null
      this._debounceVolTimer = null
      this.dbReady = false
      this.tabStatus = 'desplazada'
      closeDatabase()
    },

    /**
     * Si hay una edición esperando para guardarse, la guarda ya en el pozo actual.
     * Se llama antes de cambiar de pozo: si no, el guardado diferido se haría
     * sobre el pozo nuevo y la edición del anterior se perdería.
     */
    savePendingEditsNow() {
      if (this._debounceTimer) this.flushPendingSave()
    },

    /**
     * Guarda ya lo pendiente (al cerrar u ocultar la pestaña, o antes de exportar).
     * Devuelve una promesa que se cumple cuando la base lo escribió.
     */
    flushPendingSave() {
      if (this.tabStatus !== 'ok' || !this.dbReady) return Promise.resolve()
      clearTimeout(this._debounceVolTimer)
      this._debounceVolTimer = null
      if (!this._debounceTimer) return Promise.resolve()
      clearTimeout(this._debounceTimer)
      this._debounceTimer = null
      return this.saveBloquesToDb()
    },

    // --- Copias y respaldos ---

    async exportDatabase() {
      await this.flushPendingSave()
      this.lastExportAt = await exportDatabaseFile()
    },

    /** Reemplaza la base por un archivo .sqlite exportado antes (con copia previa). */
    async importDatabase(file) {
      if (!file) return
      const ok = await confirmDialog({
        title: 'Importar base de datos',
        message: `¿Importar "${file.name}"?\n\n` +
          'Reemplazará todos los buques, pozos y piezas actuales. ' +
          'La base actual se guardará como copia antes de reemplazarla.',
        confirmText: 'Importar',
        danger: true
      })
      if (!ok) return
      this.isLoading = true
      try {
        await this.flushPendingSave()
        await importDatabaseFile(file)
        await this.reloadFromDb()
        await this.refreshBackupInfo()
      } catch (err) {
        await alertDialog({
          title: 'No se pudo importar el archivo',
          message: `${err.message || err}\n\nLa base actual no se modificó.`
        })
      } finally {
        this.isLoading = false
      }
    },

    async restoreBackup(id) {
      const copia = this.backups.find(c => c.id === id)
      if (!copia) return
      const fecha = new Date(copia.fecha).toLocaleString('es-AR')
      const ok = await confirmDialog({
        title: 'Restaurar copia',
        message: `¿Restaurar la copia del ${fecha}?\n\nLa base actual se guardará como copia antes de reemplazarla.`,
        confirmText: 'Restaurar',
        danger: true
      })
      if (!ok) return
      this.isLoading = true
      try {
        await this.flushPendingSave()
        const data = await getBackupData(id)
        if (!data) throw new Error('La copia ya no existe.')
        await replaceDatabase(data, 'Antes de restaurar una copia')
        await this.reloadFromDb()
        await this.refreshBackupInfo()
      } catch (err) {
        await alertDialog({ title: 'No se pudo restaurar la copia', message: err.message || String(err) })
      } finally {
        this.isLoading = false
      }
    },

    async loadBuques() {
      if (!this.dbReady) return
      this.buques = await query('SELECT * FROM buques ORDER BY id ASC')
    },

    async selectBuque(buqueId) {
      this.savePendingEditsNow()
      this.selectedBuqueId = buqueId
      await this.loadPozos(buqueId)
      if (this.pozos.length > 0) {
        await this.selectPozo(this.pozos[0].id)
      } else {
        this.clearPozoSelection()
      }
    },

    clearPozoSelection() {
      this.selectedPozoId = null
      this.selectedBlockId = null
      this.bloques = []
      this.resetHistory()
      this.updateVolumenReal() // sin piezas: no dejar el volumen del pozo anterior
    },

    async loadPozos(buqueId) {
      if (!this.dbReady) return
      this.pozos = await query('SELECT * FROM pozos WHERE buque_id = ? ORDER BY id ASC', [buqueId])
    },

    async selectPozo(pozoId) {
      this.savePendingEditsNow()
      await this.loadBloques(pozoId)
      this.resetHistory()
    },

    /**
     * Carga las piezas de un pozo y lo deja seleccionado. El pozo y sus piezas
     * se asignan juntos, después de leer la base: si el pozo cambiara antes, un
     * guardado pendiente podría escribir las piezas del anterior en el nuevo.
     */
    async loadBloques(pozoId) {
      if (!this.dbReady) return
      const rows = await query('SELECT * FROM bloques WHERE pozo_id = ? ORDER BY orden ASC', [pozoId])
      const list = []
      for (const b of rows) {
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
        b.fijada = Boolean(b.fijada)
        b.desvio_largo = Number(b.desvio_largo) || 0
        b.desvio_ancho = Number(b.desvio_ancho) || 0
        // Recalcular siempre: el valor guardado puede venir de una fórmula anterior
        const def = GEOMETRY_TYPES[b.tipo_figura]
        b.volumen_individual = def ? def.calculateVolume(b) : (Number(b.volumen_individual) || 0)
        list.push(b)
      }
      this.selectedPozoId = pozoId
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
        volumen_individual: 0,
        fijada: false,
        desvio_largo: 0,
        desvio_ancho: 0,
        ...def.rotacionInicial
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
      // Una pieza fijada no se mueve ni cambia de medidas (el nombre sí se puede editar)
      if (b.fijada && property !== 'nombre') return
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
      clon.fijada = false
      clon.nombre = `${original.nombre} (Copia)`
      clon.orden = this.bloques.length + 1
      clon.pos_x += 1.0
      this.bloques.push(clon)
      this.selectedBlockId = clon.id
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    // --- Visibilidad en el visor ---

    toggleBlockVisibility(blockId) {
      this.hiddenBlockIds = this.hiddenBlockIds.includes(blockId)
        ? this.hiddenBlockIds.filter(id => id !== blockId)
        : [...this.hiddenBlockIds, blockId]
    },

    showAllBlocks() {
      const delPozo = new Set(this.bloques.map(b => b.id))
      this.hiddenBlockIds = this.hiddenBlockIds.filter(id => !delPozo.has(id))
    },

    hideAllBlocks() {
      this.hiddenBlockIds = [...new Set([...this.hiddenBlockIds, ...this.bloques.map(b => b.id)])]
    },

    /** Fija o libera una pieza. Entra en deshacer/rehacer. */
    toggleBlockLock(blockId) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b) return
      this.flushPendingHistory() // que una edición previa quede como paso aparte
      b.fijada = !b.fijada
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    /** Espeja la pieza sobre un eje de la bodega, en su lugar. Entra en deshacer. */
    mirrorBlock(blockId, axis) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b || b.fijada) return
      this.flushPendingHistory()
      const espejada = espejarPieza(b, axis)
      for (const key of ['rot_x', 'rot_y', 'rot_z', 'pos_x', 'pos_y', 'pos_z', 'largo', 'ancho', 'desvio_largo', 'desvio_ancho']) {
        if (key in espejada) b[key] = espejada[key]
      }
      b.volumen_individual = GEOMETRY_TYPES[b.tipo_figura].calculateVolume(b)
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    // --- Estirar (arrastre de un tirador) ---
    // Mientras dura el arrastre no se registra historial: todo es un solo paso.

    beginStretch() {
      this.flushPendingHistory()
    },

    stretchBlock(blockId, values) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b || b.fijada) return
      let changed = false
      for (const [key, value] of Object.entries(values)) {
        if (Number.isFinite(value) && b[key] !== value) {
          b[key] = value
          changed = true
        }
      }
      if (!changed) return
      b.volumen_individual = GEOMETRY_TYPES[b.tipo_figura].calculateVolume(b)
      this.saveBloquesToDbDebounced()
    },

    endStretch() {
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    toggleBlockOperation(blockId) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b) return
      this.setBlockOperation(blockId, b.operacion === 'UNION' ? 'SUBSTRACCION' : 'UNION')
    },

    setBlockOperation(blockId, operacion) {
      const b = this.bloques.find(x => x.id === blockId)
      if (!b || b.operacion === operacion) return
      b.operacion = operacion
      this.pushHistoryState()
      this.saveBloquesToDb()
    },

    async clearCurrentPozo() {
      const ok = await confirmDialog({
        title: 'Reiniciar pozo',
        message: 'Se quitarán todas las piezas y el pozo quedará con una caja base.\n\nSe puede deshacer con Ctrl+Z.',
        confirmText: 'Reiniciar',
        danger: true
      })
      if (!ok) return
      this.bloques = []
      this.selectedBlockId = null
      // addBlockFromPalette ya registra el historial y guarda
      this.addBlockFromPalette('caja', 'UNION')
    },

    // --- Buques y pozos (alta, edición y baja) ---

    openRecordForm(tipo, id = null) {
      if (!this.dbReady) return
      if (tipo === 'pozo' && !this.selectedBuqueId) return
      this.recordForm = { tipo, id }
    },

    closeRecordForm() {
      this.recordForm = null
    },

    /** Crea o actualiza según `id`. Un buque nuevo nace con su primer pozo. */
    async saveBuque(id, { nombre, densidad_estiba }) {
      // matricula y armador son columnas opcionales que la app ya no usa: no se tocan
      const valores = [nombre.trim(), densidad_estiba]
      await this.flushPendingSave()
      if (id) {
        await run('UPDATE buques SET nombre = ?, densidad_estiba = ? WHERE id = ?', [...valores, id])
        await this.loadBuques()
        return
      }
      const { lastInsertRowid } = await run(
        'INSERT INTO buques (nombre, densidad_estiba) VALUES (?, ?)', valores)
      await this.loadBuques()
      await this.selectBuque(lastInsertRowid)
      await this.createPozo({ nombre: 'Pozo N° 1', notas: '' })
    },

    async createPozo({ nombre, notas }) {
      await this.flushPendingSave()
      const { lastInsertRowid } = await run(
        "INSERT INTO pozos (buque_id, nombre, volumen_total, notas) VALUES (?, ?, 0, ?)",
        [this.selectedBuqueId, nombre.trim(), notas.trim()]
      )
      await this.loadPozos(this.selectedBuqueId)
      await this.selectPozo(lastInsertRowid)
      this.addBlockFromPalette('caja', 'UNION')
      // El pozo nace con su caja base: que deshacer no lo deje vacío
      this.resetHistory()
    },

    async savePozo(id, { nombre, notas }) {
      if (!id) return this.createPozo({ nombre, notas })
      await run('UPDATE pozos SET nombre = ?, notas = ? WHERE id = ?', [nombre.trim(), notas.trim(), id])
      await this.loadPozos(this.selectedBuqueId)
    },

    /** Elimina un buque con sus pozos y piezas (con confirmación y copia previa). */
    async deleteBuque(id) {
      const buque = this.buques.find(b => b.id === id)
      if (!buque) return false
      const [{ pozos, piezas }] = await query(`
        SELECT COUNT(DISTINCT p.id) AS pozos, COUNT(b.id) AS piezas
        FROM pozos p LEFT JOIN bloques b ON b.pozo_id = p.id WHERE p.buque_id = ?`, [id])
      const ok = await confirmDialog({
        title: 'Eliminar buque',
        message: `¿Eliminar "${buque.nombre}"?\n\nSe borrarán también sus pozos (${pozos}) y piezas (${piezas}). ` +
          'Antes se guarda una copia automática de la base.',
        confirmText: 'Eliminar buque',
        danger: true
      })
      if (!ok) return false

      await this.backupBeforeDelete(`Antes de eliminar el buque "${buque.nombre}"`)
      await batch([
        { sql: 'DELETE FROM bloques WHERE pozo_id IN (SELECT id FROM pozos WHERE buque_id = ?)', params: [id] },
        { sql: 'DELETE FROM pozos WHERE buque_id = ?', params: [id] },
        { sql: 'DELETE FROM buques WHERE id = ?', params: [id] }
      ])
      await this.reloadFromDb()
      return true
    },

    /** Elimina un pozo con sus piezas (con confirmación y copia previa). */
    async deletePozo(id) {
      const pozo = this.pozos.find(p => p.id === id)
      if (!pozo) return false
      const [{ piezas }] = await query('SELECT COUNT(*) AS piezas FROM bloques WHERE pozo_id = ?', [id])
      const ok = await confirmDialog({
        title: 'Eliminar pozo',
        message: `¿Eliminar "${pozo.nombre}"?\n\nSe borrarán también sus piezas (${piezas}). ` +
          'Antes se guarda una copia automática de la base.',
        confirmText: 'Eliminar pozo',
        danger: true
      })
      if (!ok) return false

      await this.backupBeforeDelete(`Antes de eliminar el pozo "${pozo.nombre}"`)
      await batch([
        { sql: 'DELETE FROM bloques WHERE pozo_id = ?', params: [id] },
        { sql: 'DELETE FROM pozos WHERE id = ?', params: [id] }
      ])
      await this.loadPozos(this.selectedBuqueId)
      if (this.pozos.length > 0) await this.selectPozo(this.pozos[0].id)
      else this.clearPozoSelection()
      return true
    },

    /** El borrado no entra en deshacer: se guarda una copia para poder volver atrás. */
    async backupBeforeDelete(motivo) {
      await this.flushPendingSave()
      await saveBackup(await exportDatabaseBytes(), motivo)
      await this.refreshBackupInfo()
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

      if (this.dbReady && pozoId) {
        run('UPDATE pozos SET volumen_total = ? WHERE id = ?', [this.volumenTotal, pozoId])
          .catch(err => console.warn('No se pudo guardar el volumen del pozo:', err))
      }
    },

    updateVolumenRealDebounced() {
      if (this._debounceVolTimer) clearTimeout(this._debounceVolTimer)
      this._debounceVolTimer = setTimeout(() => {
        this.updateVolumenReal()
      }, 150)
    },

    async saveBloquesToDb() {
      if (!this.dbReady || !this.selectedPozoId) return
      // Todo cambio de piezas pasa por acá (agregar, borrar, duplicar, cambiar rol…):
      // recalcular el volumen real. Si las piezas no cambiaron, sale de la caché.
      this.updateVolumenReal()

      // Las sentencias se arman ya, con el pozo y las piezas de este momento:
      // la escritura es asíncrona y mientras tanto el usuario puede cambiar de pozo.
      const pozoId = this.selectedPozoId
      const INSERT = `
        INSERT INTO bloques (id, pozo_id, orden, nombre, tipo_figura, operacion,
                             largo, ancho, alto, base_a, base_b, diametro_d, diametro_d_menor,
                             pos_x, pos_y, pos_z, rot_x, rot_y, rot_z, volumen_individual, fijada,
                             desvio_largo, desvio_ancho)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      const statements = [{ sql: 'DELETE FROM bloques WHERE pozo_id = ?', params: [pozoId] }]
      this.bloques.forEach((b, idx) => {
        statements.push({
          sql: INSERT,
          params: [
            b.id,
            pozoId,
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
            b.volumen_individual || 0,
            b.fijada ? 1 : 0,
            b.desvio_largo || 0,
            b.desvio_ancho || 0
          ]
        })
      })
      // Actualizar volumen total en la tabla pozos
      statements.push({ sql: 'UPDATE pozos SET volumen_total = ? WHERE id = ?', params: [this.volumenTotal, pozoId] })

      try {
        // En una sola transacción: o se guardan todas las piezas o ninguna
        await batch(statements)
      } catch (e) {
        console.error('Error al guardar las piezas:', e)
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
     * (no por pozo): se parte del mayor de la base, leído al abrirla, y nunca se
     * repite uno ya entregado en esta sesión.
     */
    nextBlockId() {
      let max = this._maxBlockId || 0
      for (const b of this.bloques) max = Math.max(max, Number(b.id) || 0)
      this._maxBlockId = max + 1
      return this._maxBlockId
    }
  }
})
