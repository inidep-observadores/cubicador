<template>
  <aside class="bg-slate-900/95 flex flex-col h-full min-h-0 select-none">
    <!-- Encabezado de Selección -->
    <div v-if="section === 'todo'" class="p-3 border-b border-slate-800 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <Sliders class="w-4 h-4 text-sky-400" />
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-200">Inspector de Parámetros</h2>
      </div>
      <span 
        v-if="currentBlock" 
        :class="currentBlock.operacion === 'UNION' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'"
        class="text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase"
      >
        {{ currentBlock.operacion === 'UNION' ? '+ Unión' : '- Sustracción' }}
      </span>
    </div>

    <!-- Si no hay bloque seleccionado -->
    <div v-if="section !== 'lista' && !currentBlock" class="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
      <BoxSelect class="w-10 h-10 mb-2 stroke-1 text-slate-600" />
      <p class="text-xs font-medium text-slate-400">Ningún bloque seleccionado</p>
      <p class="text-[11px] text-slate-500 mt-1">{{ emptyHint }}</p>
    </div>

    <!-- Panel de edición del bloque seleccionado -->
    <div v-else-if="section !== 'lista'" class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Nombre y Tipo de Operación -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Identificador</label>
          <span class="text-[10px] font-mono text-sky-400">{{ currentDef?.nombre }}</span>
        </div>
        <input 
          type="text" 
          :value="currentBlock.nombre" 
          @input="updateProp('nombre', $event.target.value)"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500 font-medium"
        />

        <div class="pt-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Rol de la Pieza en el Pozo
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button 
              @click="setOperation('UNION')"
              :class="currentBlock.operacion === 'UNION' 
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 border-sky-400' 
                : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'"
              class="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg border text-xs font-bold transition active:scale-95"
            >
              <Plus class="w-4 h-4 text-sky-200" />
              <span>Sumar (+ Unión)</span>
            </button>

            <button 
              @click="setOperation('SUBSTRACCION')"
              :class="currentBlock.operacion === 'SUBSTRACCION' 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border-rose-400' 
                : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'"
              class="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg border text-xs font-bold transition active:scale-95"
            >
              <Minus class="w-4 h-4 text-rose-200" />
              <span>Restar (- Corte)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Diagrama SVG con cotas de referencia -->
      <div v-if="currentDef?.svgDiagram" class="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cotas de Referencia</div>
        <div v-html="currentDef.svgDiagram" class="flex items-center justify-center"></div>
      </div>

      <!-- Parámetros dimensionales (Metros) -->
      <div class="border-t border-slate-800 pt-3">
        <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
          <span>Medidas Navales</span>
          <span class="text-[10px] text-sky-400 font-mono">(Metros)</span>
        </h3>

        <div class="space-y-2">
          <div 
            v-for="param in currentDef?.params || []" 
            :key="param.key"
            class="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg border border-slate-700/50"
          >
            <label class="text-xs font-medium text-slate-300 flex-1">{{ param.label }}</label>
            <div class="flex items-center space-x-1.5">
              <DecimalInput
                :min="param.min ?? 0.05"
                :step="param.step || 0.1"
                :model-value="currentBlock[param.key]"
                @update:model-value="updateProp(param.key, $event)"
                class="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-sm text-sky-300 font-mono focus:outline-none focus:border-sky-500"
              />
              <span class="text-xs text-slate-500 font-mono w-4">m</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Posicionamiento 3D -->
      <div class="border-t border-slate-800 pt-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Ubicación en Bodega
          </h3>
          <span class="text-[10px] text-slate-500 font-mono">Paso 0.01m</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50 text-center">
            <span class="text-[10px] text-slate-400 font-mono block">Eje X (Eslora)</span>
            <DecimalInput
              :step="0.01"
              :model-value="currentBlock.pos_x"
              @update:model-value="updateProp('pos_x', $event)"
              class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50 text-center">
            <span class="text-[10px] text-slate-400 font-mono block">Eje Y (Puntal)</span>
            <DecimalInput
              :step="0.01"
              :model-value="currentBlock.pos_y"
              @update:model-value="updateProp('pos_y', $event)"
              class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50 text-center">
            <span class="text-[10px] text-slate-400 font-mono block">Eje Z (Manga)</span>
            <DecimalInput
              :step="0.01"
              :model-value="currentBlock.pos_z"
              @update:model-value="updateProp('pos_z', $event)"
              class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <!-- Orientación / Rotación -->
      <div class="border-t border-slate-800 pt-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Orientación y Giro
          </h3>
          <span class="text-[10px] text-sky-400 font-mono">(Grados °)</span>
        </div>

        <!-- Botones de Giro Rápido de 90° -->
        <div class="flex gap-1.5 mb-2.5">
          <button 
            @click="rotateBy('rot_y', 90)"
            title="Girar 90° horizontal en el piso (Eje Y)"
            class="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 py-1 rounded-lg text-xs font-mono transition"
          >
            <RotateCw class="w-3 h-3" />
            <span>+90° Piso</span>
          </button>
          <button 
            @click="rotateBy('rot_x', 90)"
            title="Girar 90° frontal (Eje X)"
            class="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-1 rounded-lg text-xs font-mono transition"
          >
            <RotateCw class="w-3 h-3" />
            <span>+90° Frente</span>
          </button>
          <button 
            @click="resetRotation"
            title="Restablecer rotación a 0°"
            class="px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white py-1 rounded-lg text-xs transition"
          >
            0°
          </button>
        </div>

        <!-- Inputs numéricos en grados -->
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50 text-center">
            <span class="text-[10px] text-slate-400 font-mono block">Giro X</span>
            <div class="flex items-center justify-center gap-0.5">
              <DecimalInput
                :step="15"
                :model-value="getAngleDegrees('rot_x')"
                @update:model-value="setAngleDegrees('rot_x', $event)"
                class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs text-white font-mono"
              />
              <span class="text-[10px] text-slate-500">°</span>
            </div>
          </div>
          <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50 text-center">
            <span class="text-[10px] text-slate-400 font-mono block">Giro Y (Planta)</span>
            <div class="flex items-center justify-center gap-0.5">
              <DecimalInput
                :step="15"
                :model-value="getAngleDegrees('rot_y')"
                @update:model-value="setAngleDegrees('rot_y', $event)"
                class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs text-white font-mono"
              />
              <span class="text-[10px] text-slate-500">°</span>
            </div>
          </div>
          <div class="bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50 text-center">
            <span class="text-[10px] text-slate-400 font-mono block">Giro Z</span>
            <div class="flex items-center justify-center gap-0.5">
              <DecimalInput
                :step="15"
                :model-value="getAngleDegrees('rot_z')"
                @update:model-value="setAngleDegrees('rot_z', $event)"
                class="w-full bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs text-white font-mono"
              />
              <span class="text-[10px] text-slate-500">°</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta de Desglose Matemático y Volumen -->
      <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Volumen Calculado</span>
          <span class="text-[10px] text-slate-500 font-mono">{{ currentDef?.formula }}</span>
        </div>
        
        <!-- Fórmula con números reemplazados paso a paso -->
        <div class="bg-slate-900/90 rounded-lg p-2 font-mono text-xs text-amber-300 border border-slate-800/80">
          {{ explanationText }}
        </div>

        <div class="flex items-baseline justify-between pt-1">
          <span class="text-xs text-slate-400">Volumen de esta pieza:</span>
          <span class="text-lg font-extrabold font-mono text-sky-400">
            {{ currentBlock.volumen_individual?.toFixed(2) || '0.00' }} m³
          </span>
        </div>
      </div>

      <!-- Acciones Duplicar / Eliminar -->
      <div class="flex space-x-2 pt-2 border-t border-slate-800">
        <button 
          @click="store.duplicateBlock(currentBlock.id)"
          class="flex-1 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 py-1.5 rounded-lg text-xs font-semibold transition"
        >
          <Copy class="w-3.5 h-3.5 text-sky-400" />
          <span>Duplicar</span>
        </button>
        <button 
          @click="store.deleteBlock(currentBlock.id)"
          class="flex-1 flex items-center justify-center space-x-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 py-1.5 rounded-lg text-xs font-semibold transition"
        >
          <Trash2 class="w-3.5 h-3.5 text-rose-400" />
          <span>Eliminar</span>
        </button>
      </div>
    </div>

    <!-- Lista inferior / Capas de piezas del pozo -->
    <div
      v-if="section !== 'editor'"
      class="bg-slate-950/90 p-3 overflow-y-auto"
      :class="section === 'lista' ? 'flex-1' : 'border-t border-slate-800 max-h-56'"
    >
      <div v-if="section === 'todo'" class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
        Componentes del Pozo ({{ store.bloques.length }})
      </div>
      <div class="flex items-center gap-1 mb-2">
        <button
          @click="store.showAllBlocks()"
          :disabled="hiddenCount === 0"
          title="Mostrar todas las piezas"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <Eye class="w-3 h-3" />
          Mostrar todo
        </button>
        <button
          @click="store.hideAllBlocks()"
          :disabled="hiddenCount === store.bloques.length"
          title="Ocultar todas las piezas"
          class="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          <EyeOff class="w-3 h-3" />
          Ocultar todo
        </button>
      </div>

      <p v-if="hiddenCount > 0" class="text-[10px] text-amber-400/90 mb-1.5">
        {{ hiddenCount === 1 ? '1 pieza oculta' : hiddenCount + ' piezas ocultas' }}:
        {{ store.modelMode === 'solidoFinal' ? 'la Vista previa muestra el sólido completo.' : 'igual cuentan en el volumen.' }}
      </p>

      <div class="space-y-1">
        <div
          v-for="b in store.bloques"
          :key="b.id"
          @click="pick(b.id)"
          :class="b.id === store.selectedBlockId ? 'bg-sky-600/30 border-sky-500 text-white' : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'"
          class="flex items-center px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition"
          :style="{ minHeight: layout.isTouch ? '40px' : undefined }"
          
        >
          <button
            @click.stop="store.toggleBlockVisibility(b.id)"
            :title="isHidden(b.id) ? 'Mostrar en el visor' : 'Ocultar en el visor'"
            :aria-label="(isHidden(b.id) ? 'Mostrar ' : 'Ocultar ') + b.nombre"
            class="shrink-0 mr-2 -ml-1 p-0.5 rounded hover:bg-slate-700 transition"
            :class="isHidden(b.id) ? 'text-slate-500' : 'text-slate-300'"
          >
            <EyeOff v-if="isHidden(b.id)" class="w-3.5 h-3.5" />
            <Eye v-else class="w-3.5 h-3.5" />
          </button>
          <div class="flex flex-1 items-center space-x-2 truncate" :class="{ 'opacity-40': isHidden(b.id) }">
            <span :class="b.operacion === 'UNION' ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold'">
              {{ b.operacion === 'UNION' ? '+' : '-' }}
            </span>
            <span class="truncate font-medium">{{ b.nombre }}</span>
          </div>
          <span class="text-[10px] font-mono text-slate-400 ml-2">
            {{ b.volumen_individual?.toFixed(2) }} m³
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import { GEOMETRY_TYPES } from '../services/geometryCatalog'
import DecimalInput from './DecimalInput.vue'
import { layout } from '../services/layout'
import { Sliders, BoxSelect, Copy, Trash2, RotateCw, Plus, Minus, Eye, EyeOff } from 'lucide-vue-next'

