<template>
  <div class="relative w-full h-full overflow-hidden bg-slate-950" ref="containerRef">
    <!-- Canvas Three.js (touch-none: los gestos son del visor, no de la página) -->
    <canvas ref="canvasRef" class="w-full h-full block outline-none cursor-grab active:cursor-grabbing touch-none"></canvas>

    <DimensionOverlay :shapes="overlayShapes" :markers="overlayMarkers" />

    <!-- Medir: en escritorio arriba a la derecha (junto al botón de ayuda); en el
         teléfono sobre los controles -->
    <MeasurePanel
      v-if="store.measureMode"
      :pending="!!measureStart"
      class="absolute z-20"
      :class="layout.isPhone ? 'bottom-16 left-2 right-2' : (layout.isCompact ? 'top-2 right-[3.25rem] w-60' : 'top-4 right-14 w-64')"
    />

    <!-- Vista previa: guardar lo que se ve como imagen (debajo del botón de ayuda) -->
    <button
      v-if="store.modelMode === 'solidoFinal'"
      @click="exportOpen = true"
      title="Exportar la vista como imagen PNG"
      aria-label="Exportar imagen"
      class="absolute z-10 flex items-center justify-center rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-emerald-400 hover:text-white hover:bg-slate-800 shadow-lg transition"
      :class="[layout.isCompact ? 'top-[3.25rem] right-2' : 'top-14 right-4', layout.isTouch ? 'w-9 h-9' : 'w-8 h-8']"
    >
      <ImageDown class="w-4 h-4" />
    </button>
    <ExportImageDialog v-if="exportOpen" @pick="exportImage" @close="exportOpen = false" />

    <!-- Medida en vivo mientras se estira -->
    <div
      v-if="stretchLabel"
      class="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full bg-amber-400 text-slate-950 font-mono font-bold text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap"
      :style="{ left: stretchLabel.x + 'px', top: stretchLabel.y - 14 + 'px' }"
    >{{ stretchLabel.text }}</div>
    <div
      v-else-if="stretchHint"
      class="absolute z-20 left-1/2 -translate-x-1/2 bottom-16 pointer-events-none bg-slate-900/90 border border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg text-center max-w-[90%]"
    >{{ stretchHint }}</div>

    <!-- Esquina superior izquierda, apilado: modo (compacto), ayuda y ejes -->
    <div
      class="absolute z-10 flex flex-col items-start gap-2 pointer-events-none"
      :class="layout.isCompact ? 'top-2 left-2' : 'top-4 left-4'"
    >
      <ModelModeToggle v-if="layout.isCompact" :show-labels="!layout.isShort" class="pointer-events-auto" />

      <!-- Ayuda plegable: controles del mouse y orientación de los ejes -->
      <div v-if="!layout.isPhone" class="pointer-events-auto bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg text-slate-400">
        <button
          @click="toggleHelp"
          :aria-expanded="helpOpen"
          aria-controls="viewport-help"
          :title="helpOpen ? 'Ocultar la ayuda' : 'Mostrar la ayuda'"
          class="w-full flex items-center gap-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider hover:text-white transition rounded-lg"
          :class="layout.isTouch ? 'py-2' : 'py-1'"
        >
          <CircleHelp class="w-3.5 h-3.5 text-sky-400" />
          Ayuda
          <ChevronDown class="w-3.5 h-3.5 ml-auto transition-transform" :class="{ '-rotate-90': !helpOpen }" />
        </button>

        <div v-show="helpOpen" id="viewport-help" class="border-t border-slate-800 px-2.5 py-1.5 space-y-1">
          <!-- Controles del mouse (solo escritorio sin pantalla táctil) -->
          <div v-if="layout.isWide && !layout.isTouch" class="text-[11px] flex items-center gap-3">
            <span>🖱️ <strong>Click Izq:</strong> Orbitar</span>
            <span>🖱️ <strong>Click Der:</strong> Paneo</span>
            <span>📜 <strong>Rueda:</strong> Zoom</span>
            <span>🎯 <strong>Click Pieza:</strong> Seleccionar</span>
          </div>

          <!-- Indicador náutico de orientación -->
          <div class="text-[10px] flex items-center gap-2 font-mono">
            <span class="text-rose-400 font-bold">X: Eslora{{ layout.isWide ? ' (Proa)' : '' }}</span>
            <span class="text-slate-600">|</span>
            <span class="text-emerald-400 font-bold">Y: Puntal</span>
            <span class="text-slate-600">|</span>
            <span class="text-sky-400 font-bold">Z: Manga{{ layout.isWide ? ' (Babor/Estribor)' : '' }}</span>
          </div>

          <button
            @click="openManual()"
            class="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 transition"
            :class="layout.isTouch ? 'py-1.5' : ''"
          >
            <BookOpen class="w-3.5 h-3.5" />
            Manual de uso completo{{ layout.isTouch ? '' : ' (F1)' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cotas del bloque seleccionado: editables, solo las medidas de su figura.
         En el teléfono se editan desde el panel "Editar" -->
    <div
      v-if="store.showDimensions && !store.measureMode && store.selectedBlock && selectedDef && !layout.isPhone"
      class="absolute z-20 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl shadow-lg font-mono text-xs text-slate-300 space-y-1"
      :class="layout.isCompact ? 'top-2 right-[3.25rem] p-2' : 'top-4 right-14 p-3'"
    >
      <div class="text-[10px] font-bold uppercase tracking-wider text-sky-400 font-sans mb-1">
        {{ layout.isCompact ? 'Cotas' : 'Cotas del Bloque Seleccionado' }}
        <span v-if="store.selectedBlock.fijada" class="text-amber-400">· fijada</span>
      </div>
      <label
        v-for="param in selectedDef.params"
        :key="store.selectedBlock.id + param.key"
        class="flex items-center justify-between gap-3"
      >
        <span class="text-slate-400">{{ param.label }}:</span>
        <span class="flex items-center gap-1">
          <DecimalInput
            :disabled="store.selectedBlock.fijada"
            :min="param.min"
            :step="param.step"
            :model-value="store.selectedBlock[param.key]"
            @update:model-value="store.updateBlockProperty(store.selectedBlock.id, param.key, $event)"
            class="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-right font-bold text-amber-300 focus:outline-none focus:border-sky-500 disabled:opacity-50"
          />
          <span class="text-slate-500">m</span>
        </span>
      </label>
    </div>

    <!-- Controles flotantes: cámara, mover/rotar e imán -->
    <div
      class="absolute z-10 flex items-center bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl shadow-lg overflow-x-auto max-w-[calc(100%-1rem)] [scrollbar-width:none]"
      :class="layout.isCompact ? 'bottom-2 left-2 gap-1 p-1' : 'bottom-4 left-4 gap-2 p-1.5'"
    >
      <button
        @click="resetCamera"
        title="Restablecer Vista Isométrica (Esquina Superior Babor-Proa)"
        aria-label="Centrar la vista"
        class="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
        :class="btnPad"
      >
        <Compass class="w-4 h-4 text-sky-400" />
        <span v-if="!layout.isCompact">Centrar</span>
      </button>

      <div v-if="!layout.isPhone" class="shrink-0 h-4 w-px bg-slate-800"></div>

      <!-- Vistas ortogonales estándar con terminología náutica -->
      <button
        v-for="v in CAMERA_VIEWS"
        :key="v.id"
        @click="setCameraView(v.id)"
        :title="v.title"
        class="shrink-0 text-xs font-mono text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition"
        :class="btnPad"
      >
        {{ v.label }}
      </button>

      <div v-if="!layout.isPhone" class="shrink-0 h-4 w-px bg-slate-800"></div>

      <!-- Modo de manipulación de bloque (Mover / Rotar) -->
      <div class="shrink-0 flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button
          @click="setTransformMode('translate')"
          :class="[activeMode === 'translate' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white', btnPad]"
          title="Modo Mover (Tecla W o G)"
          aria-label="Mover"
          :aria-pressed="activeMode === 'translate'"
          class="text-xs font-medium rounded transition flex items-center gap-1"
        >
          <Move3d class="w-3.5 h-3.5" />
          <span v-if="layout.isWide">Mover (W)</span>
        </button>
        <button
          @click="setTransformMode('rotate')"
          :class="[activeMode === 'rotate' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white', btnPad]"
          title="Modo Rotar (Tecla R o E)"
          aria-label="Rotar"
          :aria-pressed="activeMode === 'rotate'"
          class="text-xs font-medium rounded transition flex items-center gap-1"
        >
          <RotateCw class="w-3.5 h-3.5" />
          <span v-if="layout.isWide">Rotar (R)</span>
        </button>
        <button
          @click="setTransformMode('stretch')"
          :class="[activeMode === 'stretch' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white', btnPad]"
          title="Modo Estirar: arrastrar una cara para cambiar su medida (Tecla S)"
          aria-label="Estirar"
          :aria-pressed="activeMode === 'stretch'"
          class="text-xs font-medium rounded transition flex items-center gap-1"
        >
          <MoveDiagonal class="w-3.5 h-3.5" />
          <span v-if="layout.isWide">Estirar (S)</span>
        </button>
      </div>

      <!-- Espejo: abre la elección del eje -->
      <button
        @click="mirrorOpen = !mirrorOpen"
        :class="[mirrorOpen ? 'text-sky-300 bg-sky-500/10 border-sky-500/40' : 'text-slate-400 hover:text-white border-transparent hover:border-slate-700', btnPad]"
        title="Espejar la pieza seleccionada sobre un eje (Tecla M)"
        aria-label="Espejo"
        :aria-expanded="mirrorOpen"
        aria-controls="viewport-mirror"
        class="shrink-0 text-xs font-medium rounded-lg border transition flex items-center gap-1"
      >
        <FlipHorizontal2 class="w-3.5 h-3.5" />
        <span v-if="layout.isWide">Espejo (M)</span>
      </button>

      <!-- Medir: cotas entre dos puntos -->
      <button
        @click="store.toggleMeasureMode()"
        :class="[store.measureMode ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40' : 'text-slate-400 hover:text-white border-transparent hover:border-slate-700', btnPad]"
        title="Medir: poner cotas entre dos puntos (Tecla D)"
        aria-label="Medir"
        :aria-pressed="store.measureMode"
        class="shrink-0 text-xs font-medium rounded-lg border transition flex items-center gap-1"
      >
        <PencilRuler class="w-3.5 h-3.5" />
        <span v-if="layout.isWide">Medir (D)</span>
      </button>

      <!-- Alternar Imán / Snap (en el teléfono está en el menú Más) -->
      <button
        v-if="!layout.isPhone"
        @click="store.snapToGrid = !store.snapToGrid"
        :class="[store.snapToGrid ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300', btnPad]"
        title="Ajuste Magnético a la Cuadrícula (Snap 0.25m)"
        aria-label="Imán"
        :aria-pressed="store.snapToGrid"
        class="shrink-0 rounded-lg border border-transparent hover:border-slate-700 transition"
      >
        <Magnet class="w-4 h-4" />
      </button>
    </div>

    <!-- Espejo: elegir el eje -->
    <div
      v-if="mirrorOpen"
      id="viewport-mirror"
      class="absolute z-10 flex flex-wrap items-center gap-1.5 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-lg p-1.5 max-w-[calc(100%-1rem)]"
      :class="layout.isCompact ? 'left-2 ' + (layout.isTouch ? 'bottom-16' : 'bottom-12') : 'left-4 bottom-16'"
    >
      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
        {{ mirrorBlocked || 'Espejar sobre' }}
      </span>
      <button
        v-for="eje in EJES_ESPEJO"
        :key="eje.axis"
        @click="mirrorSelected(eje.axis)"
        :disabled="!!mirrorBlocked"
        :title="'Espejar en ' + eje.nombre + ' (' + eje.detalle + '). Tecla ' + eje.label"
        class="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-mono transition disabled:opacity-40 disabled:pointer-events-none"
        :class="btnPad"
      >
        <span class="font-bold" :class="MIRROR_COLOR[eje.axis]">{{ eje.label }}</span>
        <span class="text-slate-300">{{ eje.nombre }}</span>
      </button>
      <button
        @click="mirrorOpen = false"
        title="Cerrar"
        aria-label="Cerrar Espejo"
        class="text-slate-500 hover:text-white rounded transition"
        :class="btnPad"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useEditorStore } from '../stores/editorStore'
import { GEOMETRY_TYPES } from '../services/geometryCatalog'
import { snapBlockToBounds } from '../services/csgService'
import { computeComposite } from '../services/csgClient'
import { confirmDialog, alertDialog, dialogState } from '../services/dialog'
import { IMAGE_THEMES, exportScale, paintDimensions, imageFileName, downloadCanvas } from '../services/exportImage'
import ExportImageDialog from './ExportImageDialog.vue'
import DecimalInput from './DecimalInput.vue'
import { formatDecimal } from '../services/decimal'
import ModelModeToggle from './ModelModeToggle.vue'
import { layout, openManual } from '../services/layout'
import { Compass, Move3d, Magnet, RotateCw, MoveDiagonal, CircleHelp, ChevronDown, FlipHorizontal2, X, BookOpen, PencilRuler, ImageDown } from 'lucide-vue-next'
import { getHandles, singleAxisHandles, supportsStretch, dragDistance, resolveStretch } from '../services/stretch'
import { EJES_ESPEJO } from '../services/mirror'
import { autoDimensions, manualDimension, toScreenShapes, snapPoint, findCorners, boundsOf } from '../services/dimensions'
import DimensionOverlay from './DimensionOverlay.vue'
import MeasurePanel from './MeasurePanel.vue'

const store = useEditorStore()
const containerRef = ref(null)
const canvasRef = ref(null)

// Ayuda del visor: abierta por defecto; se recuerda si el usuario la pliega
const HELP_KEY = 'cubicacion_ayuda_visor'
function readHelpPreference() {
  try {
    return localStorage.getItem(HELP_KEY) !== 'cerrada'
  } catch {
    return true
  }
}
const helpOpen = ref(readHelpPreference())
function toggleHelp() {
  helpOpen.value = !helpOpen.value
  try {
    localStorage.setItem(HELP_KEY, helpOpen.value ? 'abierta' : 'cerrada')
  } catch {
    // sin almacenamiento: solo dura esta sesión
  }
}

const CAMERA_VIEWS = [
  { id: 'top', label: 'Planta', title: 'Vista en Planta (Cubierta superior)' },
  { id: 'front', label: 'Frente', title: 'Vista Frente: mirando la pared transversal (de Estribor a Babor) desde Proa hacia Popa' },
  { id: 'side', label: 'Lateral', title: 'Vista Lateral: mirando desde Babor hacia Estribor (perfil longitudinal de Eslora)' }
]
// Botones más grandes con pantalla táctil
const btnPad = computed(() => layout.isTouch ? (layout.isPhone ? 'px-1.5 py-2' : 'px-2.5 py-2') : 'px-2 py-1')

// Un toque o clic corto selecciona; si el puntero se mueve (orbitar) no
const TAP_MAX_MOVE_PX = 8
const TAP_MAX_MS = 600
let tapStart = null

const selectedDef = computed(() => GEOMETRY_TYPES[store.selectedBlock?.tipo_figura] || null)

// Espejo
const mirrorOpen = ref(false)
const MIRROR_COLOR = { x: 'text-rose-400', y: 'text-emerald-400', z: 'text-sky-400' }
const mirrorBlocked = computed(() => {
  if (store.measureMode) return 'Salí de Medir'
  if (store.modelMode !== 'edicion') return 'Solo en Edición'
  if (!store.selectedBlock) return 'Seleccioná una pieza'
  if (store.selectedBlock.fijada) return 'Pieza fijada'
  return ''
})
function mirrorSelected(axis) {
  if (mirrorBlocked.value) return
  store.mirrorBlock(store.selectedBlock.id, axis)
}

let scene, camera, renderer, orbitControls, transformControls, resizeObserver
// Piso y ejes; la imagen con fondo claro usa los suyos
let screenDecor, lightDecor
const exportOpen = ref(false)
const blockMeshGroup = new THREE.Group()
const csgMeshGroup = new THREE.Group()
const edgesGroup = new THREE.Group()
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

let isDraggingGizmo = false

// Modo Estirar
const handlesGroup = new THREE.Group()
const faceHighlightGroup = new THREE.Group()
let stretchDrag = null // { start, handle, point, dir, d0, pointerId }
const stretchLabel = ref(null) // { text, x, y } mientras se arrastra
const handleGeometry = new THREE.SphereGeometry(1, 16, 12)
const handleMaterial = new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false, transparent: true })
// Tirador del vértice (piramidal): otro color, porque corre el vértice sin cambiar el volumen
const handleVertexMaterial = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false, transparent: true })
const handleActiveMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })
const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, depthTest: false })

