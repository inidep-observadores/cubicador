<template>
  <div class="relative w-full h-full overflow-hidden bg-slate-950" ref="containerRef">
    <!-- Canvas Three.js -->
    <canvas ref="canvasRef" class="w-full h-full block outline-none cursor-grab active:cursor-grabbing"></canvas>

    <!-- Cotas del bloque seleccionado: editables, solo las medidas de su figura -->
    <div
      v-if="store.showDimensions && store.selectedBlock && selectedDef"
      class="absolute top-4 right-4 z-20 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-3 shadow-lg font-mono text-xs text-slate-300 space-y-1"
    >
      <div class="text-[10px] font-bold uppercase tracking-wider text-sky-400 font-sans mb-1">
        Cotas del Bloque Seleccionado
      </div>
      <label
        v-for="param in selectedDef.params"
        :key="store.selectedBlock.id + param.key"
        class="flex items-center justify-between gap-3"
      >
        <span class="text-slate-400">{{ param.label }}:</span>
        <span class="flex items-center gap-1">
          <DecimalInput
            :min="param.min"
            :step="param.step"
            :model-value="store.selectedBlock[param.key]"
            @update:model-value="store.updateBlockProperty(store.selectedBlock.id, param.key, $event)"
            class="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-right font-bold text-amber-300 focus:outline-none focus:border-sky-500"
          />
          <span class="text-slate-500">m</span>
        </span>
      </label>
    </div>

    <!-- Overlay de controles flotantes sobre el 3D -->
    <div class="absolute bottom-4 left-4 z-10 flex items-center space-x-2 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1.5 shadow-lg">
      <button 
        @click="resetCamera"
        title="Restablecer Vista Isométrica (Esquina Superior Babor-Proa)"
        class="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
      >
        <Compass class="w-4 h-4 text-sky-400" />
        <span>Centrar</span>
      </button>

      <div class="h-4 w-px bg-slate-800"></div>

      <!-- Vistas ortogonales estándar con terminología náutica -->
      <button 
        @click="setCameraView('top')"
        title="Vista en Planta (Cubierta superior)"
        class="px-2 py-1 text-xs font-mono text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition"
      >
        Planta
      </button>
      <button 
        @click="setCameraView('front')"
        title="Vista Frente: mirando la pared transversal (de Estribor a Babor) desde Proa hacia Popa"
        class="px-2 py-1 text-xs font-mono text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition"
      >
        Frente
      </button>
      <button 
        @click="setCameraView('side')"
        title="Vista Lateral: mirando desde Babor hacia Estribor (perfil longitudinal de Eslora)"
        class="px-2 py-1 text-xs font-mono text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition"
      >
        Lateral
      </button>

      <div class="h-4 w-px bg-slate-800"></div>

      <!-- Modo de manipulación de bloque (Mover / Rotar) -->
      <div class="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button 
          @click="store.transformMode = 'translate'"
          :class="store.transformMode === 'translate' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Mover (Tecla W o G)"
          class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1"
        >
          <Move3d class="w-3.5 h-3.5" />
          <span>Mover (W)</span>
        </button>
        <button 
          @click="store.transformMode = 'rotate'"
          :class="store.transformMode === 'rotate' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'"
          title="Modo Rotar (Tecla R o E)"
          class="px-2 py-1 text-xs font-medium rounded transition flex items-center gap-1"
        >
          <RotateCw class="w-3.5 h-3.5" />
          <span>Rotar (R)</span>
        </button>
      </div>

      <!-- Alternar Imán / Snap -->
      <button 
        @click="store.snapToGrid = !store.snapToGrid"
        :class="store.snapToGrid ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'"
        title="Ajuste Magnético a la Cuadrícula (Snap 0.25m)"
        class="p-1.5 rounded-lg border border-transparent hover:border-slate-700 transition"
      >
        <Magnet class="w-4 h-4" />
      </button>
    </div>

    <!-- Indicador Náutico de Orientación -->
    <div class="absolute bottom-4 right-4 z-10 pointer-events-none text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2 font-mono">
      <span class="text-rose-400 font-bold">X: Eslora (Proa)</span>
      <span class="text-slate-600">|</span>
      <span class="text-emerald-400 font-bold">Y: Puntal</span>
      <span class="text-slate-600">|</span>
      <span class="text-sky-400 font-bold">Z: Manga (Babor/Estribor)</span>
    </div>

    <!-- Indicador de Navegación de Ayuda -->
    <div class="absolute top-4 left-4 z-10 pointer-events-none text-[11px] text-slate-400 bg-slate-900/70 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-3">
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
import { Compass, Move3d, Magnet, RotateCw } from 'lucide-vue-next'

const store = useEditorStore()
const containerRef = ref(null)
const canvasRef = ref(null)

const selectedDef = computed(() => GEOMETRY_TYPES[store.selectedBlock?.tipo_figura] || null)

let scene, camera, renderer, orbitControls, transformControls, resizeObserver
const blockMeshGroup = new THREE.Group()
const csgMeshGroup = new THREE.Group()
const edgesGroup = new THREE.Group()
const dimensionsGroup = new THREE.Group()
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

let isDraggingGizmo = false
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

  // 6. Controles orbitales
  orbitControls = new OrbitControls(camera, renderer.domElement)
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.05
  orbitControls.target.set(0, 1.5, 0)
  orbitControls.maxPolarAngle = Math.PI / 2 + 0.1
  orbitControls.addEventListener('change', requestRender)

  // 7. Gizmo de Transformación
  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.size = 1.1
  transformControls.setMode(store.transformMode)
  transformControls.rotationSnap = THREE.MathUtils.degToRad(15) // Snap cada 15° al rotar
  scene.add(transformControls.getHelper())

  transformControls.addEventListener('dragging-changed', (event) => {
    isDraggingGizmo = Boolean(event.value)
    orbitControls.enabled = !event.value
    if (!event.value && store.selectedBlock) {
      if (store.snapToGrid) {
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
        obj.position.x = Math.round(obj.position.x / step) * step
        obj.position.y = Math.round(obj.position.y / step) * step
        obj.position.z = Math.round(obj.position.z / step) * step
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
  if (event.button !== 0) return
  // Si el usuario está interactuando con el Gizmo, ignorar para no cambiar la selección
  if (transformControls && (transformControls.dragging || transformControls.axis !== null)) {
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

// ---------------------------------------------------------------------------
// Armado de la escena
// ---------------------------------------------------------------------------
function renderBlocks() {
  if (!scene) return

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
      selectedMesh = mesh
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
  if (transformControls) transformControls.setMode(newMode)
  requestRender()
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
