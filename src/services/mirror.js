import * as THREE from 'three'
import { getBlockBounds } from './csgService.js'

/**
 * Espejo de una pieza respecto de un eje de la bodega, en su mismo lugar.
 *
 * Una reflexión no se puede guardar como giro, pero casi todas las figuras tienen
 * un plano de simetría propio: reflejar la pieza en la bodega equivale a girarla
 * con  R' = M · R · S,  donde M es la reflexión pedida y S la simetría de la
 * figura (las dos invierten el sentido, así que R' es un giro). La piramidal no
 * tiene plano de simetría: su espejo es la misma figura con largo y ancho
 * intercambiados y reflejada en el plano diagonal x = z.
 *
 * La pieza queda ocupando la misma caja envolvente que antes.
 */

const flip = (axis) => new THREE.Matrix4().makeScale(
  axis === 'x' ? -1 : 1,
  axis === 'y' ? -1 : 1,
  axis === 'z' ? -1 : 1
)

const SWAP_XZ = new THREE.Matrix4().set(
  0, 0, 1, 0,
  0, 1, 0, 0,
  1, 0, 0, 0,
  0, 0, 0, 1
)

// Simetría propia de cada figura (en sus ejes locales) y medidas que intercambia
const SIMETRIA = {
  piramidal: { matrix: SWAP_XZ, swap: [['largo', 'ancho'], ['desvio_largo', 'desvio_ancho']] },
  elipsoide: { matrix: flip('x') }
}
const SIMETRIA_POR_DEFECTO = { matrix: flip('z') }

export const EJES_ESPEJO = [
  { axis: 'x', label: 'X', nombre: 'Eslora', detalle: 'proa ↔ popa' },
  { axis: 'y', label: 'Y', nombre: 'Puntal', detalle: 'arriba ↔ abajo' },
  { axis: 'z', label: 'Z', nombre: 'Manga', detalle: 'babor ↔ estribor' }
]

const limpio = (v) => {
  const r = Math.round(v * 1e9) / 1e9
  return Object.is(r, -0) ? 0 : r
}

/** Devuelve una copia de la pieza espejada sobre `axis` ('x', 'y' o 'z'). */
export function mirrorBlock(block, axis) {
  if (!['x', 'y', 'z'].includes(axis)) throw new Error('Eje inválido: ' + axis)
  const sim = SIMETRIA[block.tipo_figura] || SIMETRIA_POR_DEFECTO

  const R = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(block.rot_x || 0, block.rot_y || 0, block.rot_z || 0)
  )
  const giro = flip(axis).multiply(R).multiply(sim.matrix)
  const e = new THREE.Euler().setFromRotationMatrix(giro)

  const out = { ...block, rot_x: limpio(e.x), rot_y: limpio(e.y), rot_z: limpio(e.z) }
  for (const [a, b] of sim.swap || []) {
    out[a] = block[b] || 0
    out[b] = block[a] || 0
  }

  // Mantener el lugar: misma caja envolvente que antes
  const antes = getBlockBounds(block)
  const despues = getBlockBounds(out)
  if (antes && despues) {
    for (const k of ['x', 'y', 'z']) {
      const delta = (antes.min[k] + antes.max[k] - despues.min[k] - despues.max[k]) / 2
      out['pos_' + k] = Math.round(((block['pos_' + k] || 0) + delta) * 1e6) / 1e6
    }
  }
  return out
}