const stretchHint = computed(() => {
  if (store.transformMode !== 'stretch' || store.modelMode !== 'edicion' || store.measureMode) return ''
  const b = store.selectedBlock
  if (!b) return 'Seleccioná una pieza para estirarla.'
  if (b.fijada) return 'La pieza está fijada: liberala para estirarla.'
  if (!supportsStretch(b)) return 'Esta figura todavía no se puede estirar: usá las cotas.'
  return ''
})
let csgRenderToken = 0
// Pieza seleccionada en la escena, para actualizarla en el arrastre sin reconstruir todo
let selectedParts = null // { mesh, edges }

// Cotas en pantalla
const overlayShapes = shallowRef([])
const overlayMarkers = shallowRef([])
const dimensionData = new WeakMap() // geometría → { min, max, corners }
// Cuerpo que se acota solo: la pieza seleccionada (edición) o el pozo (vista previa)
let dimensionTarget = null // { geometry, object }
// Primer punto elegido con Medir y punto bajo el puntero
const measureStart = shallowRef(null)
let measureHover = null

// Botón activo de Mover / Rotar / Estirar (ninguno mientras se mide)
const activeMode = computed(() => store.measureMode ? null : store.transformMode)
function setTransformMode(mode) {
  store.measureMode = false
  store.transformMode = mode
}

