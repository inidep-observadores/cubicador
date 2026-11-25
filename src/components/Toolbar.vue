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
          <span v-if="store.modelMode === 'solidoFinal'" class="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">CSG</span>
        </div>
        <div class="text-xl font-extrabold text-sky-400 font-mono flex items-baseline justify-center gap-1">
          <span>{{ store.volumenTotal.toFixed(2) }}</span>
          <span class="text-xs font-normal text-slate-400">m³</span>
        </div>
        <div v-if="store.modelMode === 'solidoFinal' && store.volumenMallaCSG > 0" class="text-[9px] text-slate-400 font-mono flex items-center justify-center gap-1">
          <span>Malla 3D: {{ store.volumenMallaCSG.toFixed(2) }} m³</span>
          <span v-if="Math.abs(store.volumenMallaCSG - store.volumenTotal) < 0.05" class="text-emerald-400 font-bold" title="Cálculo analítico y malla 3D coinciden exactamente">✓</span>
        </div>
      </div>

      <div class="h-7 w-px bg-slate-800"></div>

      <div class="text-center min-w-[130px]">
        <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Capacidad Captura Est.</div>
        <div class="text-xl font-extrabold text-emerald-400 font-mono flex items-baseline justify-center gap-1">
          <span>{{ (store.volumenTotal * (store.selectedPozo?.densidad_estiba || 800) / 1000).toFixed(2) }}</span>
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

      <!-- Botón Exportar SQLite -->
      <button 
        @click="exportDb"
        title="Guardar / Respaldar Base de Datos SQLite (.sqlite)"
        class="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
      >
        <Database class="w-4 h-4 text-emerald-400" />
        <span>Respaldar DB</span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore'
import { exportDatabaseFile } from '../services/db'
import { 
  Ship, Undo2, Redo2, Box, Eye, Layers, Ruler, Database, Sparkles 
} from 'lucide-vue-next'

const store = useEditorStore()

function exportDb() {
  exportDatabaseFile()
}
</script>