const store = useEditorStore()

const props = defineProps({
  // 'todo': columna de escritorio · 'editor': solo la pieza seleccionada ·
  // 'lista': solo los componentes del pozo (paneles del modo compacto)
  section: { type: String, default: 'todo' }
})
const emit = defineEmits(['picked'])

const emptyHint = computed(() => props.section === 'todo'
  ? 'Haz clic en una pieza del visor 3D o agrégala desde la paleta izquierda.'
  : 'Tocá una pieza en el visor o en "Piezas", o agregá una desde "Figuras".')

function pick(id) {
  store.selectedBlockId = id
  emit('picked', id)
}

const currentBlock = computed(() => store.selectedBlock)
const isHidden = id => store.hiddenBlockIds.includes(id)
const hiddenCount = computed(() => store.bloques.filter(b => isHidden(b.id)).length)
const currentDef = computed(() => currentBlock.value ? GEOMETRY_TYPES[currentBlock.value.tipo_figura] : null)

const explanationText = computed(() => {
  if (!currentBlock.value || !currentDef.value) return ''
  return currentDef.value.explainCalculation ? currentDef.value.explainCalculation(currentBlock.value) : ''
})

function setOperation(op) {
  if (currentBlock.value) store.setBlockOperation(currentBlock.value.id, op)
}

function updateProp(prop, val) {
  if (currentBlock.value) {
    store.updateBlockProperty(currentBlock.value.id, prop, val)
  }
}

function getAngleDegrees(prop) {
  if (!currentBlock.value) return 0
  const rad = currentBlock.value[prop] || 0
  return Math.round(((rad * 180) / Math.PI) * 10000) / 10000
}

function setAngleDegrees(prop, deg) {
  if (!currentBlock.value) return
  const rad = (deg * Math.PI) / 180
  store.updateBlockProperty(currentBlock.value.id, prop, rad)
  store.saveBloquesToDb()
}

function rotateBy(prop, degDelta) {
  if (!currentBlock.value) return
  const currentDeg = getAngleDegrees(prop)
  const newDeg = (currentDeg + degDelta) % 360
  setAngleDegrees(prop, newDeg)
  store.pushHistoryState()
}

function resetRotation() {
  if (!currentBlock.value) return
  store.updateBlockProperty(currentBlock.value.id, 'rot_x', 0)
  store.updateBlockProperty(currentBlock.value.id, 'rot_y', 0)
  store.updateBlockProperty(currentBlock.value.id, 'rot_z', 0)
  store.saveBloquesToDb()
  store.pushHistoryState()
}
</script>