onMounted(() => {
  initThree()
  renderBlocks()
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  resizeObserver?.disconnect()
  canvasRef.value?.removeEventListener('pointerdown', onPointerDown)
  canvasRef.value?.removeEventListener('pointerup', onPointerUp)
  canvasRef.value?.removeEventListener('pointermove', onMeasureMove)
  containerRef.value?.removeEventListener('pointerdown', onHandleDown, true)
  stopStretch()
  clearHighlight()
  handleGeometry.dispose()
  handleMaterial.dispose()
  handleVertexMaterial.dispose()
  handleActiveMaterial.dispose()
  highlightMaterial.dispose()
  clearScene()
  disposeCaches()
  for (const decor of [screenDecor, lightDecor]) {
    decor?.children.forEach(o => { o.geometry.dispose(); o.material.dispose() })
  }
  transformControls?.dispose()
  orbitControls?.dispose()
  renderer?.dispose()
})

// ---------------------------------------------------------------------------
// Dibujo bajo demanda: solo se renderiza cuando algo cambia (cámara, piezas,
// gizmo). Antes se dibujaba 60 veces por segundo aunque la escena estuviera quieta.
// ---------------------------------------------------------------------------
let renderRequested = false

function requestRender() {
  if (renderRequested || !renderer) return
  renderRequested = true
  requestAnimationFrame(renderFrame)
}

function renderFrame() {
  renderRequested = false
  // Con amortiguación, la cámara sigue moviéndose unos cuadros después de soltar
  const cameraMoved = orbitControls.update()
  scaleHandles()
  renderer.render(scene, camera)
  updateOverlay()
  if (cameraMoved) requestRender()
}

// ---------------------------------------------------------------------------
// Materiales compartidos: uno por combinación de estilo, reutilizados entre
// redibujos (antes se creaba uno nuevo por pieza en cada cambio y nunca se liberaba).
// ---------------------------------------------------------------------------
const materialCache = new Map()

function sharedMaterial(key, create) {
  let mat = materialCache.get(key)
  if (!mat) {
    mat = create()
    materialCache.set(key, mat)
  }
  return mat
}

