import * as THREE from 'three'
import { CSG } from 'three-csg-ts'
import { GEOMETRY_TYPES } from './geometryCatalog.js'

/**
 * Asegura que una geometría tenga los atributos requeridos por Three.js y CSG
 */
export function sanitizeGeometry(geometry) {
  let g = geometry.clone()
  if (g.index) {
    g = g.toNonIndexed()
  }
  if (!g.attributes.normal) {
    g.computeVertexNormals()
  }
  if (!g.attributes.uv && g.attributes.position) {
    const count = g.attributes.position.count
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  }
  return g
}

/**
 * Calcula el volumen real de cualquier BufferGeometry en metros cúbicos
 * utilizando el teorema de la divergencia / suma de tetraedros orientados.
 */
export function calculateGeometryVolume(geometry) {
  if (!geometry) return 0

  let geom = geometry
  if (geom.index) {
    geom = geom.toNonIndexed()
  }

  const pos = geom.attributes.position
  if (!pos) return 0

  let totalVolume = 0
  const p1 = new THREE.Vector3()
  const p2 = new THREE.Vector3()
  const p3 = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 3) {
    p1.fromBufferAttribute(pos, i)
    p2.fromBufferAttribute(pos, i + 1)
    p3.fromBufferAttribute(pos, i + 2)

    // Volumen con signo del tetraedro: (p1 · (p2 × p3)) / 6
    const v3 = p2.clone().cross(p3)
    const vol = p1.dot(v3) / 6.0
    totalVolume += vol
  }

  return Math.abs(totalVolume)
}

/**
 * Crea una malla THREE.Mesh posicionada y orientada en el espacio de la bodega
 */
function createBlockMesh(block, material) {
  const def = GEOMETRY_TYPES[block.tipo_figura]
  if (!def) return null

  const rawGeom = def.createGeometry(block)
  const geom = sanitizeGeometry(rawGeom)
  const mesh = new THREE.Mesh(geom, material)

  mesh.position.set(block.pos_x || 0, block.pos_y || 0, block.pos_z || 0)
  mesh.rotation.set(block.rot_x || 0, block.rot_y || 0, block.rot_z || 0)
  mesh.updateMatrix()
  mesh.updateMatrixWorld(true)

  return mesh
}

/**
 * Genera el sólido booleano resultante (CSG) a partir de la lista de bloques
 * utilizando un motor de partición binaria del espacio (BSP clásico determinista).
 * 
 * Flujo:
 * 1) Unión secuencial de todas las figuras aditivas (+) para formar el cuerpo del pozo.
 * 2) Filtrado de figuras sustractivas (-) relevantes (que intersecten la envolvente del pozo).
 * 3) Sustracción secuencial (-) de cada bloque cortador.
 * 4) Generación de normales suaves y cálculo del volumen real de la malla.
 */
