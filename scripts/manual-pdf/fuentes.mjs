/**
 * De qué está hecho el PDF del manual. El generador guarda una huella de todo
 * esto y las pruebas la comparan: si algo cambió sin regenerar el PDF, fallan.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = fileURLToPath(new URL('../..', import.meta.url))
export const MANUAL = 'docs/06-manual-de-usuario.md'
export const IMAGENES = 'docs/img/manual'
export const PDF = 'docs/manual-de-usuario.pdf'
export const HUELLA = 'docs/manual-de-usuario.pdf.json'
export const ICONO = 'public/favicon.svg'
export const ESTILOS = 'scripts/manual-pdf/estilos.css'

const BINARIOS = /\.(webp|png|jpe?g|pdf)$/i

export const sha256 = (datos) => createHash('sha256').update(datos).digest('hex')

export const version = () => JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version

/** Huella de cada archivo de origen, y la versión que figura en la portada. */
export function huellaFuentes() {
  const rutas = [
    MANUAL,
    ICONO,
    ESTILOS,
    'scripts/manual-pdf/generar.mjs',
    'src/services/slug.js',
    ...readdirSync(join(RAIZ, IMAGENES)).sort().map(n => `${IMAGENES}/${n}`)
  ]
  const archivos = Object.fromEntries(rutas.map(ruta => {
    let datos = readFileSync(join(RAIZ, ruta))
    // Git puede cambiar los fines de línea según el equipo: no es un cambio
    if (!BINARIOS.test(ruta)) datos = datos.toString('utf8').replace(/\r\n/g, '\n')
    return [ruta, sha256(datos)]
  }))
  return { version: version(), archivos }
}
