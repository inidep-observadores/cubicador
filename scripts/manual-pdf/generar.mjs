/**
 * Genera el PDF del manual de usuario (docs/manual-de-usuario.pdf).
 *
 * Uso: npm run manual:pdf
 * Hay que correrlo después de cambiar el manual, sus imágenes o la versión.
 * Para probar un cambio de maquetado sin tocar el PDF publicado:
 *   node scripts/manual-pdf/generar.mjs salida.pdf
 *
 * Usa Chrome o Edge instalados (versión 131 o posterior, por el encabezado y el
 * pie definidos en CSS).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { Marked } from 'marked'
import puppeteer from 'puppeteer-core'
import { slug } from '../../src/services/slug.js'
import { RAIZ, MANUAL, PDF, HUELLA, ICONO, ESTILOS, huellaFuentes, sha256, version } from './fuentes.mjs'

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

const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8')

const TIPOS = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' }
const comoDataUrl = (ruta) =>
  `data:${TIPOS[extname(ruta)]};base64,${readFileSync(join(RAIZ, ruta)).toString('base64')}`

const marked = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
    // En un PDF solo sirven los enlaces internos y los de la web
    link({ href, tokens }) {
      const contenido = this.parser.parseInline(tokens)
      return /^(#|https?:)/.test(href) ? `<a href="${href}">${contenido}</a>` : contenido
    }
  }
})

// El título lo reemplaza la portada, y sobra decir dónde leer el manual
const fuente = leer(MANUAL)
  .replace(/\r\n/g, '\n')
  .replace(/^# .*$/m, '')
  .replace(/^> \*\*Dónde leer este manual:\*\*.*$/m, '')

const cuerpo = marked
  .parse(fuente)
  .replace(/(<img[^>]*?src=")(img\/[^"]+)"/g, (_, antes, ruta) => `${antes}${comoDataUrl('docs/' + ruta)}"`)
  .replace(/<img([^>]*?) width="(\d+)"/g, '<img$1 width="$2" style="--ancho: $2px"')

const fecha = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Cubicación 3D de Pozos de Pesca - Manual de usuario</title>
<style>:root { --version: "${version()}"; }
${leer(ESTILOS)}</style>
</head>
<body>
<section class="portada">
  <img src="${comoDataUrl(ICONO)}" alt="">
  <p class="titulo">Cubicación 3D<br>de Pozos de Pesca</p>
  <div class="linea"></div>
  <p class="subtitulo">Manual de usuario</p>
  <p class="datos">Versión ${version()} · ${fecha}</p>
</section>
<main>
<div class="introduccion">${cuerpo.slice(0, cuerpo.indexOf('<h2'))}</div>
${cuerpo.slice(cuerpo.indexOf('<h2'))}
</main>
</body>
</html>`

const prueba = process.argv[2]
const destino = prueba ? resolve(prueba) : join(RAIZ, PDF)

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--lang=es-AR'] })
try {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })

  const rotas = await page.evaluate(async () => {
    const rotas = []
    for (const img of document.querySelectorAll('img')) {
      await img.decode().catch(() => rotas.push(img.alt))
      // Las capturas van como JPEG: en WebP, Chrome las guarda sin comprimir y
      // el PDF pesa varias veces más
      if (!img.src.startsWith('data:image/webp') || !img.naturalWidth) continue
      const escala = Math.min(1, 1400 / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * escala)
      canvas.height = Math.round(img.naturalHeight * escala)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = canvas.toDataURL('image/jpeg', 0.82)
      await img.decode()
    }
    // Las tablas chicas no se parten entre dos páginas
    for (const tabla of document.querySelectorAll('table')) {
      if (tabla.rows.length <= 9) tabla.classList.add('corta')
    }
    return rotas
  })
  if (rotas.length) throw new Error('Imágenes que no se pudieron cargar: ' + rotas.join(', '))

  await page.pdf({
    path: destino,
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    outline: true
  })
} finally {
  await browser.close()
}

const pdf = readFileSync(destino)
if (!prueba) {
  writeFileSync(join(RAIZ, HUELLA), JSON.stringify({ pdf: sha256(pdf), ...huellaFuentes() }, null, 2) + '\n')
}

console.log(`Manual en ${prueba ? destino : PDF} (${(pdf.length / 1024 / 1024).toFixed(2)} MB)`)