function blockMaterial(viewMode, isSelected, isSubtract) {
  return sharedMaterial(`bloque|${viewMode}|${isSelected}|${isSubtract}`, () => {
    if (viewMode === 'alambrico') {
      return new THREE.MeshBasicMaterial({
        color: isSubtract ? 0xf43f5e : (isSelected ? 0x38bdf8 : 0x0284c7),
        wireframe: true
      })
    }
    if (viewMode === 'rayosX') {
      return new THREE.MeshStandardMaterial({
        color: isSubtract ? 0xf43f5e : (isSelected ? 0x38bdf8 : 0x0ea5e9),
        transparent: true,
        opacity: isSubtract ? 0.35 : 0.3,
        roughness: 0.2,
        metalness: 0.1,
        depthWrite: false
      })
    }
    return new THREE.MeshStandardMaterial({
      color: isSubtract ? 0xf43f5e : (isSelected ? 0x38bdf8 : 0x0284c7),
      transparent: isSubtract,
      opacity: isSubtract ? 0.55 : 0.95,
      roughness: 0.35,
      metalness: 0.15
    })
  })
}

function blockEdgesMaterial(isSelected, isSubtract) {
  return sharedMaterial(`aristas|${isSelected}|${isSubtract}`, () => new THREE.LineBasicMaterial({
    color: isSelected ? 0xffffff : (isSubtract ? 0xff8888 : 0x38bdf8),
    transparent: true,
    opacity: isSelected ? 0.95 : 0.4
  }))
}

function compositeMaterial(viewMode) {
  return sharedMaterial(`solido|${viewMode}`, () => {
    if (viewMode === 'alambrico') return new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
    if (viewMode === 'rayosX') {
      return new THREE.MeshStandardMaterial({
        color: 0x0284c7, transparent: true, opacity: 0.35, roughness: 0.25, metalness: 0.15,
        side: THREE.DoubleSide, depthWrite: false
      })
    }
    return new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide })
  })
}

function compositeEdgesMaterial() {
  return sharedMaterial('aristas|solido', () =>
    new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8 })
  )
}

// ---------------------------------------------------------------------------
// Geometrías en caché por forma (tipo + medidas): mover o rotar una pieza ya no
// regenera su malla; solo se regenera al cambiar sus medidas.
// ---------------------------------------------------------------------------
const geometryCache = new Map() // clave → { geometry, edges }
const compositeEdgesCache = new WeakMap() // geometría del sólido → aristas

function blockGeometryKey(b) {
  const def = GEOMETRY_TYPES[b.tipo_figura]
  return b.tipo_figura + '|' + def.params.map(p => b[p.key]).join('|')
}

function blockGeometry(b, usedKeys) {
  const key = blockGeometryKey(b)
  usedKeys.add(key)
  let entry = geometryCache.get(key)
  if (!entry) {
    const geometry = GEOMETRY_TYPES[b.tipo_figura].createGeometry(b)
    entry = { geometry, edges: new THREE.EdgesGeometry(geometry, 25) }
    geometryCache.set(key, entry)
  }
  return entry
}

function pruneGeometryCache(usedKeys) {
  for (const [key, entry] of geometryCache) {
    if (usedKeys.has(key)) continue
    entry.geometry.dispose()
    entry.edges.dispose()
    geometryCache.delete(key)
  }
}

function compositeEdges(geometry) {
  let edges = compositeEdgesCache.get(geometry)
  if (!edges) {
    edges = new THREE.EdgesGeometry(geometry, 20)
    compositeEdgesCache.set(geometry, edges)
  }
  return edges
}

function disposeCaches() {
  for (const entry of geometryCache.values()) {
    entry.geometry.dispose()
    entry.edges.dispose()
  }
  geometryCache.clear()
  for (const mat of materialCache.values()) mat.dispose()
  materialCache.clear()
}

/** Quita los objetos de un grupo. Solo libera lo que no pertenece a una caché. */
function clearGroup(group) {
  while (group.children.length > 0) {
    const obj = group.children[0]
    group.remove(obj)
    if (obj.userData.ownsResources) {
      obj.geometry?.dispose()
      obj.material?.dispose()
    }
  }
}

function clearScene() {
  clearGroup(blockMeshGroup)
  clearGroup(csgMeshGroup)
  clearGroup(edgesGroup)
  selectedParts = null
  dimensionTarget = null
}

// ---------------------------------------------------------------------------
// Teclado
// ---------------------------------------------------------------------------
function isEditable(el) {
  return el && (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
  )
}

// Una tecla se presiona por error con facilidad: confirmar (igual se puede deshacer)
async function confirmDeleteBlock(bloque) {
  const ok = await confirmDialog({
    title: 'Eliminar pieza',
    message: `¿Eliminar "${bloque.nombre}"?\n\nSe puede deshacer con Ctrl+Z.`,
    confirmText: 'Eliminar',
    danger: true
  })
  if (ok) store.deleteBlock(bloque.id)
}

