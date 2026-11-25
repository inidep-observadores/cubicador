<template>
  <div class="relative w-full h-full overflow-hidden bg-slate-950" ref="containerRef">
    <!-- Canvas Three.js -->
    <canvas ref="canvasRef" class="w-full h-full block outline-none cursor-grab active:cursor-grabbing"></canvas>

    <!-- Overlay de cotas en pantalla si hay bloque seleccionado -->
    <div 
      v-if="store.showDimensions && store.selectedBlock" 
      class="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-3 shadow-lg font-mono text-xs text-slate-300 pointer-events-none space-y-1"
    >
      <div class="text-[10px] font-bold uppercase tracking-wider text-sky-400 font-sans mb-1">
        Cotas del Bloque Seleccionado
      </div>
      <div class="flex items-center justify-between gap-4">
        <span class="text-slate-400">Eslora (L):</span>
        <span class="text-amber-300 font-bold">{{ store.selectedBlock.largo?.toFixed(2) }} m</span>
      </div>
      <div class="flex items-center justify-between gap-4">
        <span class="text-slate-400">Puntal/Alto (H):</span>
        <span class="text-amber-300 font-bold">{{ store.selectedBlock.alto?.toFixed(2) }} m</span>
      </div>
      <div v-if="store.selectedBlock.ancho" class="flex items-center justify-between gap-4">
        <span class="text-slate-400">Manga/Ancho (W):</span>
        <span class="text-amber-300 font-bold">{{ store.selectedBlock.ancho?.toFixed(2) }} m</span>
      </div>
      <div v-if="store.selectedBlock.base_a" class="flex items-center justify-between gap-4">
        <span class="text-slate-400">Base A:</span>
        <span class="text-sky-300 font-bold">{{ store.selectedBlock.base_a?.toFixed(2) }} m</span>
      </div>
      <div v-if="store.selectedBlock.base_b" class="flex items-center justify-between gap-4">
        <span class="text-slate-400">Base B:</span>
        <span class="text-sky-300 font-bold">{{ store.selectedBlock.base_b?.toFixed(2) }} m</span>
      </div>
      <div v-if="store.selectedBlock.diametro_d" class="flex items-center justify-between gap-4">
        <span class="text-slate-400">Diámetro D:</span>
        <span class="text-emerald-300 font-bold">{{ store.selectedBlock.diametro_d?.toFixed(2) }} m</span>
      </div>
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
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { useEditorStore } from '../stores/editorStore'
import { GEOMETRY_TYPES } from '../services/geometryCatalog'
import { buildCompositePozo, snapBlockToBounds } from '../services/csgService'
import { Compass, Move3d, Magnet, RotateCw } from 'lucide-vue-next'

const store = useEditorStore()
const containerRef = ref(null)
const canvasRef = ref(null)

let scene, camera, renderer, orbitControls, transformControls
let blockMeshGroup = new THREE.Group()
let csgMeshGroup = new THREE.Group()
let edgesGroup = new THREE.Group()
let dimensionsGroup = new THREE.Group()
let raycaster = new THREE.Raycaster()
let mouse = new THREE.Vector2()
let animationFrameId = null

onMounted(() => {
  initThree()
  renderBlocks()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
  if (renderer) renderer.dispose()
})

