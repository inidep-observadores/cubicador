<template>
  <aside class="bg-slate-900/95 flex flex-col h-full min-h-0 select-none">
    <!-- Encabezado con buscador / filtro de categorías -->
    <div class="p-3 border-b border-slate-800 space-y-2">
      <div v-if="!embedded" class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <Shapes class="w-4 h-4 text-sky-400" />
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-200">Paleta Naval</h2>
        </div>
        <span class="text-[10px] bg-sky-950 text-sky-400 border border-sky-800/50 px-2 py-0.5 rounded-full font-mono">
          10 Figuras
        </span>
      </div>

      <!-- Filtro de Categorías -->
      <div class="flex gap-1 overflow-x-auto pb-1 text-[11px]">
        <button 
          v-for="cat in categorias" 
          :key="cat"
          @click="selectedCategory = cat"
          :class="selectedCategory === cat ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'"
          class="px-2 py-1 rounded-md transition whitespace-nowrap"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Lista de figuras filtradas -->
    <div class="flex-1 overflow-y-auto p-3" :class="compactCards ? 'grid grid-cols-2 gap-2 content-start' : 'space-y-3'">
      <div 
        v-for="(def, key) in filteredFigures" 
        :key="key"
        class="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/50 rounded-xl p-3 transition shadow-sm group"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-1.5">
              <span v-if="!compactCards" class="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded uppercase font-semibold">
                {{ def.categoria }}
              </span>
              <h3 class="text-xs font-bold text-slate-100 group-hover:text-sky-300 transition">
                {{ def.nombre }}
              </h3>
            </div>
            <p v-if="!compactCards" class="text-[11px] text-slate-400 mt-1 line-clamp-2">
              {{ def.descripcion }}
            </p>
          </div>
        </div>

        <!-- Diagrama SVG de la figura con cotas -->
        <div 
          v-if="def.svgDiagram" 
          v-html="def.svgDiagram" 
          class="my-2 bg-slate-950/80 rounded-lg p-1.5 border border-slate-800/90 flex items-center justify-center overflow-hidden"
        ></div>

        <!-- Fórmula destacada -->
        <div v-if="!compactCards" class="bg-slate-950/90 rounded-md px-2 py-1 text-[11px] font-mono text-amber-300 border border-slate-800/80 text-center">
          {{ def.formula }}
        </div>

        <!-- Botón de inserción directa neutra -->
        <div class="mt-2.5 pt-2 border-t border-slate-700/50">
          <button 
            @click="add(key)"
            class="w-full flex items-center justify-center space-x-1.5 bg-sky-600/90 hover:bg-sky-500 text-white rounded-lg py-2 text-xs font-semibold transition shadow active:scale-95"
            title="Añadir esta figura a la escena de trabajo"
          >
            <Plus class="w-4 h-4 text-sky-200" />
            <span>{{ compactCards ? 'Añadir' : 'Añadir a la Escena' }}</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { layout } from '../services/layout'
import { useEditorStore } from '../stores/editorStore'
import { GEOMETRY_TYPES } from '../services/geometryCatalog'
import { Shapes, Plus, Minus } from 'lucide-vue-next'

const store = useEditorStore()

const props = defineProps({
  // Dentro de un panel deslizable (modo compacto): sin título propio
  embedded: { type: Boolean, default: false }
})
const emit = defineEmits(['added'])

// En el teléfono, tarjetas chicas en dos columnas: dibujo, nombre y botón
const compactCards = computed(() => props.embedded && layout.isPhone)

function add(key) {
  store.addBlockFromPalette(key, 'UNION')
  emit('added')
}

const categorias = ['Todas', 'Básicos', 'Pozos y Rampas', 'Conductos y Columnas', 'Especiales']
const selectedCategory = ref('Todas')

const filteredFigures = computed(() => {
  if (selectedCategory.value === 'Todas') {
    return GEOMETRY_TYPES
  }
  const result = {}
  for (const [key, val] of Object.entries(GEOMETRY_TYPES)) {
    if (val.categoria === selectedCategory.value) {
      result[key] = val
    }
  }
  return result
})
</script>
