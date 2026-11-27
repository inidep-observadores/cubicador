/**
 * Lee el PDF del manual y describe qué quedó en cada página: texto, imágenes y
 * dibujos con su posición. Lo usan las pruebas de maquetado.
 * Medidas en puntos, con el origen arriba a la izquierda de la hoja.
 */
import { readFileSync } from 'node:fs'
import { getDocument, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs'

export const MM = 72 / 25.4
// Márgenes de @page en estilos.css
export const MARGEN = { arriba: 20 * MM, lados: 18 * MM, abajo: 18 * MM }

/** Rectángulos de las imágenes y los trazos, siguiendo las transformaciones. */
async function dibujos(page, vista) {
  const { fnArray, argsArray } = await page.getOperatorList()
  const salida = []
  const pila = []
  let ctm = vista.transform
  const caja = (tipo, [x0, y0, x1, y1]) => {
    const p = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => {
      const punto = [x, y]
      Util.applyTransform(punto, ctm)
      return punto
    })
    const xs = p.map(q => q[0])
    const ys = p.map(q => q[1])
    salida.push({ tipo, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })
  }
  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i]
    const args = argsArray[i]
    if (op === OPS.save) pila.push(ctm)
    else if (op === OPS.restore) ctm = pila.pop() ?? ctm
    else if (op === OPS.transform) ctm = Util.transform(ctm, args)
    else if (op === OPS.paintFormXObjectBegin) {
      pila.push(ctm)
      if (args?.[0]) ctm = Util.transform(ctm, args[0])
    } else if (op === OPS.paintFormXObjectEnd) ctm = pila.pop() ?? ctm
    else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) caja('imagen', [0, 0, 1, 1])
    // args: [operación de pintado, datos del trazo, [minX, minY, maxX, maxY]].
    // Los trazos que no pintan nada solo sirven para recortar
    else if (op === OPS.constructPath && args[0] !== OPS.endPath && args[2]) caja('trazo', args[2])
  }
  return salida
}

export async function analizarPdf(ruta) {
  const tarea = getDocument({ data: new Uint8Array(readFileSync(ruta)), verbosity: 0 })
  const doc = await tarea.promise

  const indiceDePagina = async (destino) => {
    const d = typeof destino === 'string' ? await doc.getDestination(destino) : destino
    return d ? await doc.getPageIndex(d[0]) : null
  }

  const paginas = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vista = page.getViewport({ scale: 1 })
    const texto = (await page.getTextContent()).items
      .filter(t => t.str.trim())
      .map(t => {
        const m = Util.transform(vista.transform, t.transform)
        const alto = Math.hypot(m[2], m[3])
        return { tipo: 'texto', texto: t.str, tamano: alto, x0: m[4], y0: m[5] - alto, x1: m[4] + t.width, y1: m[5] }
      })
    const enlaces = []
    for (const a of await page.getAnnotations()) {
      if (a.subtype === 'Link' && a.dest) enlaces.push(await indiceDePagina(a.dest))
    }
    paginas.push({
      ancho: vista.width,
      alto: vista.height,
      elementos: [...texto, ...await dibujos(page, vista)],
      enlaces
    })
  }

  const marcadores = []
  const recorrer = async (items) => {
    for (const it of items ?? []) {
      marcadores.push({ titulo: it.title.trim(), pagina: await indiceDePagina(it.dest) })
      await recorrer(it.items)
    }
  }
  await recorrer(await doc.getOutline())
  await tarea.destroy()
  return { paginas, marcadores }
}
