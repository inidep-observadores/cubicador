import test from 'node:test'
import assert from 'node:assert/strict'
import { IMAGE_THEMES, exportScale, paintDimensions, imageFileName } from '../src/services/exportImage.js'
import { toScreenShapes, manualDimension } from '../src/services/dimensions.js'

test('imagen: al menos el doble de la pantalla, sin pasar de 4096 px de lado', () => {
  assert.equal(exportScale(800, 600, 1), 2)
  assert.equal(exportScale(375, 600, 3.5), 3)
  assert.equal(exportScale(2400, 1200, 1) * 2400, 4096)
})

test('imagen: el nombre lleva buque, pozo y fecha sin caracteres inválidos', () => {
  const fecha = new Date('2026-11-27T12:00:00Z')
  assert.equal(imageFileName('Imaginario I', 'Pozo 1 (Popa)', fecha), 'Imaginario_I_Pozo_1_(Popa)_2026-11-27.png')
  assert.equal(imageFileName('B/P: "Uno"', '', fecha), 'BP_Uno_2026-11-27.png')
})

test('imagen: las cotas se dibujan con los colores del fondo elegido', () => {
  const shapes = toScreenShapes(
    [manualDimension({ a: [0, 0, 0], b: [5, 0, 0], eje: '' })],
    ([x, y]) => ({ x: x * 40, y: y * 40 })
  )
  for (const theme of Object.values(IMAGE_THEMES)) {
    const calls = []
    const ctx = new Proxy({}, {
      get: (target, key) => key in target
        ? target[key]
        : (...args) => calls.push({ key, args, fill: target.fillStyle, stroke: target.strokeStyle })
    })
    paintDimensions(ctx, shapes, theme)
    const fill = calls.find(c => c.key === 'fillText')
    assert.equal(fill.args[0], '5,00 m')
    assert.equal(fill.fill, theme.dimensions.manual)
    // El borde del texto es del color del fondo
    assert.equal(calls.find(c => c.key === 'strokeText').stroke, theme.halo)
  }
})
