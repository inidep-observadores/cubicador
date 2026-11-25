import * as THREE from 'three'
import { ADDITION, SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg'
import { GEOMETRY_TYPES } from './geometryCatalog'

let evaluator = null

function getEvaluator() {
  if (!evaluator) {
    evaluator = new Evaluator()
    evaluator.useGroups = false
    evaluator.consolidateGroups = false
    // Solo requerir position y normal para compatibilidad universal con mallas custom
    evaluator.attributes = ['position', 'normal']
  }
  return evaluator
}

/**
 * Asegura que una geometría tenga los atributos requeridos por CSG (normales y UVs dummy)
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
 * Genera el sólido booleano resultante (CSG) a partir de la lista de bloques
 * Lógica robusta en 2 etapas:
 * 1) Fusión secuencial de todas las UNIONES (+) para formar el cuerpo completo del pozo.
 * 2) Aplicación secuencial de todas las SUSTRACCIONES (-) como sacabocados/cortes sobre el cuerpo unificado.
 */
export function buildCompositePozo(bloques) {
  if (!bloques || bloques.length === 0) {
    return { mesh: null, volume: 0, error: null }
  }

  try {
    const evalInstance = getEvaluator()

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
    const firstBlock = uniones[0]
    const firstDef = GEOMETRY_TYPES[firstBlock.tipo_figura]
    if (!firstDef) return { mesh: null, volume: 0, error: 'Figura no reconocida.' }

    const firstGeom = sanitizeGeometry(firstDef.createGeometry(firstBlock))
    let compositeBrush = new Brush(firstGeom, baseMaterial)
    compositeBrush.position.set(firstBlock.pos_x, firstBlock.pos_y, firstBlock.pos_z)
    compositeBrush.rotation.set(firstBlock.rot_x, firstBlock.rot_y, firstBlock.rot_z)
    compositeBrush.updateMatrixWorld()

    for (let i = 1; i < uniones.length; i++) {
      const block = uniones[i]
      const def = GEOMETRY_TYPES[block.tipo_figura]
      if (!def) continue

      const geom = sanitizeGeometry(def.createGeometry(block))
      const brush = new Brush(geom, baseMaterial)
      brush.position.set(block.pos_x, block.pos_y, block.pos_z)
      brush.rotation.set(block.rot_x, block.rot_y, block.rot_z)
      brush.updateMatrixWorld()

      try {
        compositeBrush = evalInstance.evaluate(compositeBrush, brush, ADDITION)
        compositeBrush.updateMatrixWorld()
      } catch (errAdd) {
        console.warn(`Error al unir ${block.nombre}:`, errAdd)
      }
    }

    // --- FASE 2: APLICACIÓN DE TODAS LAS SUSTRACCIONES (-) ---
    for (let j = 0; j < sustracciones.length; j++) {
      const block = sustracciones[j]
      const def = GEOMETRY_TYPES[block.tipo_figura]
      if (!def) continue

      const geom = sanitizeGeometry(def.createGeometry(block))
      const brush = new Brush(geom, baseMaterial)
      brush.position.set(block.pos_x, block.pos_y, block.pos_z)
      brush.rotation.set(block.rot_x, block.rot_y, block.rot_z)
      brush.updateMatrixWorld()

      try {
        compositeBrush = evalInstance.evaluate(compositeBrush, brush, SUBTRACTION)
        compositeBrush.updateMatrixWorld()
      } catch (errSub) {
        console.warn(`Error al restar ${block.nombre}:`, errSub)
      }
    }

    // Recalcular normales para suavizar bordes del corte
    if (compositeBrush.geometry) {
      compositeBrush.geometry.computeVertexNormals()
    }

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
