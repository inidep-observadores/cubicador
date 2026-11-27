<template>
  <header
    class="bg-slate-900 border-b border-slate-800 shadow-md z-30 flex items-center gap-x-3 gap-y-1.5 px-2 py-1.5 sm:px-3 lg:px-4 lg:py-2"
    :class="layout.isPhone ? 'flex-wrap' : 'flex-nowrap lg:justify-between'"
  >
    <!-- Identificación Buque / Pozo -->
    <div class="flex items-center gap-3 min-w-0" :class="layout.isPhone ? 'w-full' : 'shrink-0'">
      <div class="hidden 2xl:flex bg-sky-600/20 text-sky-400 p-2 rounded-lg border border-sky-500/30 items-center justify-center">
        <Ship class="w-5 h-5" />
      </div>
      <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 min-w-0 flex-1">
        <span class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Buque</span>
        <select
          :value="store.selectedBuqueId ?? ''"
          :disabled="!store.buques.length"
          @change="store.selectBuque(Number($event.target.value))"
          aria-label="Buque"
          class="w-full sm:w-48 2xl:w-56 bg-slate-800 text-sm font-bold text-white border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-sky-500 cursor-pointer truncate"
        >
          <option v-if="!store.buques.length" value="">Sin buques</option>
          <option v-for="b in store.buques" :key="b.id" :value="b.id">
            {{ b.nombre }}
          </option>
        </select>
        <div class="flex items-center gap-1">
          <button @click="store.openRecordForm('buque', store.selectedBuqueId)" :disabled="!store.selectedBuqueId" title="Editar o eliminar el buque" aria-label="Editar buque" :class="iconBtn">
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button @click="store.openRecordForm('buque')" title="Nuevo buque" aria-label="Nuevo buque" :class="[iconBtn, '!text-sky-400']">
            <Plus class="w-3.5 h-3.5" />
          </button>
          <!-- Alinea con la tercera columna de botones del pozo -->
          <span :class="[iconBtn, 'invisible']" aria-hidden="true"><Plus class="w-3.5 h-3.5" /></span>
        </div>

        <span class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Pozo</span>
        <select
          :value="store.selectedPozoId ?? ''"
          :disabled="!store.pozos.length"
          @change="store.selectPozo(Number($event.target.value))"
          aria-label="Pozo"
          class="w-full sm:w-48 2xl:w-56 bg-slate-800 text-xs font-medium text-sky-300 border border-slate-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-sky-500 cursor-pointer truncate"
        >
          <option v-if="!store.pozos.length" value="">Sin pozos</option>
          <option v-for="p in store.pozos" :key="p.id" :value="p.id">
            {{ p.nombre }}
          </option>
        </select>
        <div class="flex items-center gap-1">
          <button @click="store.openRecordForm('pozo', store.selectedPozoId)" :disabled="!store.selectedPozoId" title="Editar o eliminar el pozo" aria-label="Editar pozo" :class="iconBtn">
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button @click="store.openRecordForm('pozo')" :disabled="!store.selectedBuqueId" title="Nuevo pozo en este buque" aria-label="Nuevo pozo" :class="[iconBtn, '!text-sky-400']">
            <Plus class="w-3.5 h-3.5" />
          </button>
          <button @click="store.clearCurrentPozo()" :disabled="!store.selectedPozoId" title="Reiniciar: dejar el pozo con una caja base" aria-label="Reiniciar pozo" :class="[iconBtn, 'hover:!text-amber-300']">
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Indicador métrico: modo (solo escritorio), volumen y captura -->
    <div
      class="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl shadow-inner px-2 py-1 gap-2 sm:gap-3 2xl:px-4 2xl:py-1.5 2xl:gap-6"
      :class="layout.isPhone ? 'w-full justify-around' : layout.isCompact ? 'flex-1 justify-around min-w-0' : ''"
    >
      <template v-if="!layout.isCompact">
        <ModelModeToggle :show-labels="layout.isWide" />
        <div class="h-7 w-px bg-slate-800"></div>
      </template>

      <div class="text-center min-w-0 lg:min-w-[120px]">
        <div class="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 whitespace-nowrap">
          <span>{{ layout.isCompact ? 'Volumen' : 'Volumen del Pozo' }}</span>
          <span
            v-if="volumeState === 'calculando'"
            class="text-[9px] px-1 py-0.2 rounded bg-slate-700/60 text-slate-300 font-semibold border border-slate-600 animate-pulse"
            title="Calculando el volumen real 3D en segundo plano"
          >Calculando…</span>
          <span
            v-else-if="volumeState === 'error'"
            class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
            :title="store.csgError + '. El valor es aproximado: no considera solapamientos ni recortes.'"
          >⚠ Aproximado</span>
        </div>
        <div
          class="font-extrabold font-mono flex items-baseline justify-center gap-1 transition-opacity"
          :class="[
            layout.isCompact ? 'text-lg leading-tight' : 'text-xl',
            volumeState === 'real' ? 'text-sky-400' : volumeState === 'calculando' ? 'text-slate-400' : 'text-amber-300',
            store.csgPending ? 'opacity-60' : ''
          ]"
          :title="store.csgPending ? 'Actualizando el volumen 3D…' : ''"
        >
          <span>{{ store.volumenTotal.toFixed(2) }}</span>
          <span class="text-xs font-normal text-slate-400">m³</span>
        </div>
        <div v-if="volumeState === 'error' && !layout.isCompact" class="text-[9px] text-amber-400 font-mono max-w-[180px] truncate" :title="store.csgError">
          Falló el cálculo 3D: revisar piezas
        </div>
      </div>

      <div class="h-7 w-px bg-slate-800"></div>

      <div class="text-center min-w-0 lg:min-w-[120px]">
        <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400 whitespace-nowrap">
          {{ layout.isCompact ? 'Captura est.' : 'Capacidad Captura Est.' }}
        </div>
        <div class="font-extrabold text-emerald-400 font-mono flex items-baseline justify-center gap-1" :class="layout.isCompact ? 'text-lg leading-tight' : 'text-xl'">
          <span>{{ store.capturaEstimadaToneladas.toFixed(2) }}</span>
          <span class="text-xs font-normal text-slate-400">t</span>
        </div>
        <button
          v-if="!layout.isShort"
          @click="store.openRecordForm('buque', store.selectedBuqueId)"
          :disabled="!store.selectedBuqueId"
          title="Factor de captura del buque. Clic para cambiarlo"
          class="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-300 transition whitespace-nowrap"
        >
          Factor: {{ formatDecimal(store.densidadEstiba / 1000) }} t/m³
          <Pencil class="w-2.5 h-2.5" />
        </button>
      </div>
    </div>

    <!-- Controles (escritorio). En modo compacto están en la barra inferior y en "Más" -->
    <div v-if="!layout.isCompact" class="flex items-center gap-2 shrink-0">
      <!-- Deshacer / Rehacer -->
      <div class="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button
          @click="store.undo()"
          :disabled="!store.canUndo"
          title="Deshacer (Ctrl+Z)"
          aria-label="Deshacer"
          class="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition"
        >
          <Undo2 class="w-4 h-4" />
        </button>
        <button
          @click="store.redo()"
          :disabled="!store.canRedo"
          title="Rehacer (Ctrl+Y)"
          aria-label="Rehacer"
          class="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition"
        >
          <Redo2 class="w-4 h-4" />
        </button>
      </div>

      <!-- Modo de visualización 3D -->
      <div class="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button
          v-for="m in VIEW_MODES"
          :key="m.id"
          @click="store.viewMode = m.id"
          :class="store.viewMode === m.id ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          :title="m.title"
          :aria-label="m.label"
          :aria-pressed="store.viewMode === m.id"
          class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1"
        >
          <component :is="m.icon" class="w-3.5 h-3.5" />
          <span class="hidden 2xl:inline">{{ m.label }}</span>
        </button>
      </div>

      <!-- Cotas -->
      <button
        @click="store.setShowDimensions(!store.showDimensions)"
        :class="store.showDimensions ? 'bg-slate-700 text-sky-400 border-sky-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'"
        title="Mostrar / Ocultar Cotas y Medidas"
        aria-label="Cotas y medidas"
        :aria-pressed="store.showDimensions"
        class="p-2 border rounded-lg hover:text-white transition"
      >
        <Ruler class="w-4 h-4" />
      </button>

      <!-- Instalar como app (solo si el navegador lo ofrece) -->
      <button
        v-if="canInstall && !isInstalled"
        @click="promptInstall()"
        title="Instalar como aplicación: funciona sin conexión y el navegador conserva mejor los datos"
        class="flex items-center gap-1.5 bg-sky-600/90 hover:bg-sky-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition"
      >
        <MonitorDown class="w-4 h-4" />
        <span class="hidden 2xl:inline">Instalar app</span>
      </button>

      <!-- Manual de uso -->
      <button
        @click="openManual()"
        title="Manual de uso (F1)"
        aria-label="Manual de uso"
        class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
      >
        <BookOpen class="w-4 h-4 text-sky-400" />
        <span class="hidden 2xl:inline">Manual</span>
      </button>

      <!-- Respaldo a archivo y copias automáticas -->
      <div class="relative flex items-stretch">
        <button
          @click="store.exportDatabase()"
          :title="exportTitle"
          :class="exportOverdue ? 'border-amber-500/60 text-amber-200' : 'border-slate-700 text-slate-200'"
          class="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition"
        >
          <Database class="w-4 h-4" :class="exportOverdue ? 'text-amber-400' : 'text-emerald-400'" />
          <span class="hidden 2xl:inline">Respaldar DB</span>
          <span v-if="exportOverdue" class="text-[10px] font-mono text-amber-400">{{ exportAgeLabel }}</span>
        </button>
        <button
          @click="backupsOpen = !backupsOpen"
          title="Respaldos y copias automáticas"
          aria-label="Respaldos y copias"
          :aria-expanded="backupsOpen"
          class="flex items-center bg-slate-800 hover:bg-slate-700 border border-l-0 border-slate-700 text-slate-300 rounded-r-lg px-1.5 transition"
        >
          <History class="w-4 h-4" />
        </button>

        <div
          v-if="backupsOpen"
          class="absolute right-0 top-full mt-2 w-80 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold uppercase tracking-wider text-slate-300 text-[11px]">Respaldos y copias</span>
            <button @click="backupsOpen = false" aria-label="Cerrar" class="text-slate-500 hover:text-white">✕</button>
          </div>
          <BackupsPanel scroll-list @done="backupsOpen = false" />
          <div class="pt-1 border-t border-slate-800"><AppVersion /></div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import {
  Ship, Undo2, Redo2, Box, Eye, Layers, Ruler, Database, History, MonitorDown, Pencil, Plus, RotateCcw, BookOpen
} from 'lucide-vue-next'
import { openManual } from '../services/layout'
import { canInstall, isInstalled, promptInstall } from '../services/install'
import { formatDecimal } from '../services/decimal'
import { layout } from '../services/layout'
import { useExportStatus } from '../services/exportStatus'
import ModelModeToggle from './ModelModeToggle.vue'
import BackupsPanel from './BackupsPanel.vue'
import AppVersion from './AppVersion.vue'

const VIEW_MODES = [
  { id: 'solido', label: 'Sólido', title: 'Modo Sólido', icon: Box },
  { id: 'rayosX', label: 'Rayos X', title: 'Modo Rayos X (transparencia para ver cortes interiores)', icon: Eye },
  { id: 'alambrico', label: 'Alambre', title: 'Modo Alámbrico / Aristas', icon: Layers }
]

const store = useEditorStore()
const backupsOpen = ref(false)
const { exportOverdue, exportAgeLabel, exportTitle } = useExportStatus()

// Botones de ícono: más grandes con pantalla táctil
const iconBtn = computed(() => [
  'rounded border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-30 disabled:hover:bg-transparent',
  layout.isTouch ? 'p-1.5' : 'p-1'
])

// 'real': volumen 3D confiable · 'calculando': primer cálculo en curso · 'error': falló el 3D
const volumeState = computed(() => {
  if (store.volumenEsReal) return 'real'
  if (store.csgError) return 'error'
  return 'calculando'
})
</script>
