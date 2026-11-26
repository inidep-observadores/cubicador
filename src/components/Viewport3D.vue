<template>
  <div class="relative w-full h-full overflow-hidden bg-slate-950" ref="containerRef">
    <!-- Canvas Three.js (touch-none: los gestos son del visor, no de la página) -->
    <canvas ref="canvasRef" class="w-full h-full block outline-none cursor-grab active:cursor-grabbing touch-none"></canvas>

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

    <!-- Modo compacto: Edición / Vista previa flotando sobre el visor -->
    <div v-if="layout.isCompact" class="absolute top-2 left-2 z-20">
      <ModelModeToggle :show-labels="!layout.isShort" />
    </div>

    <!-- Cotas del bloque seleccionado: editables, solo las medidas de su figura.
         En el teléfono se editan desde el panel "Editar" -->
    <div
      v-if="store.showDimensions && store.selectedBlock && selectedDef && !layout.isPhone"
      class="absolute z-20 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl shadow-lg font-mono text-xs text-slate-300 space-y-1"
      :class="layout.isCompact ? 'top-2 right-2 p-2' : 'top-4 right-4 p-3'"
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
          @click="store.transformMode = 'translate'"
          :class="[store.transformMode === 'translate' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white', btnPad]"
          title="Modo Mover (Tecla W o G)"
          aria-label="Mover"
          :aria-pressed="store.transformMode === 'translate'"
          class="text-xs font-medium rounded transition flex items-center gap-1"
        >
          <Move3d class="w-3.5 h-3.5" />
          <span v-if="layout.isWide">Mover (W)</span>
        </button>
        <button
          @click="store.transformMode = 'rotate'"
          :class="[store.transformMode === 'rotate' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white', btnPad]"
          title="Modo Rotar (Tecla R o E)"
          aria-label="Rotar"
          :aria-pressed="store.transformMode === 'rotate'"
          class="text-xs font-medium rounded transition flex items-center gap-1"
        >
          <RotateCw class="w-3.5 h-3.5" />
          <span v-if="layout.isWide">Rotar (R)</span>
        </button>
        <button
          @click="store.transformMode = 'stretch'"
          :class="[store.transformMode === 'stretch' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white', btnPad]"
          title="Modo Estirar: arrastrar una cara para cambiar su medida (Tecla S)"
          aria-label="Estirar"
          :aria-pressed="store.transformMode === 'stretch'"
          class="text-xs font-medium rounded transition flex items-center gap-1"
        >
          <MoveDiagonal class="w-3.5 h-3.5" />
          <span v-if="layout.isWide">Estirar (S)</span>
        </button>
      </div>

      <!-- Alternar Imán / Snap -->
      <button
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

    <!-- Indicador Náutico de Orientación -->
    <div
      v-if="!layout.isPhone"
      class="absolute z-10 pointer-events-none text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2 font-mono"
      :class="layout.isCompact ? 'bottom-2 right-2' : 'bottom-4 right-4'"
    >
      <span class="text-rose-400 font-bold">X: Eslora{{ layout.isWide ? ' (Proa)' : '' }}</span>
      <span class="text-slate-600">|</span>
      <span class="text-emerald-400 font-bold">Y: Puntal</span>
      <span class="text-slate-600">|</span>
      <span class="text-sky-400 font-bold">Z: Manga{{ layout.isWide ? ' (Babor/Estribor)' : '' }}</span>
    </div>

    <!-- Ayuda de navegación con mouse (solo escritorio sin pantalla táctil) -->
    <div v-if="layout.isWide && !layout.isTouch" class="absolute top-4 left-4 z-10 pointer-events-none text-[11px] text-slate-400 bg-slate-900/70 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-3">
      <span>🖱️ <strong>Click Izq:</strong> Orbitar</span>
      <span>🖱️ <strong>Click Der:</strong> Paneo</span>
      <span>📜 <strong>Rueda:</strong> Zoom</span>
      <span>🎯 <strong>Click Pieza:</strong> Seleccionar</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useEditorStore } from '../stores/editorStore'
import { GEOMETRY_TYPES } from '../services/geometryCatalog'
import { snapBlockToBounds } from '../services/csgService'
import { computeComposite } from '../services/csgClient'
import { confirmDialog, dialogState } from '../services/dialog'
import DecimalInput from './DecimalInput.vue'
import { formatDecimal } from '../services/decimal'
import ModelModeToggle from './ModelModeToggle.vue'
import { layout } from '../services/layout'
import { Compass, Move3d, Magnet, RotateCw, MoveDiagonal } from 'lucide-vue-next'
import { getHandles, supportsStretch, dragDistance, resolveStretch } from '../services/stretch'

const store = useEditorStore()
const containerRef = ref(null)
const canvasRef = ref(null)

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

let scene, camera, renderer, orbitControls, transformControls, resizeObserver
const blockMeshGroup = new THREE.Group()
const csgMeshGroup = new THREE.Group()
const edgesGroup = new THREE.Group()
const dimensionsGroup = new THREE.Group()
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
const handleActiveMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })
const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, depthTest: false })

