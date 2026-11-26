import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GEOMETRY_TYPES } from '../src/services/geometryCatalog.js'
import { snapBlockToBounds } from '../src/services/csgService.js'

const defaults = def => Object.fromEntries(def.params.map(p => [p.key, p.default]))

function meshVolume(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  const pos = g.attributes.position
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let total = 0
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    total += a.dot(b.cross(c)) / 6
  }
  return total // con signo: negativo = caras invertidas
}

for (const [key, def] of Object.entries(GEOMETRY_TYPES)) {
  const p = defaults(def)

  test(`${key}: el volumen de la malla coincide con la fórmula`, () => {
      const formula = def.calculateVolume(p)
      const malla = meshVolume(def.createGeometry(p))
      // 0.01 % de tolerancia: cubre las constantes redondeadas (0.2618)
      assert.ok(Math.abs(malla - formula) / formula < 1e-4,
        `fórmula ${formula.toFixed(4)} m³, malla ${malla.toFixed(4)} m³`)
    })

  test(`${key}: la base apoya en y=0 y está centrada en planta`, () => {
    const g = def.createGeometry(p)
    g.computeBoundingBox()
    const { min, max } = g.boundingBox
    assert.ok(Math.abs(min.y) < 1e-6, `min.y = ${min.y}`)
    assert.ok(Math.abs(min.x + max.x) < 0.02, `x: ${min.x} .. ${max.x}`)
    assert.ok(Math.abs(min.z + max.z) < 0.02, `z: ${min.z} .. ${max.z}`)
  })

  if (def.params.some(x => x.key === 'largo')) {
    test(`${key}: el largo corre sobre el eje X (eslora)`, () => {
      const g = def.createGeometry({ ...p, largo: 20 })
      g.computeBoundingBox()
      const size = g.boundingBox.getSize(new THREE.Vector3())
      assert.ok(Math.abs(size.x - 20) < 1e-5, `tamaño ${size.x} x ${size.y} x ${size.z}`)
    })
  }
}

const bloque = (id, tipo_figura, extra) => ({
  id, tipo_figura, ...defaults(GEOMETRY_TYPES[tipo_figura]),
  pos_x: 0, pos_y: 0, pos_z: 0, rot_x: 0, rot_y: 0, rot_z: 0, ...extra
})

test('snap: pega un cilindro a la cara de una caja según su diámetro', () => {
  const caja = bloque(1, 'caja', { largo: 4 })
  const cilindro = bloque(2, 'cilindro', { diametro_d: 1, pos_x: 2.6, pos_z: 0.7 })
  const { pos_x } = snapBlockToBounds(cilindro, [caja, cilindro])
  assert.ok(Math.abs(pos_x - 2.5) < 0.01, `pos_x = ${pos_x}`)
})

test('snap: respeta la rotación de la pieza', () => {
  const caja = bloque(1, 'caja', { largo: 4 })
  // girada 90° en planta, su medida sobre X pasa a ser el ancho (1 m)
  const girada = bloque(2, 'caja', { largo: 3, ancho: 1, rot_y: Math.PI / 2, pos_x: 2.6, pos_z: 5 })
  const { pos_x } = snapBlockToBounds(girada, [caja, girada])
  assert.ok(Math.abs(pos_x - 2.5) < 1e-5, `pos_x = ${pos_x}`)
})

test('la malla cierra con medidas extremas (lados muy distintos entre extremos)', () => {
  for (const tipo of ['trapezoide_conico_1', 'trapezoide_conico_2']) {
    const def = GEOMETRY_TYPES[tipo]
    const p = { largo: 7, alto: 2, base_a: 6, base_b: 0.3, diametro_d: 0.5, diametro_d_menor: 4 }
    const formula = def.calculateVolume(p)
    const malla = meshVolume(def.createGeometry(p))
    assert.ok(malla > 0, `${tipo}: caras invertidas`)
    assert.ok(Math.abs(malla - formula) / formula < 1e-5, `${tipo}: ${formula} vs ${malla}`)
  }
})

test('cuña irregular: ejemplo de la ficha da 4.923,75 m³', () => {
  const v = GEOMETRY_TYPES.cuna_irregular.calculateVolume({ base_a: 23.5, base_b: 13.5, largo: 45, alto: 13 })
  assert.ok(Math.abs(v - 4923.75) < 1e-9, `v = ${v}`)
})

test('decimales en español: acepta coma o punto y muestra coma', async () => {
  const { parseDecimal, formatDecimal } = await import('../src/services/decimal.js')
  assert.equal(parseDecimal('2,5'), 2.5)
  assert.equal(parseDecimal('2.5'), 2.5)
  assert.equal(parseDecimal('-0,25'), -0.25)
  assert.equal(parseDecimal('3,'), 3)
  assert.equal(parseDecimal(',5'), 0.5)
  for (const malo of ['', '-', ',', '1.234,5', '2,5m', '1e3']) assert.equal(parseDecimal(malo), null, malo)
  assert.equal(formatDecimal(2.5), '2,5')
  assert.equal(formatDecimal(1.2500000000000002), '1,25')
  assert.equal(formatDecimal(6), '6')
})
