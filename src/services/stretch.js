import * as THREE from 'three'
import { getBlockBounds } from './csgService.js'
import { GEOMETRY_TYPES } from './geometryCatalog.js'

/**
 * Modo "Estirar": cada tirador está sobre una cara y cambia una medida de la
 * figura. La pieza sigue siendo la misma figura, así que su fórmula no cambia.
 *
 * En todos los tiradores la cara arrastrada se mueve exactamente `d` metros en
 * la dirección `dir`:
 *  - factor: cuánto cambia la medida por metro (1: cara opuesta fija;
 *    2: crece simétrico desde el centro)
 *  - shift: cuánto se corre el origen de la pieza por metro (en ejes locales)
 *    para que la cara opuesta no se mueva
 */

const MIN_DEFAULT = 0.1
export const SNAP_DISTANCE = 0.35

const h = (id, param, point, dir, factor = 1, shift = [0, 0, 0]) => ({ id, param, point, dir, factor, shift })

// Caras ±x y ±z con la cara opuesta fija (las figuras están centradas en planta)
const alongX = (sign, y, z = 0) => b => h(`x${sign}`, 'largo', [sign * b.largo / 2, y(b), z], [sign, 0, 0], 1, [sign / 2, 0, 0])
const alongZ = (sign, y, x = () => 0) => b => h(`z${sign}`, 'ancho', [x(b), y(b), sign * b.ancho / 2], [0, 0, sign], 1, [0, 0, sign / 2])
const mid = b => b.alto / 2
const floor = () => 0
// Techo: el piso queda fijo. Piso: el techo queda fijo
const top = (x = () => 0, z = () => 0) => b => h('arriba', 'alto', [x(b), b.alto, z(b)], [0, 1, 0])
const bottom = b => h('abajo', 'alto', [0, 0, 0], [0, -1, 0], 1, [0, -1, 0])

// Diámetros: el eje queda fijo y la figura crece hacia todos los lados
const radial = (param, y, idPrefix) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([sx, sz]) => b =>
  h(`${idPrefix}${sx},${sz}`, param, [sx * b[param] / 2, y(b), sz * b[param] / 2], [sx, 0, sz], 2))

const HANDLES = {
  caja: [alongX(1, mid), alongX(-1, mid), alongZ(1, mid), alongZ(-1, mid), top(), bottom],
  // x+: cara vertical · x-: filo · arriba: borde superior de la cara vertical
  cuna_regular: [
    alongX(1, mid), alongX(-1, floor),
    alongZ(1, b => b.alto / 4, b => b.largo / 4), alongZ(-1, b => b.alto / 4, b => b.largo / 4),
    top(b => b.largo / 2)
  ],
  // Vértice de ángulos rectos en (-L/2, 0, -W/2)
  piramidal: [
    alongX(-1, b => b.alto / 3, 0), alongX(1, floor, 0),
    alongZ(-1, b => b.alto / 3), alongZ(1, floor, b => -b.largo / 2),
    top(b => -b.largo / 2, b => -b.ancho / 2)
  ],
  cilindro: [...radial('diametro_d', mid, 'd'), top(), bottom],
  tronco_cono: [
    ...radial('diametro_d', b => b.alto, 'D'),
    ...radial('diametro_d_menor', floor, 'd'),
    top(), bottom
  ],
  // Cilindro elíptico: eje sobre X; la sección crece simétrica
  elipsoide: [
    alongX(1, mid), alongX(-1, mid),
    b => h('z1', 'ancho', [0, b.alto / 2, b.ancho / 2], [0, 0, 1], 2),
    b => h('z-1', 'ancho', [0, b.alto / 2, -b.ancho / 2], [0, 0, -1], 2),
    top()
  ]
}

const euler = b => new THREE.Euler(b.rot_x || 0, b.rot_y || 0, b.rot_z || 0)
const origin = b => new THREE.Vector3(b.pos_x || 0, b.pos_y || 0, b.pos_z || 0)

