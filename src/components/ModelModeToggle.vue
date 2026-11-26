<template>
  <!-- Edición (piezas sueltas) / Vista previa (sólido combinado) -->
  <div class="flex bg-slate-900 border border-slate-700/80 rounded-lg p-0.5" role="group" aria-label="Modo del visor">
    <button
      @click="store.modelMode = 'edicion'"
      :aria-pressed="store.modelMode === 'edicion'"
      :class="store.modelMode === 'edicion' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
      title="Modo Edición: manipular y posicionar bloques individuales"
      aria-label="Edición"
      class="px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5"
    >
      <Layers class="w-3.5 h-3.5" />
      <span v-if="showLabels">Edición</span>
    </button>
    <button
      @click="store.modelMode = 'solidoFinal'"
      :aria-pressed="store.modelMode === 'solidoFinal'"
      :class="store.modelMode === 'solidoFinal' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'"
      title="Modo Vista previa: ver sólido combinado con cortes reales en la malla"
      aria-label="Vista previa"
      class="px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5"
    >
      <Sparkles class="w-3.5 h-3.5 text-amber-300" />
      <span v-if="showLabels">Vista previa</span>
    </button>
  </div>
</template>

<script setup>
import { Layers, Sparkles } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editorStore'

defineProps({ showLabels: { type: Boolean, default: true } })
const store = useEditorStore()
</script>
