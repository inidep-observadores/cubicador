/**
 * Genera las capturas de pantalla del manual de usuario (docs/img/manual).
 *
 * Uso: con el servidor de desarrollo andando (npm run dev),
 *   npm run capturas -- [url]          (por defecto http://localhost:5173)
 *
 * Usa Chrome o Edge instalados, con un perfil temporal: arranca con los datos
 * de ejemplo y arma el pozo del ejemplo guiado del manual. No toca los datos
 * del navegador de uso diario.
 */
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const URL_APP = process.argv[2] || 'http://localhost:5173'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'img', 'manual')

const NAVEGADORES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean)
const executablePath = NAVEGADORES.find(p => existsSync(p))
if (!executablePath) throw new Error('No se encontró Chrome ni Edge. Indicá la ruta en CHROME_PATH.')

const ESCRITORIO = { width: 1440, height: 900, deviceScaleFactor: 2 }
const TELEFONO = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

const perfil = mkdtempSync(join(tmpdir(), 'cubicador-capturas-'))
mkdirSync(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: perfil,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--lang=es-AR']
})

const pausa = (ms) => new Promise(r => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setViewport(ESCRITORIO)
  await page.goto(URL_APP, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => {
    const s = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('editor')
    return s && !s.isLoading && s.dbReady && s.bloques.length > 0
  }, { timeout: 60000 })

  // Sin las herramientas de desarrollo de Vue en las capturas
  const sinDevtools = () => page.addStyleTag({ content: '#__vue-devtools-container__, #vue-inspector-container { display: none !important }' })
  await sinDevtools()

  // Acceso al store desde la página
  const store = (fn, ...args) => page.evaluate(async (code, args) => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor')
    // eslint-disable-next-line no-new-func
    return await new Function('s', 'args', `return (${code})(s, ...args)`)(s, args)
  }, fn.toString(), args)

  // Espera a que el volumen termine de calcularse y la escena se dibuje
  const listo = async () => {
    await page.waitForFunction(() => !document.body.innerText.includes('Calculando'), { timeout: 30000 })
    await pausa(700)
  }

  const guardar = (nombre, opciones = {}) =>
    page.screenshot({ path: join(OUT, nombre + '.webp'), type: 'webp', quality: 80, ...opciones })

  // Recorte de un elemento, con un margen opcional
  const recorte = async (nombre, buscar, margen = 0) => {
    const clip = await page.evaluate((code, margen) => {
      // eslint-disable-next-line no-new-func
      const el = new Function(`return (${code})()`)()
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: Math.max(0, r.x - margen),
        y: Math.max(0, r.y - margen),
        width: Math.min(innerWidth, r.width + 2 * margen),
        height: Math.min(innerHeight, r.height + 2 * margen)
      }
    }, buscar.toString(), margen)
    if (!clip) throw new Error('No se encontró el elemento para ' + nombre)
    await guardar(nombre, { clip })
  }

  const porTexto = (texto) => `() => [...document.querySelectorAll('body *')].find(e => e.childElementCount === 0 && e.textContent.trim().startsWith(${JSON.stringify(texto)}))`
  const fn = (code) => ({ toString: () => code })

  // --- Pozo del ejemplo guiado (capítulo 8) ---
  await store(async (s) => {
    await s.createPozo({ nombre: 'Pozo de ejemplo', notas: '' })
    const set = (b, k, v) => s.updateBlockProperty(b.id, k, v)
    const caja = s.bloques[0]
    set(caja, 'nombre', 'Cuerpo principal')
    set(caja, 'ancho', 5)

    await s.addBlockFromPalette('cilindro')
    const col = s.selectedBlock
    set(col, 'nombre', 'Columna')
    s.setBlockOperation(col.id, 'SUBSTRACCION')
    set(col, 'diametro_d', 0.4); set(col, 'alto', 3)
    set(col, 'pos_x', -1.5); set(col, 'pos_y', 0); set(col, 'pos_z', 1)

    await s.addBlockFromPalette('cuna_regular')
    const rampa = s.selectedBlock
    set(rampa, 'nombre', 'Rampa de proa')
    s.setBlockOperation(rampa.id, 'SUBSTRACCION')
    set(rampa, 'largo', 3); set(rampa, 'ancho', 5); set(rampa, 'alto', 0.5)
    set(rampa, 'pos_x', 1.5); set(rampa, 'pos_y', 0); set(rampa, 'pos_z', 0)
    set(rampa, 'rot_x', 0); set(rampa, 'rot_y', 0); set(rampa, 'rot_z', 0)
    s.toggleBlockLock(caja.id)
    s.selectedBlockId = rampa.id
  })
  await listo()

  // Acercar la cámara: rueda del mouse sobre el visor
  const acercar = async (pasos = 4) => {
    const r = await page.evaluate(() => { const b = document.querySelector('main').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })
    await page.mouse.move(r.x, r.y)
    for (let i = 0; i < pasos; i++) {
      await page.mouse.wheel({ deltaY: -200 })
      await pausa(150)
    }
    await pausa(800)
  }

  // En Rayos X se ven las piezas que restan, que quedan dentro del pozo
  await store((s) => { s.viewMode = 'rayosX' })
  await acercar()
  await listo()

  // Pantalla completa en escritorio (capítulo 3)
  await guardar('pantalla-escritorio')
  await recorte('barra-superior', fn(`() => document.querySelector('header')`))
  await recorte('paleta', fn(`() => document.querySelector('aside')`))
  await recorte('inspector', fn(`() => document.querySelectorAll('aside')[1]`))
  await recorte('lista-piezas', fn(`() => (${porTexto('Componentes del Pozo')})().parentElement`))

  // Visor: la columna seleccionada en modo Mover
  const visor = fn(`() => document.querySelector('main')`)
  await store((s) => { s.selectedBlockId = s.bloques[1].id; s.transformMode = 'translate' })
  await listo()
  await recorte('modo-mover', visor)

  // Modo Estirar sobre la rampa
  await store((s) => { s.selectedBlockId = s.bloques[2].id; s.transformMode = 'stretch' })
  await listo()
  await recorte('modo-estirar', visor)

  // Espejo: panel abierto con la rampa espejada en eslora
  await store((s) => { s.transformMode = 'translate'; s.mirrorBlock(s.bloques[2].id, 'x') })
  await page.click('[aria-label="Espejo"]')
  await listo()
  await recorte('espejo', visor)
  await page.click('[aria-label="Cerrar Espejo"]')
  await store((s) => { s.undo() })

  // Estilos de visualización
  await store((s) => { s.selectedBlockId = null })
  await listo()
  await recorte('rayos-x', visor)
  await store((s) => { s.viewMode = 'solido' })
  // Vista previa un poco más de costado, para que se vea el corte de la rampa
  await store((s) => { s.modelMode = 'solidoFinal' })
  const centro = await page.evaluate(() => { const b = document.querySelector('main').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })
  await page.mouse.move(centro.x, centro.y)
  await page.mouse.down()
  await page.mouse.move(centro.x + 220, centro.y - 18, { steps: 12 })
  await page.mouse.up()
  await listo()
  await recorte('vista-previa', visor)
  // Diálogo de exportar la imagen (capítulo 9)
  await page.click('[aria-label="Exportar imagen"]')
  await pausa(400)
  await page.evaluate(() => document.activeElement?.blur())
  await recorte('exportar-imagen', fn(`() => document.querySelector('[aria-labelledby="export-image-title"]')`), 12)
  await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby="export-image-title"] button')].find(b => b.textContent.trim() === 'Cancelar').click())
  await store((s) => { s.modelMode = 'edicion' })

  // Formulario del buque, con el factor de captura (capítulo 5)
  await store((s) => { s.openRecordForm('buque', s.selectedBuqueId) })
  await pausa(400)
  await page.evaluate(() => document.activeElement?.blur())
  await recorte('formulario-buque', fn(`() => document.querySelector('form[role="dialog"]')`), 12)
  await store((s) => { s.closeRecordForm() })

  // Menú de respaldos (capítulo 11)
  await page.click('[aria-label="Respaldos y copias"]')
  await pausa(400)
  await recorte('respaldos', fn(`() => (${porTexto('Respaldos y copias')})().closest('.absolute')`), 8)
  await page.click('[aria-label="Respaldos y copias"]')

  // Cotas y Medir (capítulo 7): un pozo que se angosta hacia el fondo
  await store(async (s) => {
    await s.createPozo({ nombre: 'Pozo con fondo inclinado', notas: '' })
    const set = (b, valores) => Object.entries(valores).forEach(([k, v]) => s.updateBlockProperty(b.id, k, v))
    set(s.bloques[0], { largo: 8, ancho: 5, alto: 3, pos_y: 2 })
    await s.addBlockFromPalette('trapezoide')
    set(s.selectedBlock, { largo: 8, base_a: 5, base_b: 1, alto: 2, pos_x: 0, pos_y: 0, pos_z: 0 })
    s.modelMode = 'solidoFinal'
    s.viewMode = 'solido'
  })
  await listo()
  await recorte('cotas', visor)

  await store(async (s) => {
    // Retiro del fondo (solo manga) y altura del costado (solo puntal)
    await s.addCota([4, 2, -2.5], [4, 0, -0.5], 'z')
    await s.addCota([4, 5, -2.5], [4, 2, -2.5], 'y')
    s.toggleMeasureMode()
  })
  await pausa(800)
  await recorte('medir', visor)
  await store(async (s) => {
    s.toggleMeasureMode()
    s.modelMode = 'edicion'
    await s.selectPozo(s.pozos.find(p => p.nombre === 'Pozo de ejemplo').id)
  })
  await listo()

  // Teléfono vertical (capítulo 3)
  await page.setViewport(TELEFONO)
  await page.reload({ waitUntil: 'networkidle0' })
  await sinDevtools()
  await page.waitForFunction(() => {
    const s = document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia?._s.get('editor')
    return s && !s.isLoading && s.bloques.length > 0
  }, { timeout: 60000 })
  await store(async (s) => {
    await s.selectPozo(s.pozos.find(p => p.nombre === 'Pozo de ejemplo').id)
    s.selectedBlockId = s.bloques[s.bloques.length - 1].id
    s.viewMode = 'rayosX'
  })
  await acercar(3)
  await listo()
  await guardar('pantalla-telefono')

  console.log('Capturas guardadas en', OUT)
} finally {
  await browser.close()
  rmSync(perfil, { recursive: true, force: true })
}
