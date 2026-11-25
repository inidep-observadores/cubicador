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
 * Caja envolvente real de un bloque: respeta la forma de cada figura y su rotación
 */
function getBlockBounds(block) {
  const def = GEOMETRY_TYPES[block.tipo_figura]
  if (!def) return null

  const geometry = def.createGeometry(block)
  geometry.applyMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(block.rot_x || 0, block.rot_y || 0, block.rot_z || 0)
    )
  )
  geometry.translate(block.pos_x || 0, block.pos_y || 0, block.pos_z || 0)
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  geometry.dispose()
  return box
}

/**
 * Snapping magnético inteligente entre caras de bloques.
 * En cada eje aplica el ajuste más corto que quede dentro del umbral.
 */
export function snapBlockToBounds(targetBlock, allBlocks, threshold = 0.3) {
  if (!targetBlock) return null

  const position = {
    pos_x: targetBlock.pos_x,
    pos_y: targetBlock.pos_y,
    pos_z: targetBlock.pos_z
  }
  const target = getBlockBounds(targetBlock)
  if (!target) return position

  const best = { x: null, y: null, z: null }
  const consider = (axis, delta) => {
    if (Math.abs(delta) >= threshold) return
    if (best[axis] === null || Math.abs(delta) < Math.abs(best[axis])) best[axis] = delta
  }

  for (const b of allBlocks) {
    if (b.id === targetBlock.id) continue
    const other = getBlockBounds(b)
    if (!other) continue

    // Planta: caras enfrentadas o alineadas
    for (const axis of ['x', 'z']) {
      consider(axis, other.max[axis] - target.min[axis])
      consider(axis, other.min[axis] - target.max[axis])
      consider(axis, other.min[axis] - target.min[axis])
      consider(axis, other.max[axis] - target.max[axis])
    }
    // Puntal: apoyar encima o compartir piso
    consider('y', other.max.y - target.min.y)
    consider('y', other.min.y - target.min.y)
  }

  position.pos_x += best.x || 0
  position.pos_y += best.y || 0
  position.pos_z += best.z || 0
  return position
}