export function supportsStretch(block) {
  return Boolean(HANDLES[block?.tipo_figura])
}

/** Tiradores de una pieza, con posición y dirección en coordenadas del mundo. */
export function getHandles(block) {
  return (HANDLES[block?.tipo_figura] || []).map(make => {
    const handle = make(block)
    return {
      ...handle,
      worldPoint: new THREE.Vector3(...handle.point).applyEuler(euler(block)).add(origin(block)),
      worldDir: new THREE.Vector3(...handle.dir).normalize().applyEuler(euler(block))
    }
  })
}

/**
 * Distancia a lo largo de la recta (punto, dir) más cercana al rayo del puntero.
 * null si se mira casi de frente a la dirección y no se puede arrastrar.
 */
export function dragDistance(point, dir, ray) {
  const w = point.clone().sub(ray.origin)
  const b = dir.dot(ray.direction)
  const denom = 1 - b * b
  if (denom < 0.02) return null
  return (b * ray.direction.dot(w) - dir.dot(w)) / denom
}

/** Pieza resultante de mover la cara del tirador `d` metros. */
export function applyStretch(start, handle, d) {
  const shift = new THREE.Vector3(...handle.shift).multiplyScalar(d).applyEuler(euler(start))
  return {
    ...start,
    [handle.param]: start[handle.param] + d * handle.factor,
    pos_x: (start.pos_x || 0) + shift.x,
    pos_y: (start.pos_y || 0) + shift.y,
    pos_z: (start.pos_z || 0) + shift.z
  }
}

const AXES = ['x', 'y', 'z']

/** ¿Las cajas están cerca en los dos ejes distintos de `axis`? */
export function nearOnOtherAxes(a, b, axis, distance) {
  return AXES.every(k => k === axis || (a.min[k] - b.max[k] <= distance && b.min[k] - a.max[k] <= distance))
}

/**
 * Calcula el arrastre final de un tirador: primero el imán a caras de piezas
 * cercanas, si no el redondeo (a la cuadrícula con imán, a 1 cm sin él), y
 * siempre respetando la medida mínima.
 *
 * @returns {{ block: object, face: {axis: string, value: number, box: THREE.Box3}|null }}
 */
export function resolveStretch(start, handle, rawD, others, { snap = true, step = 0.25 } = {}) {
  const def = GEOMETRY_TYPES[start.tipo_figura]
  const min = def.params.find(p => p.key === handle.param)?.min ?? MIN_DEFAULT
  const startValue = start[handle.param]
  const minD = (min - startValue) / handle.factor

  const world = getHandles(start).find(x => x.id === handle.id)
  const axis = AXES.find(k => Math.abs(world.worldDir[k]) > 0.999)

  let face = null
  let d = null
  if (snap && axis) {
    const sign = Math.sign(world.worldDir[axis])
    const current = world.worldPoint[axis] + sign * rawD
    const target = getBlockBounds(applyStretch(start, handle, Math.max(rawD, minD)))
    for (const other of others) {
      if (other.id === start.id) continue
      const box = getBlockBounds(other)
      if (!box || !nearOnOtherAxes(target, box, axis, SNAP_DISTANCE)) continue
      for (const value of [box.min[axis], box.max[axis]]) {
        const gap = Math.abs(value - current)
        const candidate = (value - world.worldPoint[axis]) * sign
        if (gap < SNAP_DISTANCE && candidate >= minD && (!face || gap < face.gap)) {
          face = { axis, value, box, gap }
          d = candidate
        }
      }
    }
  }

  if (d === null) {
    const grid = snap ? step : 0.01
    const value = Math.round((startValue + rawD * handle.factor) / grid) * grid
    d = (Math.max(min, value) - startValue) / handle.factor
  }

  const block = applyStretch(start, handle, d)
  // Sin restos de coma flotante en la medida
  block[handle.param] = Math.round(block[handle.param] * 1e6) / 1e6
  return { block, face }
}
