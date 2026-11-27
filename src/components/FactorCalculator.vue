<template>
  <!-- Obtener el factor de una captura conocida, sin hacer la cuenta aparte -->
  <div class="space-y-2">
    <button
      type="button"
      :aria-expanded="open"
      @click="toggle"
      class="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 py-1"
    >
      <Calculator class="w-4 h-4" />
      Calcular a partir de una captura
    </button>

    <div v-if="open" class="rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-2" @keydown.enter="onEnter">
      <div class="grid grid-cols-2 gap-2">
        <label class="block space-y-1">
          <span class="text-xs font-medium text-slate-400">Captura (kg)</span>
          <input ref="kgRef" v-model="kgText" type="text" inputmode="decimal" autocomplete="off" :class="FIELD" />
        </label>
        <label class="block space-y-1">
          <span class="text-xs font-medium text-slate-400">Volumen ocupado (m³)</span>
          <input v-model="m3Text" type="text" inputmode="decimal" autocomplete="off" :class="FIELD" />
        </label>
      </div>

      <button
        v-if="volume"
        type="button"
        @click="m3Text = volume.text"
        class="text-[11px] text-sky-400 hover:text-sky-300 underline text-left"
      >
        Usar el volumen de {{ volume.name }}: {{ volume.text }} m³
      </button>

      <p class="text-[11px] text-slate-500">
        Si el pozo no quedó lleno, poné solo el volumen ocupado. Con varios pozos o mareas, sumá los kg y los m³.
      </p>

      <div class="flex items-center justify-between gap-2" aria-live="polite">
        <span v-if="factor" class="text-sm text-slate-200">
          {{ formatDecimal(kg / 1000) }} t ÷ {{ formatDecimal(m3) }} m³ =
          <strong class="font-mono text-emerald-400">{{ formatDecimal(factor) }} t/m³</strong>
        </span>
        <span v-else class="text-xs text-slate-500">Completá los dos valores.</span>
        <button
          type="button"
          :disabled="!factor"
          @click="apply"
          class="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Usar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { Calculator } from 'lucide-vue-next'
import { parseDecimal, formatDecimal } from '../services/decimal'
import { parseKg, captureFactor } from '../services/factor'

const FIELD = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 select-text'

defineProps({
  // Pozo abierto, para no tener que copiar su volumen: { name, text } o null
  volume: { type: Object, default: null }
})
const emit = defineEmits(['use'])

const open = ref(false)
const kgRef = ref(null)
const kgText = ref('')
const m3Text = ref('')

const kg = computed(() => parseKg(kgText.value))
const m3 = computed(() => parseDecimal(m3Text.value))
const factor = computed(() => captureFactor(kg.value, m3.value))

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  kgRef.value?.focus()
}

function apply() {
  if (!factor.value) return
  emit('use', factor.value)
  open.value = false
}

// Enter dentro de la calculadora usa el resultado; no guarda el formulario
function onEnter(event) {
  if (event.target.tagName !== 'INPUT') return
  event.preventDefault()
  apply()
}
</script>
