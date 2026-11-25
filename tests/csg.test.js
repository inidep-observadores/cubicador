import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GEOMETRY_TYPES } from '../src/services/geometryCatalog.js'
import { buildCompositePozo } from '../src/services/csgService.js'

const bloque = (id, tipo_figura, operacion, extra = {}) => ({
  id, tipo_figura, operacion, nombre: tipo_figura,
  ...Object.fromEntries(GEOMETRY_TYPES[tipo_figura].params.map(p => [p.key, p.default])),
  pos_x: 0, pos_y: 0, pos_z: 0, rot_x: 0, rot_y: 0, rot_z: 0, ...extra
})
const vol = b => GEOMETRY_TYPES[b.tipo_figura].calculateVolume(b)
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) / b < tol, `${msg}: esperado ${b.toFixed(4)}, CSG ${a.toFixed(4)}`)

for (const tipo of Object.keys(GEOMETRY_TYPES)) {
  test(`CSG: ${tipo} sola conserva su volumen`, () => {
    const b = bloque(1, tipo, 'UNION')
    cerca(buildCompositePozo([b]).volume, vol(b), 1e-4, tipo)
  })

  test(`CSG: ${tipo} unida a una caja disjunta suma ambos volúmenes`, () => {
    const caja = bloque(1, 'caja', 'UNION', { pos_x: 20 })
    const b = bloque(2, tipo, 'UNION')
    cerca(buildCompositePozo([caja, b]).volume, vol(caja) + vol(b), 1e-4, tipo)
  })

  test(`CSG: ${tipo} restada por completo de una caja grande`, () => {
    const caja = bloque(1, 'caja', 'UNION', { largo: 20, ancho: 20, alto: 10, pos_y: -1 })
    const b = bloque(2, tipo, 'SUBSTRACCION')
    cerca(buildCompositePozo([caja, b]).volume, vol(caja) - vol(b), 1e-4, tipo)
  })
}

test('CSG: solo sustracciones da volumen 0 sin error', () => {
  const r = buildCompositePozo([bloque(1, 'caja', 'SUBSTRACCION')])
  assert.equal(r.volume, 0)
  assert.equal(r.error, null)
})

test('CSG: una resta que vacía el pozo da volumen 0 real, no un error', () => {
  const caja = bloque(1, 'caja', 'UNION', { largo: 2, ancho: 2, alto: 2 })
  const corte = bloque(2, 'caja', 'SUBSTRACCION', { largo: 4, ancho: 4, alto: 4, pos_y: -1 })
  const r = buildCompositePozo([caja, corte])
  assert.equal(r.error, null)
  assert.ok(r.volume < 1e-9, `volumen ${r.volume}`)
})

test('CSG: una figura desconocida se informa como error', () => {
  const r = buildCompositePozo([bloque(1, 'caja', 'UNION'), { ...bloque(2, 'caja', 'UNION'), tipo_figura: 'inexistente', nombre: 'X' }])
  assert.match(r.error, /no reconocida: X/)
})

test('cálculo en segundo plano: la geometría sale en coordenadas del mundo', async () => {
  const { computeCompositeData } = await import('../src/services/csgCompute.js')
  const { getBlockBounds } = await import('../src/services/csgService.js')
  const caja = bloque(1, 'caja', 'UNION', { pos_x: 3, pos_y: 1, pos_z: -2, rot_y: Math.PI / 6 })
  const data = computeCompositeData([caja])
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < data.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], data.positions[i])
    max[i % 3] = Math.max(max[i % 3], data.positions[i])
  }
  const esperado = getBlockBounds(caja)
  ;['x', 'y', 'z'].forEach((eje, k) => {
    assert.ok(Math.abs(min[k] - esperado.min[eje]) < 1e-4 && Math.abs(max[k] - esperado.max[eje]) < 1e-4, `eje ${eje}`)
  })
  cerca(data.volume, vol(caja), 1e-4, 'volumen')
})

test('cliente de cálculo: piezas iguales comparten el mismo resultado', async () => {
  const { computeComposite } = await import('../src/services/csgClient.js')
  const piezas = [bloque(1, 'caja', 'UNION'), bloque(2, 'cilindro', 'SUBSTRACCION')]
  const a = computeComposite(piezas)
  const b = computeComposite(piezas.map(p => ({ ...p, nombre: 'otro nombre' }))) // el nombre no cambia la forma
  assert.equal(a, b)
  const r = await a
  cerca(r.volume, vol(piezas[0]) - vol(piezas[1]), 1e-4, 'volumen')
  assert.ok(r.geometry, 'devuelve la geometría para el visor')
})
