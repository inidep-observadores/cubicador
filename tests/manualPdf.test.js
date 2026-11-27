import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, PDF, HUELLA, MANUAL, huellaFuentes, sha256 } from '../scripts/manual-pdf/fuentes.mjs'

const AVISO = 'El PDF del manual quedó desactualizado: corré "npm run manual:pdf" y subí los dos archivos.'
const guardada = () => JSON.parse(readFileSync(join(RAIZ, HUELLA), 'utf8'))

test('PDF del manual: existe y es el que generó el script', () => {
  assert.ok(existsSync(join(RAIZ, PDF)), AVISO)
  assert.equal(sha256(readFileSync(join(RAIZ, PDF))), guardada().pdf, AVISO)
})

test('PDF del manual: se generó con la versión actual', () => {
  assert.equal(guardada().version, huellaFuentes().version, AVISO)
})

test('PDF del manual: no cambió el texto, las imágenes ni el maquetado', () => {
  const actual = huellaFuentes().archivos
  const antes = guardada().archivos
  const cambiados = [...new Set([...Object.keys(actual), ...Object.keys(antes)])]
    .filter(ruta => actual[ruta] !== antes[ruta])
  assert.deepEqual(cambiados, [], `${AVISO} Cambiaron: ${cambiados.join(', ')}`)
})

test('manual: todas las imágenes que nombra existen', () => {
  const texto = readFileSync(join(RAIZ, MANUAL), 'utf8')
  const rutas = [...texto.matchAll(/(?:src="|\]\()(img\/[^")]+)/g)].map(m => m[1])
  assert.ok(rutas.length > 0)
  assert.deepEqual(rutas.filter(r => !existsSync(join(RAIZ, 'docs', r))), [])
})