function onKeyDown(e) {
  // Con un diálogo abierto, el teclado es del diálogo
  if (dialogState.open || store.recordForm || layout.manualOpen || exportOpen.value) return
  // Mientras se escribe en un campo, el teclado es del campo (incluido su propio Ctrl+Z)
  if (isEditable(e.target)) return

  // Deshacer / Rehacer: Ctrl+Z, Ctrl+Y y Ctrl+Shift+Z (Cmd en Mac)
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      store.undo()
    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
      e.preventDefault()
      store.redo()
    }
    return // no tomar las combinaciones con Ctrl como atajos de una letra
  }
  if (e.altKey) return

  if (e.key === 'r' || e.key === 'R' || e.key === 'e' || e.key === 'E') {
    setTransformMode('rotate')
  } else if (e.key === 'w' || e.key === 'W' || e.key === 'g' || e.key === 'G') {
    setTransformMode('translate')
  } else if (e.key === 's' || e.key === 'S') {
    setTransformMode('stretch')
  } else if (e.key === 'd' || e.key === 'D') {
    store.toggleMeasureMode()
  } else if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    toggleTransformMode()
  } else if (e.key === 'm' || e.key === 'M') {
    mirrorOpen.value = !mirrorOpen.value
  } else if (mirrorOpen.value && ['x', 'y', 'z'].includes(e.key.toLowerCase())) {
    mirrorSelected(e.key.toLowerCase())
  } else if (e.key === 'Escape') {
    // Con Medir abierto, Esc primero descarta el punto elegido y después sale
    if (store.measureMode) {
      if (measureStart.value) resetMeasure()
      else store.measureMode = false
      return
    }
    if (mirrorOpen.value) {
      mirrorOpen.value = false
      return
    }
    store.transformMode = 'translate'
  } else if (e.key === 'Delete' || e.key === 'Del') {
    if (store.selectedBlock) confirmDeleteBlock(store.selectedBlock)
  }
}

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------
function initThree() {
  const container = containerRef.value
  const canvas = canvasRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  // 1. Escena
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b0f19')
  scene.fog = new THREE.FogExp2('#0b0f19', 0.015)

  // 2. Cámara (Vista inicial desde la esquina superior Babor-Proa)
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150)
  camera.position.set(16, 11, -14)

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // 4. Luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4)
  dirLight1.position.set(20, 25, 20)
  dirLight1.castShadow = true
  dirLight1.shadow.mapSize.width = 2048
  dirLight1.shadow.mapSize.height = 2048
  scene.add(dirLight1)

  const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6)
  dirLight2.position.set(-20, -10, -20)
  scene.add(dirLight2)

  // 5. Rejilla y Ejes (Piso del pozo)
  screenDecor = floorDecor(IMAGE_THEMES.oscuro)
  scene.add(screenDecor)

  // Grupos
  scene.add(blockMeshGroup)
  scene.add(csgMeshGroup)
  scene.add(edgesGroup)
  scene.add(handlesGroup)
  scene.add(faceHighlightGroup)

  // 6. Controles orbitales
  orbitControls = new OrbitControls(camera, renderer.domElement)
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.05
  orbitControls.target.set(0, 1.5, 0)
  orbitControls.maxPolarAngle = Math.PI / 2 + 0.1
  orbitControls.addEventListener('change', requestRender)

  // 7. Gizmo de Transformación
  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.size = gizmoSize()
  if (store.transformMode !== 'stretch') transformControls.setMode(store.transformMode)
  transformControls.rotationSnap = THREE.MathUtils.degToRad(15) // Snap cada 15° al rotar
  scene.add(transformControls.getHelper())

  transformControls.addEventListener('dragging-changed', (event) => {
    isDraggingGizmo = Boolean(event.value)
    orbitControls.enabled = !event.value
    if (!event.value && store.selectedBlock) {
      clearHighlight()
      if (store.snapToGrid && store.transformMode === 'rotate') {
        // Snapping inteligente entre caras de bloques adyacentes solo al soltar el arrastre manual
        // Sin imán contra piezas que no se ven
        const visibles = store.bloques.filter(b => !store.hiddenBlockIds.includes(b.id))
        const snappedPos = snapBlockToBounds(store.selectedBlock, visibles, 0.35)
        store.updateBlockProperty(store.selectedBlock.id, 'pos_x', snappedPos.pos_x)
        store.updateBlockProperty(store.selectedBlock.id, 'pos_y', snappedPos.pos_y)
        store.updateBlockProperty(store.selectedBlock.id, 'pos_z', snappedPos.pos_z)
      }
      store.updateVolumenReal()
      store.saveBloquesToDb()
      store.pushHistoryState()
      renderBlocks() // estado final, ya fuera del arrastre
    }
  })

  transformControls.addEventListener('change', () => {
    requestRender()
    // SÓLO aplicar snap e interactuar si el usuario está arrastrando el gizmo en pantalla
    // Esto evita que al tipear valores manuales en el panel sean pisados por el redondeo del gizmo
    if (isDraggingGizmo && transformControls.object && store.selectedBlock) {
      const obj = transformControls.object
      if (store.snapToGrid) {
        const step = store.gridStep
        const crudo = obj.position.clone()
        obj.position.x = Math.round(obj.position.x / step) * step
        obj.position.y = Math.round(obj.position.y / step) * step
        obj.position.z = Math.round(obj.position.z / step) * step
        if (store.transformMode === 'translate') {
          // Si hay una cara cercana, manda sobre la cuadrícula en ese eje
          const moved = { ...store.selectedBlock, pos_x: crudo.x, pos_y: crudo.y, pos_z: crudo.z }
          const snapped = snapBlockToBounds(moved, visibleBlocks(), 0.35)
          for (const face of snapped.faces) obj.position[face.axis] = snapped['pos_' + face.axis]
          showHighlight(snapped.faces)
        }
      }
      store.updateBlockProperty(store.selectedBlock.id, 'pos_x', obj.position.x)
      store.updateBlockProperty(store.selectedBlock.id, 'pos_y', obj.position.y)
      store.updateBlockProperty(store.selectedBlock.id, 'pos_z', obj.position.z)

      if (store.transformMode === 'rotate') {
        store.updateBlockProperty(store.selectedBlock.id, 'rot_x', obj.rotation.x)
        store.updateBlockProperty(store.selectedBlock.id, 'rot_y', obj.rotation.y)
        store.updateBlockProperty(store.selectedBlock.id, 'rot_z', obj.rotation.z)
      }
    }
  })

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointermove', onMeasureMove)
  // En captura sobre el contenedor: se adelanta a la cámara si se toca un tirador
  containerRef.value.addEventListener('pointerdown', onHandleDown, true)

  // Se ajusta a cualquier cambio de tamaño del contenedor, no solo de la ventana
  resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container)

  requestRender()
}

function onResize() {
  if (!containerRef.value || !renderer || !camera) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  if (!width || !height) return
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  requestRender()
}

function onPointerDown(event) {
  tapStart = null
  if (event.button !== 0 || !event.isPrimary) return
  // Si el usuario está interactuando con el Gizmo, ignorar para no cambiar la selección
  if (transformControls && (transformControls.dragging || transformControls.axis !== null)) return
  tapStart = { x: event.clientX, y: event.clientY, t: performance.now() }
}

function onPointerUp(event) {
  const start = tapStart
  tapStart = null
  if (!start || !event.isPrimary) return
  const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
  if (moved > TAP_MAX_MOVE_PX || performance.now() - start.t > TAP_MAX_MS) return

  // Midiendo, el toque marca un punto y no cambia la selección
  if (store.measureMode) {
    addMeasurePoint(event)
    return
  }

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(blockMeshGroup.children, false)

  if (intersects.length > 0) {
    const blockId = intersects[0].object.userData.blockId
    if (blockId) {
      store.selectedBlockId = blockId
    }
  }
}

// Con pantalla táctil, gizmo más grande para poder tomarlo con el dedo
function gizmoSize() {
  return layout.isTouch ? 1.6 : 1.1
}

watch(() => layout.isTouch, () => {
  if (transformControls) {
    transformControls.size = gizmoSize()
    requestRender()
  }
})

// ---------------------------------------------------------------------------
// Armado de la escena
// ---------------------------------------------------------------------------
function renderBlocks() {
  if (!scene) return
  clearGroup(handlesGroup)

  if (store.modelMode === 'solidoFinal') {
    transformControls.detach()
    // La escena anterior queda a la vista hasta que llega el sólido nuevo
    renderComposite()
  } else {
    csgRenderToken++ // descarta un sólido que todavía se estuviera calculando
    clearScene()
    renderEditMode()
  }
  requestRender()
}

