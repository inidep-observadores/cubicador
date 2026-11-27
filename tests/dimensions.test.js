import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GEOMETRY_TYPES } from '../src/services/geometryCatalog.js'
import { computeCompositeData } from '../src/services/csgCompute.js'
import {
  autoDimensions, boundsOf, findCorners, levels, manualDimension, snapPoint, toScreenShapes, formatMeters
} from '../src/services/dimensions.js'

const datos = (geometry) => {
  const positions = geometry.attributes.position.array
  return { ...boundsOf(positions), corners: findCorners(positions, geometry.index?.array) }
}
const figura = (tipo, valores = {}) => {
  const def = GEOMETRY_TYPES[tipo]
  const p = {}
  def.params.forEach(x => { p[x.key] = x.default })
  return def.createGeometry({ ...p, ...valores })
}
const redondo = (v) => Math.round(v * 100) / 100
const valores = (dims, axis, kind) => dims.filter(d => d.axis === axis && d.kind === kind).map(d => redondo(d.value))

test('una caja tiene 8 esquinas y solo cotas totales', () => {
  const d = datos(figura('caja', { largo: 8, ancho: 5, alto: 3 }))
  assert.equal(d.corners.length, 8)
  const dims = autoDimensions(d, [20, 10, 20])
  assert.deepEqual(dims.map(x => x.kind), ['total', 'total', 'total'])
  assert.deepEqual([valores(dims, 'x', 'total'), valores(dims, 'y', 'total'), valores(dims, 'z', 'total')], [[8], [3], [5]])
})

test('un cilindro no tiene esquinas: las facetas no cuentan', () => {
  assert.equal(datos(figura('cilindro')).corners.length, 0)
})

test('las líneas se ubican del lado que mira la cámara', () => {
  const d = datos(figura('caja', { largo: 8, ancho: 5, alto: 3 }))
  const largo = (camara) => autoDimensions(d, camara).find(x => x.axis === 'x')
  assert.ok(largo([0, 5, 20]).a[2] > d.max[2])
  assert.ok(largo([0, 5, -20]).a[2] < d.min[2])
})

test('pozo con quiebres: medidas parciales en cadena que suman el total', () => {
  // Dos piezas apiladas: abajo más angosta (como el fondo de un pozo)
  const pieza = (id, ancho, alto, pos_y) => ({
    id, nombre: 'p' + id, tipo_figura: 'caja', operacion: 'UNION', largo: 8, ancho, alto,
    pos_x: 0, pos_y, pos_z: 0, rot_x: 0, rot_y: 0, rot_z: 0
  })
  const res = computeCompositeData([pieza(1, 1, 2, 0), pieza(2, 5, 3, 2)])
  const dims = autoDimensions({ ...boundsOf(res.positions), corners: findCorners(res.positions, res.index) }, [20, 10, 20])

  assert.deepEqual(valores(dims, 'y', 'parcial'), [2, 3])
  assert.deepEqual(valores(dims, 'y', 'total'), [5])
  assert.deepEqual(valores(dims, 'z', 'parcial'), [2, 1, 2])
  assert.deepEqual(valores(dims, 'z', 'total'), [5])
  assert.deepEqual(valores(dims, 'x', 'parcial'), [])
})

test('con demasiados quiebres solo se informa el total', () => {
  const corners = [1, 2, 3, 4, 5, 6, 7].map(v => [v, 0, 0])
  const dims = autoDimensions({ min: [0, 0, 0], max: [8, 1, 1], corners }, [10, 10, 10])
  assert.deepEqual(valores(dims, 'x', 'parcial'), [])
  assert.deepEqual(valores(dims, 'x', 'total'), [8])
})

test('quiebres a menos de 1,5 cm se toman como uno solo', () => {
  assert.deepEqual(levels([[1, 0, 0], [1.01, 0, 0], [0.005, 0, 0]], 'x', 0, 2), [0, 1, 2])
})

test('cota a mano: directa o sobre un eje', () => {
  const a = [0, 0, 0]
  const b = [3, 4, 12]
  assert.equal(manualDimension({ a, b, eje: '' }).value, 13)
  const y = manualDimension({ a, b, eje: 'y' })
  assert.equal(y.value, 4)
  assert.deepEqual(y.b, [0, 4, 0])
  assert.deepEqual(y.ext, [[b, [0, 4, 0]]])
})

const plano = (p) => ({ x: p[0] * 100, y: p[1] * 100 })

test('en pantalla se omiten las cotas que no entran', () => {
  const dim = (largo) => ({ kind: 'total', value: largo, a: [0, 0, 0], b: [largo, 0, 0], ext: [] })
  const shapes = toScreenShapes([dim(2), dim(0.1)], plano)
  assert.equal(shapes.length, 1)
  assert.equal(shapes[0].label.text, '2,00 m')
  assert.equal(shapes[0].arrows.length, 2)
  assert.equal(formatMeters(3.456), '3,46 m')
})

test('imán de Medir: esquina antes que arista, y arista antes que superficie', () => {
  const escena = { corners: [[1, 0, 0]], edges: [[[0, 0, 0], [1, 0, 0]]], surface: [0.5, 0.5, 0] }
  assert.deepEqual(snapPoint({ x: 95, y: 3 }, escena, plano, 14).type, 'esquina')
  const arista = snapPoint({ x: 50, y: 4 }, escena, plano, 14)
  assert.equal(arista.type, 'arista')
  assert.deepEqual(arista.point, [0.5, 0, 0])
  assert.equal(snapPoint({ x: 50, y: 50 }, escena, plano, 14).type, 'superficie')
  assert.equal(snapPoint({ x: 50, y: 50 }, { ...escena, surface: null }, plano, 14), null)
})
