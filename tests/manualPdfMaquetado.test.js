// Revisa cómo quedó cada página del PDF del manual
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAIZ, PDF, MANUAL } from '../scripts/manual-pdf/fuentes.mjs'
import { analizarPdf } from '../scripts/manual-pdf/analizar.mjs'
import { REGLAS, capitulosDe } from '../scripts/manual-pdf/revisar.mjs'

const capitulos = capitulosDe(readFileSync(join(RAIZ, MANUAL), 'utf8').replace(/\r\n/g, '\n'))
let analisis

before(async () => {
  analisis = await analizarPdf(join(RAIZ, PDF))
})

test('maquetado: se reconocen los capítulos y las páginas', () => {
  assert.ok(capitulos.length >= 10)
  assert.ok(analisis.paginas.length > capitulos.length)
})

for (const [nombre, regla] of Object.entries(REGLAS)) {
  test(`maquetado: ${nombre}`, () => {
    assert.deepEqual(regla(analisis, capitulos), [])
  })
}
