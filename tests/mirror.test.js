import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GEOMETRY_TYPES } from '../src/services/geometryCatalog.js'
import { getBlockBounds } from '../src/services/csgService.js'
import { mirrorBlock } from '../src/services/mirror.js'

// Medidas distintas entre sí, para que ninguna simetría sea casual
const bloque = (tipo_figura, extra = {}) => {
  const def = GEOMETRY_TYPES[tipo_figura]
  const b = { id: 1, tipo_figura, pos_x: 1.5, pos_y: 0.25, pos_z: -2, rot_x: 0, rot_y: 0, rot_z: 0, ...extra }
  def.params.forEach((p, i) => { b[p.key] = p.default * (1 + 0.13 * i) })
  return { ...b, ...extra }
}

// Vértices de la pieza en la bodega
function verticesEnBodega(block) {
  const g = GEOMETRY_TYPES[block.tipo_figura].createGeometry(block)
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(block.rot_x, block.rot_y, block.rot_z)))
  g.translate(block.pos_x, block.pos_y, block.pos_z)
  const pos = g.attributes.position
  const out = []
  for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)))
  return out
}

// Cada punto de A tiene un punto de B a menos de `tol` (y al revés)
function mismaForma(a, b, tol) {
  const cerca = (p, lista) => lista.some(q => p.distanceTo(q) < tol)
  return a.every(p => cerca(p, b)) && b.every(p => cerca(p, a))
}

const CURVAS = new Set(['cilindro', 'tronco_cono', 'elipsoide'])

for (const tipo of Object.keys(GEOMETRY_TYPES)) {
  for (const axis of ['x', 'y', 'z']) {
    test(`espejo ${tipo} sobre ${axis}: es el reflejo exacto, en el mismo lugar`, () => {
      const start = bloque(tipo, { rot_y: Math.PI / 6, rot_x: Math.PI / 2 })
      const fin = mirrorBlock(start, axis)

      const a = getBlockBounds(start)
      const b = getBlockBounds(fin)
      for (const k of ['x', 'y', 'z']) {
        assert.ok(Math.abs(a.min[k] - b.min[k]) < 1e-4 && Math.abs(a.max[k] - b.max[k]) < 1e-4, `caja envolvente en ${k}`)
      }

      // Reflejo respecto del centro de la caja envolvente
      const c = (a.min[axis] + a.max[axis])
      const reflejados = verticesEnBodega(start).map(p => { const q = p.clone(); q[axis] = c - q[axis]; return q })
      // Las figuras curvas pasan por más cálculos trigonométricos
      const tol = CURVAS.has(tipo) ? 1e-3 : 1e-4
      assert.ok(mismaForma(reflejados, verticesEnBodega(fin), tol), 'misma forma que el reflejo')

      const def = GEOMETRY_TYPES[tipo]
      assert.ok(Math.abs(def.calculateVolume(fin) - def.calculateVolume(start)) < 1e-9, 'mismo volumen')
    })
  }
}

test('espejo dos veces sobre el mismo eje vuelve a la pieza original', () => {
  for (const tipo of Object.keys(GEOMETRY_TYPES)) {
    const start = bloque(tipo, { rot_y: Math.PI / 4 })
    const ida = mirrorBlock(mirrorBlock(start, 'z'), 'z')
    const a = verticesEnBodega(start)
    const b = verticesEnBodega(ida)
    assert.ok(mismaForma(a, b, CURVAS.has(tipo) ? 1e-3 : 1e-4), tipo)
  }
})

test('cuña regular espejada en eslora: el filo pasa al otro extremo', () => {
  const cuna = bloque('cuna_regular', { pos_x: 0, pos_z: 0 })
  const fin = mirrorBlock(cuna, 'x')
  // La parte alta de la cuña cambia de extremo
  const alto = (b) => verticesEnBodega(b).filter(p => p.y > 0.99 * getBlockBounds(b).max.y)
  const xAlto = (b) => alto(b).reduce((s, p) => s + p.x, 0) / alto(b).length
  assert.ok(Math.sign(xAlto(cuna)) === -Math.sign(xAlto(fin)) && Math.abs(xAlto(cuna) + xAlto(fin)) < 1e-6)
})

for (const axis of ['x', 'y', 'z']) {
  test(`espejo piramidal con el vértice desplazado sobre ${axis}`, () => {
    const start = bloque('piramidal', { desvio_largo: 1.3, desvio_ancho: -0.4, rot_y: Math.PI / 6 })
    const fin = mirrorBlock(start, axis)
    const a = getBlockBounds(start)
    const c = a.min[axis] + a.max[axis]
    const reflejados = verticesEnBodega(start).map(p => { const q = p.clone(); q[axis] = c - q[axis]; return q })
    assert.ok(mismaForma(reflejados, verticesEnBodega(fin), 1e-4))
  })
}
