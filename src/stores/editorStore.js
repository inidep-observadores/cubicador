import { defineStore } from 'pinia'
import { getDatabase, persistDatabase } from '../services/db'
import { GEOMETRY_TYPES, calculateAnalyticalTotal } from '../services/geometryCatalog'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    isLoading: true,
    db: null,

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
    volumenMallaCSG: 0,
    isComputingCSG: false,
    csgError: null,
    showDimensions: true,
    showGrid: true,
    snapToGrid: true,
    gridStep: 0.25, // metros
    transformMode: 'translate', // 'translate' | 'rotate'

    // Historial para Undo / Redo
    history: [],
    historyIndex: -1,

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
    volumenTotal(state) {
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
      return state.historyIndex > 0
    },
    canRedo(state) {
      return state.historyIndex < state.history.length - 1
    }
  },

  actions: {
    async init() {
      this.isLoading = true
      try {
        this.db = await getDatabase()
        await this.loadBuques()
        if (this.buques.length > 0) {
          await this.selectBuque(this.buques[0].id)
        }
      } catch (err) {
        console.error('Error al inicializar base de datos SQLite:', err)
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
        b.volumen_individual = Number(b.volumen_individual) || 0
        list.push(b)
      }
      stmt.free()
      this.bloques = list
      if (this.bloques.length > 0 && !this.selectedBlockId) {
        this.selectedBlockId = this.bloques[0].id
      }
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
        id: Date.now(),
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
        pos_y: (defaults.alto || 2.5) / 2,
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
      b[property] = value
      const def = GEOMETRY_TYPES[b.tipo_figura]
      if (def) {
        b.volumen_individual = def.calculateVolume(b)
      }
      this.saveBloquesToDbDebounced()
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
      clon.id = Date.now()
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
      this.addBlockFromPalette('caja', 'UNION')
      this.pushHistoryState()
      this.saveBloquesToDb()
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
      }
    },

    async saveBloquesToDb() {
      if (!this.db || !this.selectedPozoId) return
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
      if (this._debounceTimer) clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        this.saveBloquesToDb()
      }, 300)
    },

    // Manejo de historial (Deshacer/Rehacer)
    resetHistory() {
      this.history = [JSON.stringify(this.bloques)]
      this.historyIndex = 0
    },

    pushHistoryState() {
      // Si estamos en un punto anterior, descartar los futuros
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }
      this.history.push(JSON.stringify(this.bloques))
      this.historyIndex++
      if (this.history.length > 30) {
        this.history.shift()
        this.historyIndex--
      }
    },

    undo() {
      if (!this.canUndo) return
      this.historyIndex--
      this.bloques = JSON.parse(this.history[this.historyIndex])
      this.saveBloquesToDb()
    },

    redo() {
      if (!this.canRedo) return
      this.historyIndex++
      this.bloques = JSON.parse(this.history[this.historyIndex])
      this.saveBloquesToDb()
    }
  }
})