function onKeyDown(e) {
  // Si está escribiendo en un input, ignorar atajos
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return

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
    if (store.selectedBlockId) {
      store.deleteBlock(store.selectedBlockId)
    }
  }
}

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

  // 7. Gizmo de Transformación
  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.size = 1.1
  transformControls.setMode(store.transformMode)
  transformControls.rotationSnap = THREE.MathUtils.degToRad(15) // Snap cada 15° al rotar
  scene.add(transformControls.getHelper())

  transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value
    if (!event.value && store.selectedBlock) {
      if (store.snapToGrid) {
        // Snapping inteligente entre caras de bloques adyacentes
        const snappedPos = snapBlockToBounds(store.selectedBlock, store.bloques, 0.35)
        store.updateBlockProperty(store.selectedBlock.id, 'pos_x', snappedPos.pos_x)
        store.updateBlockProperty(store.selectedBlock.id, 'pos_y', snappedPos.pos_y)
        store.updateBlockProperty(store.selectedBlock.id, 'pos_z', snappedPos.pos_z)
      }
      store.saveBloquesToDb()
      store.pushHistoryState()
    }
  })

  transformControls.addEventListener('change', () => {
    if (transformControls.object && store.selectedBlock) {
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
  animate()
}

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  if (orbitControls) orbitControls.update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

function onResize() {
  if (!containerRef.value || !renderer || !camera) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
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
    const clickedMesh = intersects[0].object
    const blockId = clickedMesh.userData.blockId
    if (blockId) {
      store.selectedBlockId = blockId
    }
  }
}

function renderBlocks() {
  // Limpiar grupos anteriores
  while (blockMeshGroup.children.length > 0) {
    const obj = blockMeshGroup.children[0]
    blockMeshGroup.remove(obj)
    if (obj.geometry) obj.geometry.dispose()
  }
  while (csgMeshGroup.children.length > 0) {
    const obj = csgMeshGroup.children[0]
    csgMeshGroup.remove(obj)
    if (obj.geometry) obj.geometry.dispose()
  }
  while (edgesGroup.children.length > 0) {
    const obj = edgesGroup.children[0]
    edgesGroup.remove(obj)
    if (obj.geometry) obj.geometry.dispose()
  }
  while (dimensionsGroup.children.length > 0) {
    const obj = dimensionsGroup.children[0]
    dimensionsGroup.remove(obj)
    if (obj.geometry) obj.geometry.dispose()
  }

  // --- MODO SÓLIDO FINAL (CSG BOOLEANO) ---
  if (store.modelMode === 'solidoFinal') {
    transformControls.detach()

    const result = buildCompositePozo(store.bloques)
    if (result.mesh && result.mesh.geometry) {
      store.volumenMallaCSG = result.volume
      const geom = result.mesh.geometry

      let mat
      if (store.viewMode === 'alambrico') {
        mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
      } else if (store.viewMode === 'rayosX') {
        mat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.35,
          roughness: 0.25,
          metalness: 0.15,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.35,
          metalness: 0.2,
          side: THREE.DoubleSide
        })
      }

      result.mesh.material = mat
      result.mesh.castShadow = true
      result.mesh.receiveShadow = true
      csgMeshGroup.add(result.mesh)

      // Aristas técnicas de la figura final unida y perforada
      const edgesGeom = new THREE.EdgesGeometry(geom, 20)
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, linewidth: 1.5, transparent: true, opacity: 0.8 })
      const edgesLine = new THREE.LineSegments(edgesGeom, edgesMat)
      edgesGroup.add(edgesLine)

      // Cotas envolventes del pozo completo
      if (store.showDimensions) {
        const box = new THREE.Box3().setFromObject(result.mesh)
        const boxHelper = new THREE.Box3Helper(box, new THREE.Color(0xfbbf24))
        boxHelper.material.opacity = 0.5
        boxHelper.material.transparent = true
        dimensionsGroup.add(boxHelper)
      }
    }
    return
  }

  // --- MODO EDICIÓN INDIVIDUAL ---
  let selectedMesh = null

  store.bloques.forEach(b => {
    const def = GEOMETRY_TYPES[b.tipo_figura]
    if (!def) return

    const geometry = def.createGeometry(b)
    const isSelected = b.id === store.selectedBlockId
    const isSubtract = b.operacion === 'SUBSTRACCION'

    let material
    if (store.viewMode === 'alambrico') {
      material = new THREE.MeshBasicMaterial({
        color: isSubtract ? 0xf43f5e : (isSelected ? 0x38bdf8 : 0x0284c7),
        wireframe: true
      })
    } else if (store.viewMode === 'rayosX') {
      material = new THREE.MeshStandardMaterial({
        color: isSubtract ? 0xf43f5e : (isSelected ? 0x38bdf8 : 0x0ea5e9),
        transparent: true,
        opacity: isSubtract ? 0.35 : 0.3,
        roughness: 0.2,
        metalness: 0.1,
        depthWrite: false
      })
    } else {
      material = new THREE.MeshStandardMaterial({
        color: isSubtract ? 0xf43f5e : (isSelected ? 0x38bdf8 : 0x0284c7),
        transparent: isSubtract,
        opacity: isSubtract ? 0.55 : 0.95,
        roughness: 0.35,
        metalness: 0.15
      })
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(b.pos_x, b.pos_y, b.pos_z)
    mesh.rotation.set(b.rot_x, b.rot_y, b.rot_z)
    mesh.castShadow = !isSubtract
    mesh.receiveShadow = true
    mesh.userData = { blockId: b.id }

    blockMeshGroup.add(mesh)

    // Aristas CAD
    const edgesGeom = new THREE.EdgesGeometry(geometry, 25)
    const edgesMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0xffffff : (isSubtract ? 0xff8888 : 0x38bdf8),
      linewidth: isSelected ? 2 : 1,
      transparent: true,
      opacity: isSelected ? 0.95 : 0.4
    })
    const edgesLine = new THREE.LineSegments(edgesGeom, edgesMat)
    edgesLine.position.copy(mesh.position)
    edgesLine.rotation.copy(mesh.rotation)
    edgesGroup.add(edgesLine)

    if (isSelected) {
      selectedMesh = mesh

      // Si está activo mostrar cotas, dibujar caja de cotas 3D
      if (store.showDimensions) {
        const box = new THREE.Box3().setFromObject(mesh)
        const boxHelper = new THREE.Box3Helper(box, new THREE.Color(0xfbbf24))
        boxHelper.material.opacity = 0.5
        boxHelper.material.transparent = true
        dimensionsGroup.add(boxHelper)
      }
    }
  })

  // Adjuntar Gizmo al bloque seleccionado
  if (selectedMesh) {
    transformControls.attach(selectedMesh)
  } else {
    transformControls.detach()
  }
}

watch(() => store.bloques, () => renderBlocks(), { deep: true })
watch(() => store.selectedBlockId, () => renderBlocks())
watch(() => store.viewMode, () => renderBlocks())
watch(() => store.modelMode, () => renderBlocks())
watch(() => store.showDimensions, () => renderBlocks())
watch(() => store.transformMode, (newMode) => {
  if (transformControls) transformControls.setMode(newMode)
})

function resetCamera() {
  if (!camera || !orbitControls) return
  // Esquina superior Babor-Proa (+X, +Y, -Z)
  camera.position.set(16, 11, -14)
  orbitControls.target.set(0, 1.5, 0)
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
}

function toggleTransformMode() {
  store.transformMode = store.transformMode === 'translate' ? 'rotate' : 'translate'
}
</script>
