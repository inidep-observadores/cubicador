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
 *
 * Si alguna operación falla, el resultado trae `error`: el volumen de la malla
 * no es confiable y no debe informarse como volumen real.
 */
export function buildCompositePozo(bloques) {
  if (!bloques || bloques.length === 0) {
    return { mesh: null, volume: 0, error: null }
  }

  try {
    const uniones = bloques.filter(b => b.operacion === 'UNION')
    const sustracciones = bloques.filter(b => b.operacion === 'SUBSTRACCION')

    // Sin piezas de unión no hay cuerpo: el volumen es 0 de forma legítima
    if (uniones.length === 0) {
      return { mesh: null, volume: 0, error: null }
    }

    const fallas = []

    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide
    })

    // --- FASE 1: FUSIÓN DE TODAS LAS UNIONES (+) ---
    let compositeMesh = createBlockMesh(uniones[0], baseMaterial)
    if (!compositeMesh) {
      return { mesh: null, volume: 0, error: `Figura no reconocida: ${uniones[0].nombre}` }
    }

    for (let i = 1; i < uniones.length; i++) {
      const blockMesh = createBlockMesh(uniones[i], baseMaterial)
      if (!blockMesh) {
        fallas.push(`figura no reconocida: ${uniones[i].nombre}`)
        continue
      }

      try {
        compositeMesh = CSG.union(compositeMesh, blockMesh)
        compositeMesh.updateMatrix()
        compositeMesh.updateMatrixWorld(true)
      } catch (errAdd) {
        console.warn(`Error al unir ${uniones[i].nombre}:`, errAdd)
        fallas.push(`no se pudo unir ${uniones[i].nombre}`)
      }
    }

    // --- FASE 2: APLICACIÓN DE TODAS LAS SUSTRACCIONES (-) ---
    for (let j = 0; j < sustracciones.length; j++) {
      const subBlock = sustracciones[j]
      const subMesh = createBlockMesh(subBlock, baseMaterial)
      if (!subMesh) {
        fallas.push(`figura no reconocida: ${subBlock.nombre}`)
        continue
      }

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
        fallas.push(`no se pudo restar ${subBlock.nombre}`)
      }
    }

    // Asegurar material y normales suaves
    if (compositeMesh.geometry) {
      compositeMesh.geometry.computeVertexNormals()
    }
    compositeMesh.material = baseMaterial

    const finalVolume = calculateGeometryVolume(compositeMesh.geometry)

    // Control de consistencia: el resultado nunca puede superar la suma de las uniones
    const sumaUniones = uniones.reduce((acc, b) => {
      const def = GEOMETRY_TYPES[b.tipo_figura]
      return acc + (def ? def.calculateVolume(b) : 0)
    }, 0)
    if (!Number.isFinite(finalVolume) || finalVolume > sumaUniones * 1.001 + 1e-6) {
      fallas.push('la malla resultante es inconsistente')
    }

    return {
      mesh: compositeMesh,
      volume: finalVolume,
      error: fallas.length ? `Cálculo 3D incompleto: ${fallas.join('; ')}` : null
    }
  } catch (err) {
    console.error('Error general en generación CSG:', err)
    return { mesh: null, volume: 0, error: err.message }
  }
}

/**
 * Caja envolvente real de un bloque: respeta la forma de cada figura y su rotación
 */
export function getBlockBounds(block) {
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
 * Snapping magnético entre caras de bloques cercanos.
 * En cada eje aplica el ajuste más corto dentro del umbral, solo contra piezas
 * que estén cerca en los otros dos ejes.
 *
 * Devuelve la posición y, en `faces`, las caras a las que se pegó
 * ({ axis, value, box }) para resaltarlas.
 */
export function snapBlockToBounds(targetBlock, allBlocks, threshold = 0.3) {
  if (!targetBlock) return null

  const result = {
    pos_x: targetBlock.pos_x,
    pos_y: targetBlock.pos_y,
    pos_z: targetBlock.pos_z,
    faces: []
  }
  const target = getBlockBounds(targetBlock)
  if (!target) return result

  const near = (box, axis) => ['x', 'y', 'z'].every(k =>
    k === axis || (target.min[k] - box.max[k] <= threshold && box.min[k] - target.max[k] <= threshold))

  const best = { x: null, y: null, z: null }
  const consider = (axis, from, value, box) => {
    const delta = value - from
    if (Math.abs(delta) >= threshold) return
    if (!best[axis] || Math.abs(delta) < Math.abs(best[axis].delta)) best[axis] = { delta, axis, value, box }
  }

  for (const b of allBlocks) {
    if (b.id === targetBlock.id) continue
    const other = getBlockBounds(b)
    if (!other) continue

    // Planta: caras enfrentadas o alineadas
    for (const axis of ['x', 'z']) {
      if (!near(other, axis)) continue
      consider(axis, target.min[axis], other.max[axis], other)
      consider(axis, target.max[axis], other.min[axis], other)
      consider(axis, target.min[axis], other.min[axis], other)
      consider(axis, target.max[axis], other.max[axis], other)
    }
    // Puntal: apoyar encima o compartir piso
    if (near(other, 'y')) {
      consider('y', target.min.y, other.max.y, other)
      consider('y', target.min.y, other.min.y, other)
    }
  }

  for (const axis of ['x', 'y', 'z']) {
    if (!best[axis]) continue
    result['pos_' + axis] += best[axis].delta
    result.faces.push(best[axis])
  }
  return result
}
