import * as THREE from 'three'
import { ADDITION, SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg'
import { GEOMETRY_TYPES } from './geometryCatalog'

let evaluator = null

function getEvaluator() {
  if (!evaluator) {
    evaluator = new Evaluator()
    evaluator.useGroups = false
    evaluator.consolidateGroups = false
  }
  return evaluator
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

    // Volumen con signo del tetraedro con vértice en el origen: (p1 · (p2 × p3)) / 6
    const v3 = p2.clone().cross(p3)
    const vol = p1.dot(v3) / 6.0
    totalVolume += vol
  }

  return Math.abs(totalVolume)
}

/**
 * Genera el sólido booleano resultante (CSG) a partir de la lista de bloques
 * Realiza uniones (+) y sustracciones (-) en el orden correspondiente.
 * Retorna: { mesh, volume, error }
 */
export function buildCompositePozo(bloques) {
  if (!bloques || bloques.length === 0) {
    return { mesh: null, volume: 0, error: null }
  }

  try {
    const evalInstance = getEvaluator()

    // Encontrar el primer bloque de unión para iniciar la base
    const firstUnionIndex = bloques.findIndex(b => b.operacion === 'UNION')
    if (firstUnionIndex === -1) {
      return { mesh: null, volume: 0, error: 'Se requiere al menos un bloque de unión (+) como base.' }
    }

    // Material base para el sólido combinado final
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide
    })

    // Construir el primer Brush
    const firstBlock = bloques[firstUnionIndex]
    const firstDef = GEOMETRY_TYPES[firstBlock.tipo_figura]
    if (!firstDef) return { mesh: null, volume: 0, error: 'Figura no reconocida.' }

    const firstGeom = firstDef.createGeometry(firstBlock)
    let compositeBrush = new Brush(firstGeom, baseMaterial)
    compositeBrush.position.set(firstBlock.pos_x, firstBlock.pos_y, firstBlock.pos_z)
    compositeBrush.rotation.set(firstBlock.rot_x, firstBlock.rot_y, firstBlock.rot_z)
    compositeBrush.updateMatrixWorld()

    // Procesar los demás bloques secuencialmente
    for (let i = 0; i < bloques.length; i++) {
      if (i === firstUnionIndex) continue

      const block = bloques[i]
      const def = GEOMETRY_TYPES[block.tipo_figura]
      if (!def) continue

      const geom = def.createGeometry(block)
      const brush = new Brush(geom, baseMaterial)
      brush.position.set(block.pos_x, block.pos_y, block.pos_z)
      brush.rotation.set(block.rot_x, block.rot_y, block.rot_z)
      brush.updateMatrixWorld()

      const operation = block.operacion === 'SUBSTRACCION' ? SUBTRACTION : ADDITION
      try {
        compositeBrush = evalInstance.evaluate(compositeBrush, brush, operation)
      } catch (errCSG) {
        console.warn(`Error en operación booleana sobre ${block.nombre}:`, errCSG)
      }
    }

    // Calcular volumen real de la malla resultante
    const finalVolume = calculateGeometryVolume(compositeBrush.geometry)

    return {
      mesh: compositeBrush,
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
 * Detecta si los límites del bloque activo se encuentran a menos de un umbral (threshold)
 * de las caras de cualquier otro bloque y alinea automáticamente.
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

    // Snap Eje X (Alinear cara izquierda con cara derecha de otro bloque)
    if (Math.abs(tMinX - bMaxX) < threshold) bestX = bMaxX + tHalfL
    else if (Math.abs(tMaxX - bMinX) < threshold) bestX = bMinX - tHalfL
    else if (Math.abs(tMinX - bMinX) < threshold) bestX = bMinX + tHalfL
    else if (Math.abs(tMaxX - bMaxX) < threshold) bestX = bMaxX - tHalfL

    // Snap Eje Z
    if (Math.abs(tMinZ - bMaxZ) < threshold) bestZ = bMaxZ + tHalfW
    else if (Math.abs(tMaxZ - bMinZ) < threshold) bestZ = bMinZ - tHalfW
    else if (Math.abs(tMinZ - bMinZ) < threshold) bestZ = bMinZ + tHalfW
    else if (Math.abs(tMaxZ - bMaxZ) < threshold) bestZ = bMaxZ - tHalfW

    // Snap Eje Y (Poner encima o a la misma altura del piso)
    if (Math.abs(tMinY - bMaxY) < threshold) bestY = bMaxY
    else if (Math.abs(tMinY - bMinY) < threshold) bestY = bMinY
  }

  return { pos_x: bestX, pos_y: bestY, pos_z: bestZ }
}