const stretchHint = computed(() => {
  if (store.transformMode !== 'stretch' || store.modelMode !== 'edicion') return ''
  const b = store.selectedBlock
  if (!b) return 'Seleccioná una pieza para estirarla.'
  if (b.fijada) return 'La pieza está fijada: liberala para estirarla.'
  if (!supportsStretch(b)) return 'Esta figura todavía no se puede estirar: usá las cotas.'
  return ''
})
let csgRenderToken = 0
// Pieza seleccionada en la escena, para actualizarla en el arrastre sin reconstruir todo
let selectedParts = null // { mesh, edges, box, boxHelper }

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
  containerRef.value?.removeEventListener('pointerdown', onHandleDown, true)
  stopStretch()
  clearHighlight()
  handleGeometry.dispose()
  handleMaterial.dispose()
  handleActiveMaterial.dispose()
  highlightMaterial.dispose()
  clearScene()
  disposeCaches()
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

const DIMENSIONS_COLOR = new THREE.Color(0xfbbf24)

function makeBoxHelper(box) {
  const helper = new THREE.Box3Helper(box, DIMENSIONS_COLOR)
  helper.material.opacity = 0.5
  helper.material.transparent = true
  helper.userData.ownsResources = true // geometría y material propios
  return helper
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
  clearGroup(dimensionsGroup)
  selectedParts = null
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
  if (dialogState.open || store.recordForm) return
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
    store.transformMode = 'rotate'
  } else if (e.key === 'w' || e.key === 'W' || e.key === 'g' || e.key === 'G') {
    store.transformMode = 'translate'
  } else if (e.key === 's' || e.key === 'S') {
    store.transformMode = 'stretch'
  } else if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    toggleTransformMode()
  } else if (e.key === 'Escape') {
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
  const gridHelper = new THREE.GridHelper(40, 80, 0x0284c7, 0x1e293b)
  gridHelper.position.y = 0
  scene.add(gridHelper)

  const axesHelper = new THREE.AxesHelper(3)
  axesHelper.position.set(0, 0.01, 0)
  scene.add(axesHelper)

  // Grupos
  scene.add(blockMeshGroup)
  scene.add(csgMeshGroup)
  scene.add(edgesGroup)
  scene.add(dimensionsGroup)
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
  const showDimensions = store.showDimensions
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

      // Cotas envolventes del pozo completo
      if (showDimensions) {
        res.geometry.computeBoundingBox()
        dimensionsGroup.add(makeBoxHelper(res.geometry.boundingBox.clone()))
      }
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
      selectedMesh = b.fijada || store.transformMode === 'stretch' ? null : mesh
      if (store.transformMode === 'stretch' && !b.fijada) addHandles(b)
      selectedParts = { mesh, edges: edgesLine, box: null }

      // Si está activo mostrar cotas, dibujar caja de cotas 3D
      if (store.showDimensions) {
        const box = new THREE.Box3().setFromObject(mesh)
        dimensionsGroup.add(makeBoxHelper(box))
        selectedParts.box = box
      }
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
    const active = stretchDrag?.handle.id === handle.id
    const mesh = new THREE.Mesh(handleGeometry, active ? handleActiveMaterial : handleMaterial)
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
    mesh.scale.setScalar(camera.position.distanceTo(mesh.position) * factor)
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
  if (store.transformMode !== 'stretch' || !store.selectedBlock || store.selectedBlock.fijada) return
  const handle = handleAt(event)
  if (!handle) return
  const point = handle.worldPoint.clone()
  const dir = handle.worldDir.clone()
  const d0 = dragDistance(point, dir, pointerRay(event))
  if (d0 === null) return

  event.stopPropagation() // que la cámara no orbite
  event.preventDefault()
  store.beginStretch()
  stretchDrag = { start: { ...store.selectedBlock }, handle, point, dir, d0, pointerId: event.pointerId }
  orbitControls.enabled = false
  window.addEventListener('pointermove', onHandleMove)
  window.addEventListener('pointerup', stopStretch)
  window.addEventListener('pointercancel', stopStretch)
  updateStretchLabel(stretchDrag.start, handle)
  renderBlocks()
}

function onHandleMove(event) {
  if (!stretchDrag || event.pointerId !== stretchDrag.pointerId) return
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
  const current = getHandles(block).find(x => x.id === handle.id)
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
 * sus aristas y la caja de cotas, sin reconstruir la escena en cada movimiento.
 */
function syncSelectedDuringDrag() {
  if (!selectedParts) return
  const { mesh, edges, box } = selectedParts
  edges.position.copy(mesh.position)
  edges.rotation.copy(mesh.rotation)
  if (box) box.setFromObject(mesh)
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
watch(() => store.showDimensions, () => renderBlocks())
watch(() => store.transformMode, (newMode) => {
  if (transformControls && newMode !== 'stretch') transformControls.setMode(newMode)
  renderBlocks() // aparecen o desaparecen el gizmo y los tiradores
})

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