/** Modo "Vista previa": dibuja el sólido calculado en segundo plano. */
function renderComposite() {
  const token = ++csgRenderToken
  const viewMode = store.viewMode
  computeComposite(store.bloques).then(res => {
    // Si mientras tanto cambió algo, este resultado ya no corresponde
    if (res.superseded || token !== csgRenderToken || store.modelMode !== 'solidoFinal') return
    clearScene()
    if (res.geometry) {
      // La geometría es compartida con el cálculo del volumen: no se libera acá
      const mesh = new THREE.Mesh(res.geometry, compositeMaterial(viewMode))
      mesh.castShadow = true
      mesh.receiveShadow = true
      csgMeshGroup.add(mesh)

      // Aristas técnicas de la figura final unida y perforada
      edgesGroup.add(new THREE.LineSegments(compositeEdges(res.geometry), compositeEdgesMaterial()))

      // Las cotas automáticas son las del pozo completo
      dimensionTarget = { geometry: res.geometry, object: mesh }
    }
    requestRender()
  })
}

/** Modo edición: cada pieza por separado, con el gizmo en la seleccionada. */
function renderEditMode() {
  const usedKeys = new Set()
  let selectedMesh = null

  for (const b of store.bloques) {
    if (!GEOMETRY_TYPES[b.tipo_figura]) continue
    // Oculta: sin malla ni aristas, y tampoco se puede clickear ni mover
    if (store.hiddenBlockIds.includes(b.id)) continue

    const { geometry, edges } = blockGeometry(b, usedKeys)
    const isSelected = b.id === store.selectedBlockId
    const isSubtract = b.operacion === 'SUBSTRACCION'

    const mesh = new THREE.Mesh(geometry, blockMaterial(store.viewMode, isSelected, isSubtract))
    mesh.position.set(b.pos_x, b.pos_y, b.pos_z)
    mesh.rotation.set(b.rot_x, b.rot_y, b.rot_z)
    mesh.castShadow = !isSubtract
    mesh.receiveShadow = true
    mesh.userData = { blockId: b.id }
    blockMeshGroup.add(mesh)

    // Aristas CAD
    const edgesLine = new THREE.LineSegments(edges, blockEdgesMaterial(isSelected, isSubtract))
    edgesLine.position.copy(mesh.position)
    edgesLine.rotation.copy(mesh.rotation)
    edgesGroup.add(edgesLine)

    if (isSelected) {
      const stretching = store.transformMode === 'stretch'
      selectedMesh = b.fijada || stretching || store.measureMode ? null : mesh
      if (stretching && !b.fijada && !store.measureMode) addHandles(b)
      selectedParts = { mesh, edges: edgesLine }
      dimensionTarget = { geometry, object: mesh }
    }
  }

  pruneGeometryCache(usedKeys)

  // Adjuntar Gizmo al bloque seleccionado
  if (selectedMesh) {
    transformControls.attach(selectedMesh)
  } else {
    transformControls.detach()
  }
}

// ---------------------------------------------------------------------------
// Imán y modo Estirar
// ---------------------------------------------------------------------------
function visibleBlocks() {
  return store.bloques.filter(b => !store.hiddenBlockIds.includes(b.id))
}

function clearHighlight() {
  while (faceHighlightGroup.children.length > 0) {
    const mesh = faceHighlightGroup.children[0]
    faceHighlightGroup.remove(mesh)
    mesh.geometry.dispose()
  }
  requestRender()
}

/** Resalta las caras de otras piezas a las que se está pegando. */
function showHighlight(faces) {
  clearHighlight()
  for (const { axis, value, box } of faces) {
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    size[axis] = 0.02
    center[axis] = value
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), highlightMaterial)
    mesh.position.copy(center)
    faceHighlightGroup.add(mesh)
  }
}

function addHandles(block) {
  for (const handle of getHandles(block)) {
    const activeId = stretchDrag?.handle?.id
    const active = activeId === handle.id || handle.axes?.some(x => x.id === activeId) ||
      (handle.axes && stretchDrag?.vertex)
    const idle = handle.axes ? handleVertexMaterial : handleMaterial
    const mesh = new THREE.Mesh(handleGeometry, active ? handleActiveMaterial : idle)
    mesh.position.copy(handle.worldPoint)
    mesh.renderOrder = 999
    mesh.userData = { handle }
    handlesGroup.add(mesh)
  }
  scaleHandles()
}

function scaleHandles() {
  if (!camera) return
  const factor = layout.isTouch ? 0.016 : 0.01
  for (const mesh of handlesGroup.children) {
    const { handle } = mesh.userData
    const size = camera.position.distanceTo(handle.worldPoint) * factor
    mesh.scale.setScalar(size)
    mesh.position.copy(handle.worldPoint)
    if (handle.lift) mesh.position.addScaledVector(handle.worldDir, size * 3)
  }
}

function toScreen(point) {
  const rect = canvasRef.value.getBoundingClientRect()
  const p = point.clone().project(camera)
  return { x: (p.x + 1) / 2 * rect.width, y: (1 - p.y) / 2 * rect.height, z: p.z }
}

function pointerRay(event) {
  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  return raycaster.ray
}

/** Tirador bajo el puntero, medido en pantalla para que sea fácil de tomar. */
function handleAt(event) {
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  let best = null
  for (const mesh of handlesGroup.children) {
    const p = toScreen(mesh.position)
    const dist = Math.hypot(p.x - x, p.y - y)
    if (dist > (layout.isTouch ? 24 : 12)) continue
    // Entre superpuestos gana el más cercano al puntero y, a igualdad, el de adelante
    const score = dist + p.z * 4
    if (!best || score < best.score) best = { score, handle: mesh.userData.handle }
  }
  return best?.handle || null
}

function onHandleDown(event) {
  if (event.target !== canvasRef.value || event.button !== 0 || !event.isPrimary) return
  if (store.measureMode || store.transformMode !== 'stretch' || !store.selectedBlock || store.selectedBlock.fijada) return
  const picked = handleAt(event)
  if (!picked) return
  // En el vértice la dirección se decide con el primer movimiento
  const vertex = picked.axes ? picked : null
  const drag = vertex
    ? { vertex, handle: null, x: event.clientX, y: event.clientY, ray: pointerRay(event).clone() }
    : startAxisDrag(picked, pointerRay(event))
  if (!drag) return

  event.stopPropagation() // que la cámara no orbite
  event.preventDefault()
  store.beginStretch()
  stretchDrag = { start: { ...store.selectedBlock }, ...drag, pointerId: event.pointerId }
  orbitControls.enabled = false
  window.addEventListener('pointermove', onHandleMove)
  window.addEventListener('pointerup', stopStretch)
  window.addEventListener('pointercancel', stopStretch)
  if (drag.handle) updateStretchLabel(stretchDrag.start, drag.handle)
  renderBlocks()
}

function startAxisDrag(handle, ray) {
  const point = handle.worldPoint.clone()
  const dir = handle.worldDir.clone()
  const d0 = dragDistance(point, dir, ray)
  return d0 === null ? null : { handle, point, dir, d0 }
}

