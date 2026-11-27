<template>
  <!-- Antes de exportar: elegir el fondo de la imagen -->
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
    @mousedown.self="emit('close')"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-image-title"
      class="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4"
      @keydown.esc.prevent="emit('close')"
    >
      <h2 id="export-image-title" class="text-base font-bold text-slate-100">Exportar imagen</h2>
      <p class="text-sm text-slate-300">
        Se guarda un PNG con la vista actual del pozo: misma cámara, zoom, estilo y cotas. ¿Con qué fondo?
      </p>

      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="o in OPTIONS"
          :key="o.id"
          :ref="el => { if (o.id === 'claro') firstOption = el }"
          type="button"
          @click="emit('pick', o.id)"
          class="rounded-lg border border-slate-700 hover:border-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 p-2 space-y-2 transition"
        >
          <span class="flex h-14 items-center justify-center rounded border border-slate-700" :style="{ background: o.theme.background }" aria-hidden="true">
            <span class="font-mono font-bold text-xs" :style="{ color: o.theme.dimensions.total }">5,00 m</span>
          </span>
          <span class="block text-sm font-semibold text-slate-100">{{ o.label }}</span>
        </button>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { IMAGE_THEMES } from '../services/exportImage'

const emit = defineEmits(['pick', 'close'])

const OPTIONS = [
  { id: 'claro', label: 'Fondo claro', theme: IMAGE_THEMES.claro },
  { id: 'oscuro', label: 'Fondo oscuro', theme: IMAGE_THEMES.oscuro }
]

let firstOption = null
let previousFocus = null
onMounted(() => {
  previousFocus = document.activeElement
  firstOption?.focus()
})
onBeforeUnmount(() => previousFocus?.focus?.())
</script>
