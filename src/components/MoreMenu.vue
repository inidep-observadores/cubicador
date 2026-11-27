<template>
  <!-- Menú "Más" del modo compacto: lo que en escritorio está en la barra superior -->
  <div class="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
    <section class="space-y-2">
      <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visualización</h3>
      <div class="grid grid-cols-3 gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button
          v-for="m in VIEW_MODES"
          :key="m.id"
          @click="store.viewMode = m.id"
          :aria-pressed="store.viewMode === m.id"
          :class="store.viewMode === m.id ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          class="flex items-center justify-center gap-1.5 py-2 rounded-md font-medium transition"
        >
          <component :is="m.icon" class="w-4 h-4" />
          {{ m.label }}
        </button>
      </div>
      <label class="flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5">
        <span class="flex items-center gap-2 text-slate-200"><Ruler class="w-4 h-4 text-sky-400" /> Cotas y medidas en el visor</span>
        <input
          type="checkbox"
          :checked="store.showDimensions"
          @change="store.setShowDimensions($event.target.checked)"
          class="w-4 h-4 accent-sky-500"
        />
      </label>
      <label class="flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5">
        <span class="flex items-center gap-2 text-slate-200"><Magnet class="w-4 h-4 text-amber-400" /> Imán: ajustar a la cuadrícula y a otras piezas</span>
        <input type="checkbox" v-model="store.snapToGrid" class="w-4 h-4 accent-sky-500" />
      </label>
    </section>

    <section class="space-y-2">
      <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Respaldos y copias</h3>
      <BackupsPanel @done="closePanel()" />
    </section>

    <section class="space-y-2">
      <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aplicación</h3>
      <button
        @click="closePanel(); openManual()"
        class="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg py-2.5 font-semibold transition"
      >
        <BookOpen class="w-4 h-4 text-sky-400" />
        Manual de uso
      </button>
      <button
        v-if="canInstall && !isInstalled"
        @click="promptInstall()"
        class="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg py-2.5 font-semibold transition"
      >
        <MonitorDown class="w-4 h-4" />
        Instalar como aplicación
      </button>
      <AppVersion />
    </section>
  </div>
</template>

<script setup>
import { Box, Eye, Layers, Ruler, Magnet, MonitorDown, BookOpen } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editorStore'
import { canInstall, isInstalled, promptInstall } from '../services/install'
import { closePanel, openManual } from '../services/layout'
import BackupsPanel from './BackupsPanel.vue'
import AppVersion from './AppVersion.vue'

const VIEW_MODES = [
  { id: 'solido', label: 'Sólido', icon: Box },
  { id: 'rayosX', label: 'Rayos X', icon: Eye },
  { id: 'alambrico', label: 'Alambre', icon: Layers }
]

const store = useEditorStore()
</script>