/** Vértice: elige la dirección que en pantalla más acompaña al puntero. */
function chooseVertexAxis(event) {
  const dx = event.clientX - stretchDrag.x
  const dy = event.clientY - stretchDrag.y
  if (Math.hypot(dx, dy) < 6) return false
  let best = null
  for (const axis of stretchDrag.vertex.axes) {
    const a = toScreen(axis.worldPoint)
    const b = toScreen(axis.worldPoint.clone().add(axis.worldDir))
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    // Casi de punta hacia la cámara: no se puede arrastrar en esa dirección
    if (length < 4) continue
    const score = Math.abs((b.x - a.x) * dx + (b.y - a.y) * dy) / length
    const drag = startAxisDrag(axis, stretchDrag.ray)
    if (drag && (!best || score > best.score)) best = { score, drag }
  }
  if (!best) return false
  Object.assign(stretchDrag, best.drag)
  return true
}

function onHandleMove(event) {
  if (!stretchDrag || event.pointerId !== stretchDrag.pointerId) return
  if (!stretchDrag.handle && !chooseVertexAxis(event)) return
  const { start, handle, point, dir, d0 } = stretchDrag
  const t = dragDistance(point, dir, pointerRay(event))
  if (t === null) return
  const { block, face } = resolveStretch(start, handle, t - d0, visibleBlocks(), {
    snap: store.snapToGrid,
    step: store.gridStep
  })
  showHighlight(face ? [face] : [])
  store.stretchBlock(start.id, {
    [handle.param]: block[handle.param],
    pos_x: block.pos_x,
    pos_y: block.pos_y,
    pos_z: block.pos_z
  })
  updateStretchLabel(block, handle)
}

function updateStretchLabel(block, handle) {
  const param = GEOMETRY_TYPES[block.tipo_figura].params.find(p => p.key === handle.param)
  const current = singleAxisHandles(block).find(x => x.id === handle.id)
  const { x, y } = toScreen(current.worldPoint)
  stretchLabel.value = { text: `${param.label}: ${formatDecimal(Number(block[handle.param].toFixed(2)))} m`, x, y }
}

function stopStretch(event) {
  if (!stretchDrag || (event?.pointerId !== undefined && event.pointerId !== stretchDrag.pointerId)) return
  stretchDrag = null
  stretchLabel.value = null
  orbitControls.enabled = true
  window.removeEventListener('pointermove', onHandleMove)
  window.removeEventListener('pointerup', stopStretch)
  window.removeEventListener('pointercancel', stopStretch)
  clearHighlight()
  store.endStretch()
  renderBlocks()
}

/**
 * Durante el arrastre con el gizmo la malla ya se mueve sola: solo se acompañan
 * sus aristas (las cotas la siguen solas), sin reconstruir la escena en cada movimiento.
 */
function syncSelectedDuringDrag() {
  if (!selectedParts) return
  const { mesh, edges } = selectedParts
  edges.position.copy(mesh.position)
  edges.rotation.copy(mesh.rotation)
  requestRender()
}

watch(() => store.bloques, () => {
  if (isDraggingGizmo && store.modelMode === 'edicion') syncSelectedDuringDrag()
  else renderBlocks()
}, { deep: true })
watch(() => store.selectedBlockId, () => renderBlocks())
watch(() => store.hiddenBlockIds, () => renderBlocks())
watch(() => store.viewMode, () => renderBlocks())
watch(() => store.modelMode, () => renderBlocks())
watch(() => store.showDimensions, () => requestRender())
watch(() => store.cotas, () => requestRender(), { deep: true })
watch(() => store.measureAxis, () => requestRender())
watch(() => store.selectedPozoId, () => resetMeasure())
watch(() => store.measureMode, () => {
  mirrorOpen.value = false
  resetMeasure()
  renderBlocks() // el gizmo y los tiradores no se usan mientras se mide
})
watch(() => store.transformMode, (newMode) => {
  if (transformControls && newMode !== 'stretch') transformControls.setMode(newMode)
  renderBlocks() // aparecen o desaparecen el gizmo y los tiradores
})

// ---------------------------------------------------------------------------
// Cotas y herramienta Medir
// ---------------------------------------------------------------------------
function dataFor(geometry) {
  let data = dimensionData.get(geometry)
  if (!data) {
    const positions = geometry.attributes.position.array
    data = { ...boundsOf(positions), corners: findCorners(positions, geometry.index?.array) }
    dimensionData.set(geometry, data)
  }
  return data
}

/** Punto de la bodega [x, y, z] a píxeles del visor; null si queda detrás. */
function projector() {
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  const v = new THREE.Vector3()
  return (point) => {
    v.fromArray(point).project(camera)
    if (v.z < -1 || v.z > 1) return null
    return { x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height, depth: v.z }
  }
}

/** Cotas automáticas del cuerpo acotado, en coordenadas de la bodega. */
function currentAutoDimensions() {
  if (!dimensionTarget) return []
  const { geometry, object } = dimensionTarget
  object.updateMatrixWorld()
  // Se calculan en los ejes de la pieza, para que informen sus medidas aunque esté girada
  const eye = object.worldToLocal(camera.position.clone()).toArray()
  const toWorld = (p) => object.localToWorld(new THREE.Vector3().fromArray(p)).toArray()
  return autoDimensions(dataFor(geometry), eye).map(d => ({
    ...d, a: toWorld(d.a), b: toWorld(d.b), ext: d.ext.map(pair => pair.map(toWorld))
  }))
}

/** Cotas que se están mostrando (sin la que se está por marcar). */
function visibleDimensions() {
  if (!store.showDimensions && !store.measureMode) return []
  // Midiendo, las cotas automáticas se apartan para no confundir
  const dimensions = store.measureMode ? [] : currentAutoDimensions()
  for (const cota of store.cotas) dimensions.push(manualDimension(cota))
  return dimensions
}

function updateOverlay() {
  if (!containerRef.value) return
  if (!store.showDimensions && !store.measureMode) {
    if (overlayShapes.value.length) overlayShapes.value = []
    if (overlayMarkers.value.length) overlayMarkers.value = []
    return
  }
  const project = projector()
  const dimensions = visibleDimensions()

  const markers = []
  if (store.measureMode) {
    const start = measureStart.value
    if (start && measureHover) {
      dimensions.push(manualDimension({ a: start, b: measureHover.point, eje: store.measureAxis }))
    }
    for (const mark of [start && { point: start, type: 'esquina' }, measureHover]) {
      const p = mark && project(mark.point)
      if (p) markers.push({ ...p, type: mark.type })
    }
  }
  overlayShapes.value = toScreenShapes(dimensions, project)
  overlayMarkers.value = markers
}