export function buildCompositePozo(bloques) {
  if (!bloques || bloques.length === 0) {
    return { mesh: null, volume: 0, error: null }
  }

  try {
    const uniones = bloques.filter(b => b.operacion === 'UNION')
    const sustracciones = bloques.filter(b => b.operacion === 'SUBSTRACCION')

    if (uniones.length === 0) {
      return { mesh: null, volume: 0, error: 'Se requiere al menos una figura de unión (+) como cuerpo principal.' }
    }

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide
    })

    // --- FASE 1: FUSIÓN DE TODAS LAS UNIONES (+) ---
    let compositeMesh = createBlockMesh(uniones[0], baseMaterial)
    if (!compositeMesh) {
      return { mesh: null, volume: 0, error: 'Figura principal no reconocida.' }
    }

    for (let i = 1; i < uniones.length; i++) {
      const blockMesh = createBlockMesh(uniones[i], baseMaterial)
      if (!blockMesh) continue

      try {
        compositeMesh = CSG.union(compositeMesh, blockMesh)
        compositeMesh.updateMatrix()
        compositeMesh.updateMatrixWorld(true)
      } catch (errAdd) {
        console.warn(`Error al unir ${uniones[i].nombre}:`, errAdd)
      }
    }

    // --- FASE 2: APLICACIÓN DE TODAS LAS SUSTRACCIONES (-) ---
    for (let j = 0; j < sustracciones.length; j++) {
      const subBlock = sustracciones[j]
      const subMesh = createBlockMesh(subBlock, baseMaterial)
      if (!subMesh) continue

      // Comprobar si la figura sustractiva intersecta la envolvente del pozo actual.
      // Si flota en el aire o está completamente fuera, se omite para optimizar CPU
      // y evitar operaciones nulas en el vacío.
      const currentBox = new THREE.Box3().setFromObject(compositeMesh)
      const subBox = new THREE.Box3().setFromObject(subMesh)

      if (!currentBox.intersectsBox(subBox)) {
        continue
      }

      try {
        compositeMesh = CSG.subtract(compositeMesh, subMesh)
        compositeMesh.updateMatrix()
        compositeMesh.updateMatrixWorld(true)
      } catch (errSub) {
        console.warn(`Error al restar ${subBlock.nombre}:`, errSub)
      }
    }

    // Asegurar material y normales suaves
    if (compositeMesh.geometry) {
      compositeMesh.geometry.computeVertexNormals()
    }
    compositeMesh.material = baseMaterial

    const finalVolume = calculateGeometryVolume(compositeMesh.geometry)

    return {
      mesh: compositeMesh,
      volume: finalVolume,
      error: null
    }
  } catch (err) {
    console.error('Error general en generación CSG:', err)
    return { mesh: null, volume: 0, error: err.message }
  }
}

/**
 * Snapping magnético inteligente entre caras de bloques
 */
export function snapBlockToBounds(targetBlock, allBlocks, threshold = 0.3) {
  if (!targetBlock) return { pos_x: targetBlock.pos_x, pos_y: targetBlock.pos_y, pos_z: targetBlock.pos_z }

  let bestX = targetBlock.pos_x
  let bestY = targetBlock.pos_y
  let bestZ = targetBlock.pos_z

  const tHalfL = (targetBlock.largo || 2) / 2
  const tHalfW = (targetBlock.ancho || 2) / 2
  const tH = targetBlock.alto || 2

  const tMinX = targetBlock.pos_x - tHalfL
  const tMaxX = targetBlock.pos_x + tHalfL
  const tMinZ = targetBlock.pos_z - tHalfW
  const tMaxZ = targetBlock.pos_z + tHalfW
  const tMinY = targetBlock.pos_y
  const tMaxY = targetBlock.pos_y + tH

  for (const b of allBlocks) {
    if (b.id === targetBlock.id) continue

    const bHalfL = (b.largo || 2) / 2
    const bHalfW = (b.ancho || 2) / 2
    const bH = b.alto || 2

    const bMinX = b.pos_x - bHalfL
    const bMaxX = b.pos_x + bHalfL
    const bMinZ = b.pos_z - bHalfW
    const bMaxZ = b.pos_z + bHalfW
    const bMinY = b.pos_y
    const bMaxY = b.pos_y + bH

    // Snap Eje X
    if (Math.abs(tMinX - bMaxX) < threshold) bestX = bMaxX + tHalfL
    else if (Math.abs(tMaxX - bMinX) < threshold) bestX = bMinX - tHalfL
    else if (Math.abs(tMinX - bMinX) < threshold) bestX = bMinX + tHalfL
    else if (Math.abs(tMaxX - bMaxX) < threshold) bestX = bMaxX - tHalfL

    // Snap Eje Z
    if (Math.abs(tMinZ - bMaxZ) < threshold) bestZ = bMaxZ + tHalfW
    else if (Math.abs(tMaxZ - bMinZ) < threshold) bestZ = bMinZ - tHalfW
    else if (Math.abs(tMinZ - bMinZ) < threshold) bestZ = bMinZ + tHalfW
    else if (Math.abs(tMaxZ - bMaxZ) < threshold) bestZ = bMaxZ - tHalfW

    // Snap Eje Y
    if (Math.abs(tMinY - bMaxY) < threshold) bestY = bMaxY
    else if (Math.abs(tMinY - bMinY) < threshold) bestY = bMinY
  }

  return { pos_x: bestX, pos_y: bestY, pos_z: bestZ }
}
