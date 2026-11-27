/**
 * Exportación de la Vista previa a PNG: colores de cada fondo, dibujo de las
 * cotas sobre la imagen y descarga del archivo.
 */

export const IMAGE_THEMES = {
  // Igual que en pantalla
  oscuro: {
    background: '#0b0f19',
    grid: [0x0284c7, 0x1e293b],
    axes: ['#ff4000', '#80ff00', '#0080ff'],
    solid: 0x0284c7,
    wireframe: 0x38bdf8,
    edges: 0x7dd3fc,
    dimensions: { total: '#fbbf24', parcial: '#fde68a', manual: '#34d399' },
    halo: '#0b0f19'
  },
  // Para imprimir o pegar en un informe: trazos oscuros sobre blanco
  claro: {
    background: '#ffffff',
    grid: [0x64748b, 0xd8dee9],
    axes: ['#dc2626', '#15803d', '#1d4ed8'],
    solid: 0x5eb0e5,
    wireframe: 0x0369a1,
    edges: 0x0c4a6e,
    dimensions: { total: '#92400e', parcial: '#b45309', manual: '#047857' },
    halo: '#ffffff'
  }
}

// Lado mayor máximo de la imagen: más grande no entra en la memoria de muchos teléfonos
const MAX_SIDE = 4096

/** Píxeles de imagen por píxel de pantalla: al menos el doble, para que imprima bien. */
export function exportScale(width, height, devicePixelRatio = 1) {
  const wanted = Math.min(3, Math.max(2, devicePixelRatio))
  return Math.min(wanted, MAX_SIDE / Math.max(width, height))
}

/**
 * Dibuja las cotas (las mismas figuras que DimensionOverlay, en píxeles de
 * pantalla) en un canvas 2D ya escalado.
 */
export function paintDimensions(ctx, shapes, theme) {
  const line = (p, q) => {
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }

  for (const s of shapes) {
    const color = theme.dimensions[s.kind]
    ctx.strokeStyle = color
    ctx.fillStyle = color

    ctx.lineWidth = 1
    ctx.globalAlpha = 0.45
    ctx.setLineDash(s.kind === 'manual' ? [4, 3] : [])
    for (const [p, q] of s.ext) line(p, q)

    ctx.globalAlpha = 1
    ctx.setLineDash([])
    ctx.lineWidth = 1.3
    line(s.a, s.b)

    for (const arrow of s.arrows) {
      ctx.beginPath()
      arrow.split(' ').forEach((pair, i) => {
        const [x, y] = pair.split(',').map(Number)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
    }
  }

  // Los textos van encima de todas las líneas, con un borde del color del fondo
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4
  ctx.strokeStyle = theme.halo
  for (const s of shapes) {
    ctx.font = `bold ${s.kind === 'parcial' ? 11 : 13}px ui-monospace, Consolas, monospace`
    ctx.fillStyle = theme.dimensions[s.kind]
    ctx.strokeText(s.label.text, s.label.x, s.label.y)
    ctx.fillText(s.label.text, s.label.x, s.label.y)
  }
}

/** Nombre del archivo: buque, pozo y fecha, sin caracteres que el sistema rechace. */
export function imageFileName(buque, pozo, date = new Date()) {
  const clean = (text) => String(text || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
  const parts = [clean(buque), clean(pozo), date.toISOString().slice(0, 10)].filter(Boolean)
  return parts.join('_') + '.png'
}

export function downloadCanvas(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('El navegador no pudo generar la imagen.'))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    }, 'image/png')
  })
}
