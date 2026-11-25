<template>
  <header class="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-md z-30">
    <!-- Identificación Buque / Pozo -->
    <div class="flex items-center space-x-3">
      <div class="bg-sky-600/20 text-sky-400 p-2 rounded-lg border border-sky-500/30 flex items-center justify-center">
        <Ship class="w-5 h-5" />
      </div>
      <div>
        <div class="flex items-center space-x-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Buque</span>
          <select 
            v-if="store.buques.length" 
            :value="store.selectedBuqueId" 
            @change="store.selectBuque(Number($event.target.value))"
            class="bg-slate-800 text-sm font-bold text-white border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option v-for="b in store.buques" :key="b.id" :value="b.id">
              {{ b.nombre }} ({{ b.matricula }})
            </option>
          </select>
        </div>
        <div class="flex items-center space-x-2 mt-0.5">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Pozo</span>
          <select 
            v-if="store.pozos.length" 
            :value="store.selectedPozoId" 
            @change="store.selectPozo(Number($event.target.value))"
            class="bg-slate-800 text-xs font-medium text-sky-300 border border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option v-for="p in store.pozos" :key="p.id" :value="p.id">
              {{ p.nombre }}
            </option>
          </select>
          <button 
            @click="store.createNewPozo()"
            title="Crear un nuevo pozo en este buque"
            class="p-1 hover:bg-slate-800 text-sky-400 hover:text-white rounded border border-slate-700 text-xs font-bold transition"
          >
            + Nuevo
          </button>
          <button 
            @click="store.clearCurrentPozo()"
            title="Limpiar este pozo y empezar con una caja base limpia"
            class="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded border border-slate-700 text-xs transition"
          >
            ↺ Reiniciar
          </button>
        </div>
      </div>
    </div>

    <!-- Indicador Métrico Central: Volumen y Captura -->
    <div class="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-1.5 space-x-6 shadow-inner">
      <!-- Selector de Modo de Modelo (Piezas vs Booleano CSG) -->
      <div class="flex bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
        <button 
          @click="store.modelMode = 'edicion'"
          :class="store.modelMode === 'edicion' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Edición: manipular y posicionar bloques individuales"
          class="px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Edición</span>
        </button>
        <button 
          @click="store.modelMode = 'solidoFinal'"
          :class="store.modelMode === 'solidoFinal' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Pozo Booleano: ver sólido combinado con cortes reales en la malla"
          class="px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5"
        >
          <Sparkles class="w-3.5 h-3.5 text-amber-300" />
          <span>Pozo Booleano</span>
        </button>
      </div>

      <div class="h-7 w-px bg-slate-800"></div>

      <div class="text-center min-w-[130px]">
        <div class="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
          <span>Volumen del Pozo</span>
          <span
            v-if="store.volumenEsReal"
            class="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30"
            title="Volumen espacial real considerando intersecciones y recortes 3D"
          >Real 3D</span>
          <span
            v-else
            class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
            :title="store.csgError + '. Se muestra la suma nominal de las piezas, sin considerar solapamientos ni recortes.'"
          >⚠ Nominal</span>
        </div>
        <div
          class="text-xl font-extrabold font-mono flex items-baseline justify-center gap-1"
          :class="store.volumenEsReal ? 'text-sky-400' : 'text-amber-300'"
        >
          <span>{{ store.volumenTotal.toFixed(2) }}</span>
          <span class="text-xs font-normal text-slate-400">m³</span>
        </div>
        <div v-if="!store.volumenEsReal" class="text-[9px] text-amber-400 font-mono max-w-[180px] truncate" :title="store.csgError">
          Falló el cálculo 3D: revisar piezas
        </div>
        <div v-else-if="Math.abs(store.volumenNominal - store.volumenTotal) > 0.05" class="text-[9px] text-amber-400/90 font-mono flex items-center justify-center gap-1" :title="'Suma nominal de piezas: ' + store.volumenNominal.toFixed(2) + ' m³ (sin considerar intersección espacial)'">
          <span>Nominal: {{ store.volumenNominal.toFixed(2) }} m³</span>
        </div>
        <div v-else class="text-[9px] text-emerald-400/80 font-mono flex items-center justify-center gap-1">
          <span>✓ Sin solapamientos</span>
        </div>
      </div>

      <div class="h-7 w-px bg-slate-800"></div>

      <div class="text-center min-w-[130px]">
        <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Capacidad Captura Est.</div>
        <div class="text-xl font-extrabold text-emerald-400 font-mono flex items-baseline justify-center gap-1">
          <span>{{ store.capturaEstimadaToneladas.toFixed(2) }}</span>
          <span class="text-xs font-normal text-slate-400">Ton</span>
        </div>
        <div class="text-[9px] text-slate-500">
          Factor: {{ ((store.selectedPozo?.densidad_estiba || 800) / 1000).toFixed(2) }} t/m³
        </div>
      </div>
    </div>

    <!-- Controles de Visualización, Historial y Exportación -->
    <div class="flex items-center space-x-2">
      <!-- Deshacer / Rehacer -->
      <div class="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button 
          @click="store.undo()" 
          :disabled="!store.canUndo"
          title="Deshacer (Ctrl+Z)"
          class="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition"
        >
          <Undo2 class="w-4 h-4" />
        </button>
        <button 
          @click="store.redo()" 
          :disabled="!store.canRedo"
          title="Rehacer (Ctrl+Y)"
          class="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition"
        >
          <Redo2 class="w-4 h-4" />
        </button>
      </div>

      <!-- Modo de visualización 3D -->
      <div class="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button 
          @click="store.viewMode = 'solido'"
          :class="store.viewMode === 'solido' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Sólido"
          class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1"
        >
          <Box class="w-3.5 h-3.5" /> Sólido
        </button>
        <button 
          @click="store.viewMode = 'rayosX'"
          :class="store.viewMode === 'rayosX' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Rayos X (Transparencia para ver cortes interiores)"
          class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1"
        >
          <Eye class="w-3.5 h-3.5" /> Rayos X
        </button>
        <button 
          @click="store.viewMode = 'alambrico'"
          :class="store.viewMode === 'alambrico' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Alámbrico / Aristas"
          class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1"
        >
          <Layers class="w-3.5 h-3.5" /> Alambre
        </button>
      </div>

      <!-- Cotas y Snap -->
      <button 
        @click="store.showDimensions = !store.showDimensions"
        :class="store.showDimensions ? 'bg-slate-700 text-sky-400 border-sky-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'"
        title="Mostrar / Ocultar Cotas y Medidas"
        class="p-2 border rounded-lg hover:text-white transition"
      >
        <Ruler class="w-4 h-4" />
      </button>

      <!-- Instalar como app (solo si el navegador lo ofrece) -->
      <button
        v-if="canInstall && !isInstalled"
        @click="promptInstall()"
        title="Instalar como aplicación: funciona sin conexión y el navegador conserva mejor los datos"
        class="flex items-center gap-1.5 bg-sky-600/90 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
      >
        <MonitorDown class="w-4 h-4" />
        <span>Instalar app</span>
      </button>

      <!-- Respaldo a archivo y copias automáticas -->
      <div class="relative flex items-stretch">
        <button
          @click="store.exportDatabase()"
          :title="exportTitle"
          :class="exportOverdue ? 'border-amber-500/60 text-amber-200' : 'border-slate-700 text-slate-200'"
          class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border rounded-l-lg px-3 py-1.5 text-xs font-medium transition"
        >
          <Database class="w-4 h-4" :class="exportOverdue ? 'text-amber-400' : 'text-emerald-400'" />
          <span>Respaldar DB</span>
          <span v-if="exportOverdue" class="text-[10px] font-mono text-amber-400">{{ exportAgeLabel }}</span>
        </button>
        <button
          @click="backupsOpen = !backupsOpen"
          title="Copias automáticas guardadas en este navegador"
          class="flex items-center bg-slate-800 hover:bg-slate-700 border border-l-0 border-slate-700 text-slate-300 rounded-r-lg px-1.5 transition"
        >
          <History class="w-4 h-4" />
        </button>

        <div
          v-if="backupsOpen"
          class="absolute right-0 top-full mt-2 w-80 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2 text-xs"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold uppercase tracking-wider text-slate-300 text-[11px]">Respaldos y copias</span>
            <button @click="backupsOpen = false" class="text-slate-500 hover:text-white">✕</button>
          </div>

          <p v-if="store.storagePersisted === true" class="text-emerald-400/90 text-[11px]">
            ✓ El navegador conserva los datos de forma persistente.
          </p>
          <p v-else class="text-amber-300 text-[11px]">
            ⚠ El navegador podría borrar los datos si falta espacio o la app no se usa por un tiempo.
            Instalá la app y exportá respaldos .sqlite con frecuencia.
          </p>

          <p class="text-slate-500 text-[11px]">
            Se guardan dentro de este navegador: sirven para volver atrás, pero no reemplazan un archivo exportado.
          </p>

          <div class="flex gap-2">
            <button
              @click="store.exportDatabase()"
              class="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg py-1.5 font-medium transition"
            >
              <Download class="w-3.5 h-3.5 text-emerald-400" />
              Exportar .sqlite
            </button>
            <button
              @click="fileInput?.click()"
              class="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg py-1.5 font-medium transition"
              title="Reemplazar la base actual por un archivo .sqlite exportado antes"
            >
              <Upload class="w-3.5 h-3.5 text-sky-400" />
              Importar .sqlite
            </button>
            <input ref="fileInput" type="file" accept=".sqlite,.sqlite3,.db,application/x-sqlite3,application/vnd.sqlite3" class="hidden" @change="onImportFile" />
          </div>

          <div v-if="store.backups.length === 0" class="text-slate-500 italic py-2">Todavía no hay copias.</div>
          <ul v-else class="max-h-64 overflow-y-auto space-y-1">
            <li
              v-for="c in store.backups"
              :key="c.id"
              class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5"
            >
              <div class="min-w-0">
                <div class="font-mono text-slate-200">{{ formatDate(c.fecha) }}</div>
                <div class="text-[10px] text-slate-500 truncate">{{ c.motivo }} · {{ formatSize(c.tamano) }}</div>
              </div>
              <button
                @click="restore(c.id)"
                class="shrink-0 text-[11px] text-sky-300 hover:text-white hover:bg-slate-700 px-2 py-1 rounded transition"
              >
                Restaurar
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import {
  Ship, Undo2, Redo2, Box, Eye, Layers, Ruler, Database, Sparkles, History,
  Download, Upload, MonitorDown
} from 'lucide-vue-next'
import { canInstall, isInstalled, promptInstall } from '../services/install'

const store = useEditorStore()
const backupsOpen = ref(false)

const DAY_MS = 24 * 60 * 60 * 1000
const EXPORT_REMINDER_DAYS = 7

const exportAgeDays = computed(() =>
  store.lastExportAt ? Math.floor((Date.now() - store.lastExportAt) / DAY_MS) : null
)
const exportOverdue = computed(() =>
  exportAgeDays.value === null || exportAgeDays.value >= EXPORT_REMINDER_DAYS
)
const exportAgeLabel = computed(() =>
  exportAgeDays.value === null ? 'nunca' : `hace ${exportAgeDays.value} d`
)
const exportTitle = computed(() => {
  const base = 'Descargar la base de datos completa como archivo .sqlite'
  if (exportAgeDays.value === null) return `${base}. Todavía no se exportó ningún respaldo.`
  return `${base}. Último respaldo: ${new Date(store.lastExportAt).toLocaleString('es-AR')}.`
})

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function restore(id) {
  backupsOpen.value = false
  await store.restoreBackup(id)
}

const fileInput = ref(null)

async function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // permitir volver a elegir el mismo archivo
  if (!file) return
  backupsOpen.value = false
  await store.importDatabase(file)
}
</script>
