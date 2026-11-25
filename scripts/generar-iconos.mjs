/**
 * Genera los íconos de la PWA en /public sin dependencias externas.
 * Uso: npm run icons
 *
 * Diseño: corte transversal de un pozo de pesca (trapecio) con la carga en la
 * parte baja y la línea de cubierta arriba, sobre el fondo oscuro de la app.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const COLORES = {
  fondo: [15, 23, 42], // slate-900 (#0f172a, theme_color)
  vacio: [12, 42, 68], // interior vacío del pozo
  carga: [14, 165, 233], // sky-500
  borde: [125, 211, 252], // sky-300
  cubierta: [56, 189, 248] // sky-400
}

// --- Geometría en coordenadas unitarias (0..1, y hacia abajo) ---
const POZO = { arriba: 0.36, abajo: 0.76, anchoArriba: 0.62, anchoAbajo: 0.36 }
const NIVEL_CARGA = 0.52
const BORDE = 0.035
const CUBIERTA = { y: 0.27, x0: 0.14, x1: 0.86, grosor: 0.03 }

function semiAncho(y) {
  const t = (y - POZO.arriba) / (POZO.abajo - POZO.arriba)
  return (POZO.anchoArriba + (POZO.anchoAbajo - POZO.anchoArriba) * t) / 2
}

/** Distancia (aprox.) al borde del trapecio: positiva adentro. */
function distanciaPozo(x, y) {
  const dx = semiAncho(y) - Math.abs(x - 0.5)
  // los laterales están inclinados: corregir la distancia horizontal
  const pendiente = (POZO.anchoArriba - POZO.anchoAbajo) / 2 / (POZO.abajo - POZO.arriba)
  const lateral = dx / Math.sqrt(1 + pendiente * pendiente)
  return Math.min(lateral, y - POZO.arriba, POZO.abajo - y)
}

function enRectRedondeado(x, y, radio) {
  const cx = Math.min(Math.max(x, radio), 1 - radio)
  const cy = Math.min(Math.max(y, radio), 1 - radio)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radio * radio
}

/** Color del punto (x, y); null = transparente. */
function colorEn(x, y, { escala, radioFondo }) {
  if (radioFondo !== null && !enRectRedondeado(x, y, radioFondo)) return null
  // El contenido se dibuja escalado alrededor del centro (zona segura de los maskable)
  const u = 0.5 + (x - 0.5) / escala
  const v = 0.5 + (y - 0.5) / escala

  const enCubierta = Math.abs(v - CUBIERTA.y) <= CUBIERTA.grosor / 2 && u >= CUBIERTA.x0 && u <= CUBIERTA.x1
  if (enCubierta) return COLORES.cubierta

  const d = distanciaPozo(u, v)
  if (d >= 0) {
    if (d < BORDE) return COLORES.borde
    return v >= NIVEL_CARGA ? COLORES.carga : COLORES.vacio
  }
  return COLORES.fondo
}

/** Rasteriza con supermuestreo 4×4 para bordes suaves. */
function rasterizar(tamano, opciones) {
  const S = 4
  const pixeles = Buffer.alloc(tamano * tamano * 4)
  for (let py = 0; py < tamano; py++) {
    for (let px = 0; px < tamano; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = colorEn((px + (sx + 0.5) / S) / tamano, (py + (sy + 0.5) / S) / tamano, opciones)
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a += 1
        }
      }
      const i = (py * tamano + px) * 4
      if (a > 0) {
        pixeles[i] = Math.round(r / a)
        pixeles[i + 1] = Math.round(g / a)
        pixeles[i + 2] = Math.round(b / a)
      }
      pixeles[i + 3] = Math.round((a / (S * S)) * 255)
    }
  }
  return pixeles
}

// --- Codificador PNG mínimo (RGBA 8 bits) ---
const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}
function png(tamano, pixeles) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tamano, 0)
  ihdr.writeUInt32BE(tamano, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const filas = Buffer.alloc(tamano * (tamano * 4 + 1))
  for (let y = 0; y < tamano; y++) {
    filas[y * (tamano * 4 + 1)] = 0 // sin filtro
    pixeles.copy(filas, y * (tamano * 4 + 1) + 1, y * tamano * 4, (y + 1) * tamano * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// --- Variantes ---
const ICONOS = [
  // "any": fondo redondeado con transparencia en las esquinas
  { archivo: 'pwa-192x192.png', tamano: 192, escala: 1, radioFondo: 0.22 },
  { archivo: 'pwa-512x512.png', tamano: 512, escala: 1, radioFondo: 0.22 },
  // "maskable": fondo a sangre y contenido dentro de la zona segura (80 %)
  { archivo: 'pwa-maskable-512x512.png', tamano: 512, escala: 0.78, radioFondo: null },
  // iOS redondea por su cuenta y no admite transparencia
  { archivo: 'apple-touch-icon.png', tamano: 180, escala: 0.9, radioFondo: null },
  { archivo: 'favicon-32x32.png', tamano: 32, escala: 1, radioFondo: 0.22 }
]

for (const icono of ICONOS) {
  writeFileSync(join(PUBLIC, icono.archivo), png(icono.tamano, rasterizar(icono.tamano, icono)))
  console.log(`✓ public/${icono.archivo}`)
}

// Favicon vectorial con el mismo diseño
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
const p = (x, y) => `${(x * 64).toFixed(2)} ${(y * 64).toFixed(2)}`
const ya = POZO.arriba, yb = POZO.abajo, yc = NIVEL_CARGA, hc = semiAncho(yc)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${hex(COLORES.fondo)}"/>
  <path d="M${p(0.5 - POZO.anchoArriba / 2, ya)} L${p(0.5 + POZO.anchoArriba / 2, ya)} L${p(0.5 + POZO.anchoAbajo / 2, yb)} L${p(0.5 - POZO.anchoAbajo / 2, yb)} Z" fill="${hex(COLORES.vacio)}"/>
  <path d="M${p(0.5 - hc, yc)} L${p(0.5 + hc, yc)} L${p(0.5 + POZO.anchoAbajo / 2, yb)} L${p(0.5 - POZO.anchoAbajo / 2, yb)} Z" fill="${hex(COLORES.carga)}"/>
  <path d="M${p(0.5 - POZO.anchoArriba / 2, ya)} L${p(0.5 + POZO.anchoArriba / 2, ya)} L${p(0.5 + POZO.anchoAbajo / 2, yb)} L${p(0.5 - POZO.anchoAbajo / 2, yb)} Z" fill="none" stroke="${hex(COLORES.borde)}" stroke-width="${(BORDE * 64).toFixed(2)}" stroke-linejoin="round"/>
  <rect x="${(CUBIERTA.x0 * 64).toFixed(2)}" y="${((CUBIERTA.y - CUBIERTA.grosor / 2) * 64).toFixed(2)}" width="${((CUBIERTA.x1 - CUBIERTA.x0) * 64).toFixed(2)}" height="${(CUBIERTA.grosor * 64).toFixed(2)}" rx="1" fill="${hex(COLORES.cubierta)}"/>
</svg>
`
writeFileSync(join(PUBLIC, 'favicon.svg'), svg)
console.log('✓ public/favicon.svg')
