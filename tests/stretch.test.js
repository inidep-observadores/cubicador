import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GEOMETRY_TYPES } from '../src/services/geometryCatalog.js'
import { getBlockBounds, snapBlockToBounds, calculateGeometryVolume } from '../src/services/csgService.js'
import { getHandles, singleAxisHandles, applyStretch, resolveStretch, dragDistance, supportsStretch } from '../src/services/stretch.js'

const bloque = (id, tipo_figura, extra = {}) => ({
  id, tipo_figura,
  ...Object.fromEntries(GEOMETRY_TYPES[tipo_figura].params.map(p => [p.key, p.default])),
  pos_x: 0, pos_y: 0, pos_z: 0, rot_x: 0, rot_y: 0, rot_z: 0, ...extra
})
const casi = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg}: ${a} != ${b}`)
const FIGURAS = ['caja', 'cuna_regular', 'piramidal', 'cilindro', 'tronco_cono', 'elipsoide']

test('estirar: están las figuras de la fase 1 y no las de anchos simétricos', () => {
  for (const t of FIGURAS) assert.ok(supportsStretch(bloque(1, t)), t)
  assert.ok(!supportsStretch(bloque(1, 'trapezoide')))
})

for (const tipo of FIGURAS) {
  test(`estirar ${tipo}: cada tirador mueve su cara y respeta la cara opuesta, también girada`, () => {
    const start = bloque(1, tipo, { pos_x: 1, pos_y: 0.5, pos_z: -2, rot_y: Math.PI })
    const antes = getBlockBounds(start)
    for (const handle of singleAxisHandles(start).filter(h => !h.param.startsWith('desvio'))) {
      const d = 0.5
      const fin = applyStretch(start, handle, d)
      casi(fin[handle.param], start[handle.param] + d * handle.factor, handle.id + ' medida')
      const despues = getBlockBounds(fin)
      const axis = ['x', 'y', 'z'].find(k => Math.abs(handle.worldDir[k]) > 0.999)
      if (!axis) continue
      // el diámetro menor del cono no define la envolvente
      if (handle.param === 'diametro_d_menor') continue
      const [movida, fija] = handle.worldDir[axis] > 0 ? ['max', 'min'] : ['min', 'max']
      // las mallas curvas amplían el radio ~0,3 % para conservar el volumen
      const tolerancia = ['cilindro', 'tronco_cono', 'elipsoide'].includes(tipo) ? 0.01 : 0.001
      assert.ok(Math.abs(despues[movida][axis] - (antes[movida][axis] + d * handle.worldDir[axis])) < tolerancia, handle.id + ' cara arrastrada')
      if (handle.factor === 1) casi(despues[fija][axis], antes[fija][axis], handle.id + ' cara opuesta')
    }
  })
}

test('cuña regular: estirar un costado mantiene la figura y el costado opuesto', () => {
  const start = bloque(1, 'cuna_regular')
  const costado = getHandles(start).find(h => h.id === 'z1')
  const fin = applyStretch(start, costado, 1)
  casi(fin.ancho, start.ancho + 1, 'ancho')
  casi(getBlockBounds(fin).min.z, getBlockBounds(start).min.z, 'costado opuesto')
  casi(fin.largo, start.largo, 'largo')
})

test('imán al estirar: se pega a la cara de una pieza cercana', () => {
  const caja = bloque(1, 'caja', { largo: 6, ancho: 5 })
  const cuna = bloque(2, 'cuna_regular', { largo: 2, ancho: 4, pos_x: 4 })
  const costado = getHandles(cuna).find(h => h.id === 'z1')
  const { block, face } = resolveStretch(cuna, costado, 0.4, [caja, cuna])
  assert.equal(face?.axis, 'z')
  casi(getBlockBounds(block).max.z, 2.5, 'cara alineada con la caja')
})

test('imán al estirar: ignora piezas lejanas y redondea a la cuadrícula', () => {
  const lejana = bloque(1, 'caja', { largo: 6, ancho: 5, pos_x: 30 })
  const cuna = bloque(2, 'cuna_regular', { largo: 2, ancho: 4 })
  const costado = getHandles(cuna).find(h => h.id === 'z1')
  const r = resolveStretch(cuna, costado, 0.4, [lejana, cuna])
  assert.equal(r.face, null)
  casi(r.block.ancho, 4.5, 'cuadrícula de 0,25')
  casi(resolveStretch(cuna, costado, 0.4137, [], { snap: false }).block.ancho, 4.41, 'sin imán, al centímetro')
})

test('estirar: nunca baja de la medida mínima', () => {
  const caja = bloque(1, 'caja')
  const r = resolveStretch(caja, getHandles(caja)[0], -100, [])
  casi(r.block.largo, 0.1, 'mínimo')
})

test('imán al mover: no se alinea con una pieza que está lejos', () => {
  const lejana = bloque(1, 'caja', { largo: 4, pos_z: 40 })
  const caja = bloque(2, 'caja', { largo: 4, pos_x: 0.2 })
  const r = snapBlockToBounds(caja, [lejana, caja])
  casi(r.pos_x, 0.2, 'sin cambios')
  assert.equal(r.faces.length, 0)
})

test('arrastre: distancia sobre la dirección del tirador según el rayo del puntero', () => {
  const ray = new THREE.Ray(new THREE.Vector3(3, 10, 0), new THREE.Vector3(0, -1, 0))
  casi(dragDistance(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0), ray), 2, 'distancia')
  assert.equal(dragDistance(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), ray), null)
})

test('piramidal: el vértice se corre en paralelo a la base sin cambiar el volumen', () => {
  const def = GEOMETRY_TYPES.piramidal
  const start = bloque(1, 'piramidal', { largo: 2, ancho: 1.75, alto: 6, rot_z: Math.PI / 2 })
  const vertice = getHandles(start).find(h => h.id === 'vertice')
  assert.deepEqual(vertice.axes.map(a => a.param), ['desvio_largo', 'desvio_ancho'])
  for (const axis of vertice.axes) {
    for (const d of [1.5, -0.75]) {
      const fin = applyStretch(start, axis, d)
      casi(fin[axis.param], d, 'desvío')
      casi(def.calculateVolume(fin), def.calculateVolume(start), 'fórmula')
      casi(calculateGeometryVolume(def.createGeometry(fin)), def.calculateVolume(fin), 'malla')
      // La base no se mueve: solo el vértice
      const nuevo = getHandles(fin).find(h => h.id === 'vertice')
      casi(nuevo.worldPoint.distanceTo(vertice.worldPoint), Math.abs(d), 'recorrido del vértice')
    }
  }
})

test('piramidal: el vértice se arrastra a valores negativos, con cuadrícula', () => {
  const start = bloque(1, 'piramidal')
  const axis = getHandles(start).find(h => h.id === 'vertice').axes[0]
  casi(resolveStretch(start, axis, -0.8, []).block.desvio_largo, -0.75, 'negativo')
})
