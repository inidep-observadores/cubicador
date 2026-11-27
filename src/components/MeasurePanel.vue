<template>
  <!-- Herramienta Medir: qué se mide y la lista de cotas puestas a mano en el pozo -->
  <div class="bg-slate-900/95 backdrop-blur border border-emerald-500/40 rounded-xl shadow-lg text-xs text-slate-300 p-2 space-y-2">
    <div class="flex items-center justify-between gap-3">
      <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Medir</span>
      <p v-if="layout.isPhone" class="flex-1 text-[11px] text-slate-400" aria-live="polite">{{ hint }}</p>
      <!-- En el teléfono la lista se despliega a pedido, para no tapar el pozo -->
      <button
        v-if="layout.isPhone && store.cotas.length"
        @click="listOpen = !listOpen"
        :aria-expanded="listOpen"
        class="text-[11px] font-medium text-emerald-300 underline underline-offset-2 py-1"
      >{{ listOpen ? 'Ocultar' : 'Cotas (' + store.cotas.length + ')' }}</button>
      <button
        @click="store.measureMode = false"
        title="Salir de Medir (Esc)"
        aria-label="Salir de Medir"
        class="text-slate-500 hover:text-white rounded transition p-1"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <p v-if="!layout.isPhone" class="text-[11px] text-slate-400" aria-live="polite">{{ hint }}</p>

    <div class="grid grid-cols-4 gap-0.5 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
      <button
        v-for="e in EJES"
        :key="e.id"
        @click="store.measureAxis = e.id"
        :title="e.title"
        :aria-pressed="store.measureAxis === e.id"
        :class="[store.measureAxis === e.id ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white', layout.isTouch ? 'py-2' : 'py-1']"
        class="px-1.5 rounded font-medium transition"
      >{{ e.label }}</button>
    </div>

    <ul v-if="store.cotas.length && showList" class="space-y-1 overflow-y-auto" :class="layout.isPhone ? 'max-h-28' : 'max-h-48'">
      <li
        v-for="(c, i) in store.cotas"
        :key="c.id"
        class="flex items-center justify-between gap-2 bg-slate-800/60 rounded px-2 py-1 font-mono"
      >
        <span class="text-slate-500">{{ i + 1 }}. {{ nombreEje(c.eje) }}</span>
        <span class="flex items-center gap-1">
          <strong class="text-emerald-300">{{ formatMeters(manualDimension(c).value) }}</strong>
          <button
            @click="store.deleteCota(c.id)"
            :title="'Borrar la cota ' + (i + 1)"
            :aria-label="'Borrar la cota ' + (i + 1)"
            class="text-slate-500 hover:text-rose-400 rounded transition"
            :class="layout.isTouch ? 'p-1.5' : 'p-0.5'"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </span>
      </li>
    </ul>

    <button
      v-if="store.cotas.length > 1 && showList"
      @click="store.clearCotas()"
      class="w-full text-[11px] text-slate-400 hover:text-rose-400 transition"
    >Borrar todas</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { X, Trash2 } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editorStore'
import { manualDimension, formatMeters } from '../services/dimensions'
import { layout } from '../services/layout'

const props = defineProps({ pending: Boolean })

const hint = computed(() => props.pending ? 'Ahora tocá el segundo punto.' : 'Tocá el primer punto.')
const listOpen = ref(false)
const showList = computed(() => !layout.isPhone || listOpen.value)

const EJES = [
  { id: '', label: 'Directa', title: 'La distancia en línea recta entre los dos puntos' },
  { id: 'x', label: 'Eslora', title: 'Solo la distancia a lo largo (eje X)' },
  { id: 'y', label: 'Puntal', title: 'Solo la distancia en altura (eje Y)' },
  { id: 'z', label: 'Manga', title: 'Solo la distancia a lo ancho (eje Z)' }
]
const nombreEje = (eje) => EJES.find(e => e.id === (eje || ''))?.label

const store = useEditorStore()
</script>