/** Esquinas y aristas a las que se puede enganchar un punto. */
function snapCandidates() {
  const corners = []
  const edges = []
  const solid = store.modelMode === 'solidoFinal'
  const meshes = solid ? csgMeshGroup.children : blockMeshGroup.children
  const v = new THREE.Vector3()

  for (const mesh of meshes) {
    mesh.updateMatrixWorld()
    const toWorld = (p) => v.fromArray(p).applyMatrix4(mesh.matrixWorld).toArray()
    for (const corner of dataFor(mesh.geometry).corners) corners.push(toWorld(corner))
  }
  for (const line of edgesGroup.children) {
    line.updateMatrixWorld()
    const pos = line.geometry.attributes.position
    for (let i = 0; i + 1 < pos.count; i += 2) {
      edges.push([i, i + 1].map(j => v.fromBufferAttribute(pos, j).applyMatrix4(line.matrixWorld).toArray()))
    }
  }
  return { corners, edges, meshes }
}

function measurePointAt(event) {
  const rect = canvasRef.value.getBoundingClientRect()
  const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  pointerRay(event)
  const { corners, edges, meshes } = snapCandidates()
  const hit = raycaster.intersectObjects(meshes, false)[0]
  return snapPoint(pointer, { corners, edges, surface: hit ? hit.point.toArray() : null },
    projector(), layout.isTouch ? 24 : 14)
}

/** Vista previa del punto (y de la cota) mientras se mueve el mouse. */
function onMeasureMove(event) {
  // Con el botón apretado se está orbitando; en pantalla táctil no hay vista previa
  if (!store.measureMode || event.pointerType === 'touch' || event.buttons) return
  measureHover = measurePointAt(event)
  requestRender()
}

function addMeasurePoint(event) {
  const found = measurePointAt(event)
  if (!found) return
  const point = found.point.map(n => Math.round(n * 1000) / 1000) // al milímetro
  const start = measureStart.value
  if (!start) {
    measureStart.value = point
  } else {
    // Dos puntos sin distancia sobre el eje elegido no hacen una cota
    if (manualDimension({ a: start, b: point, eje: store.measureAxis }).value < 0.005) return
    store.addCota(start, point, store.measureAxis)
    measureStart.value = null
  }
  measureHover = null
  requestRender()
}

function resetMeasure() {
  measureStart.value = null
  measureHover = null
  requestRender()
}

// ---------------------------------------------------------------------------
// Exportar imagen
// ---------------------------------------------------------------------------
function floorDecor(theme) {
  const group = new THREE.Group()
  group.add(new THREE.GridHelper(40, 80, ...theme.grid))
  const axes = new THREE.AxesHelper(3)
  axes.position.set(0, 0.01, 0)
  axes.setColors(...theme.axes.map(c => new THREE.Color(c)))
  group.add(axes)
  return group
}

/** Materiales del sólido y sus aristas para la imagen con fondo claro. */
function lightMaterials(viewMode) {
  const theme = IMAGE_THEMES.claro
  const solid = sharedMaterial(`png|${viewMode}`, () => {
    if (viewMode === 'alambrico') return new THREE.MeshBasicMaterial({ color: theme.wireframe, wireframe: true })
    const mat = compositeMaterial(viewMode).clone()
    mat.color.set(theme.solid)
    return mat
  })
  const edges = sharedMaterial('png|aristas', () => new THREE.LineBasicMaterial({ color: theme.edges }))
  return { solid, edges }
}

/**
 * Pinta en un canvas aparte lo que se ve (misma cámara, estilo y cotas), sin
 * paneles ni botones. Todo ocurre en el mismo cuadro: la pantalla no parpadea.
 */
function snapshot(themeId) {
  const theme = IMAGE_THEMES[themeId]
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  const scale = exportScale(width, height, window.devicePixelRatio)
  const output = document.createElement('canvas')
  output.width = Math.round(width * scale)
  output.height = Math.round(height * scale)
  const ctx = output.getContext('2d')

  const pixelRatio = renderer.getPixelRatio()
  const background = scene.background
  const fogColor = scene.fog.color.clone()
  const restore = []
  try {
    if (themeId === 'claro') {
      scene.background = new THREE.Color(theme.background)
      scene.fog.color.set(theme.background)
      lightDecor ||= floorDecor(theme)
      scene.add(lightDecor)
      screenDecor.visible = false
      const materials = lightMaterials(store.viewMode)
      for (const [objects, material] of [[csgMeshGroup.children, materials.solid], [edgesGroup.children, materials.edges]]) {
        for (const object of objects) {
          const original = object.material
          restore.push(() => { object.material = original })
          object.material = material
        }
      }
    }
    renderer.setPixelRatio(scale)
    renderer.render(scene, camera)
    // Hay que copiar antes de ceder el control: el navegador descarta el cuadro
    ctx.drawImage(renderer.domElement, 0, 0, output.width, output.height)
  } finally {
    restore.forEach(undo => undo())
    scene.background = background
    scene.fog.color.copy(fogColor)
    if (lightDecor) scene.remove(lightDecor)
    screenDecor.visible = true
    renderer.setPixelRatio(pixelRatio)
    renderer.render(scene, camera)
  }

  ctx.scale(output.width / width, output.height / height)
  paintDimensions(ctx, toScreenShapes(visibleDimensions(), projector()), theme)
  return output
}

async function exportImage(themeId) {
  exportOpen.value = false
  // Recién cambiado de modo, el sólido puede estar calculándose todavía
  if (!csgMeshGroup.children.length) {
    await alertDialog({ title: 'No hay imagen para exportar', message: 'El modelo todavía se está calculando o no tiene volumen.' })
    return
  }
  try {
    const buque = store.buques.find(b => b.id === store.selectedBuqueId)
    const pozo = store.pozos.find(p => p.id === store.selectedPozoId)
    await downloadCanvas(snapshot(themeId), imageFileName(buque?.nombre, pozo?.nombre))
  } catch (error) {
    await alertDialog({ title: 'No se pudo exportar', message: error.message })
  }
}

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------
function resetCamera() {
  if (!camera || !orbitControls) return
  // Esquina superior Babor-Proa (+X, +Y, -Z)
  camera.position.set(16, 11, -14)
  orbitControls.target.set(0, 1.5, 0)
  requestRender()
}

function setCameraView(view) {
  if (!camera || !orbitControls) return
  if (view === 'top') {
    // Vista en Planta (mirando desde arriba hacia cubierta)
    camera.position.set(0.001, 22, 0)
    orbitControls.target.set(0, 0, 0)
  } else if (view === 'front') {
    // Vista Frente: mirando la pared transversal (de Estribor a Babor) desde Proa (+X) hacia Popa (-X)
    camera.position.set(20, 1.5, 0)
    orbitControls.target.set(0, 1.5, 0)
  } else if (view === 'side') {
    // Vista Lateral: mirando desde Babor (-Z) hacia Estribor (+Z), perfil longitudinal de Eslora
    camera.position.set(0, 1.5, -20)
    orbitControls.target.set(0, 1.5, 0)
  }
  requestRender()
}

function toggleTransformMode() {
  store.transformMode = store.transformMode === 'translate' ? 'rotate' : 'translate'
}
</script>
