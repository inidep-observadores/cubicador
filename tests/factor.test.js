import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseKg, captureFactor } from '../src/services/factor.js'

test('parseKg: acepta el separador de miles y la coma decimal', () => {
  assert.equal(parseKg('72000'), 72000)
  assert.equal(parseKg('72.000'), 72000)
  assert.equal(parseKg('72 000'), 72000)
  assert.equal(parseKg('1.250.000'), 1250000)
  assert.equal(parseKg('72.000,5'), 72000.5)
  assert.equal(parseKg('42,5'), 42.5)
  assert.equal(parseKg('42.5'), 42.5)
  assert.equal(parseKg('0.125'), 0.125)
  assert.equal(parseKg(''), null)
  assert.equal(parseKg('mucho'), null)
})

test('captureFactor: toneladas por metro cúbico con 3 decimales', () => {
  assert.equal(captureFactor(72000, 90), 0.8)
  assert.equal(captureFactor(68000, 85.87), 0.792)
})

test('captureFactor: sin datos válidos no hay resultado', () => {
  assert.equal(captureFactor(null, 90), null)
  assert.equal(captureFactor(72000, null), null)
  assert.equal(captureFactor(72000, 0), null)
  assert.equal(captureFactor(-1, 90), null)
  assert.equal(captureFactor(0.001, 90), null)
})
