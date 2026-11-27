/**
 * Cotas del visor: qué se acota, dónde va cada línea y cómo se ve en pantalla.
 * Módulo puro (los puntos son arreglos [x, y, z]) para poder probarlo.
 */

const AXES = ['x', 'y', 'z']
const INDEX = { x: 0, y: 1, z: 2 }

// Dos caras se consideran distintas si sus normales difieren más que esto: así
// las facetas de una superficie curva no generan esquinas
const CORNER_COS = Math.cos(20 * Math.PI / 180)
const LEVEL_TOLERANCE = 0.015 // m: quiebres más juntos que esto son el mismo
const MIN_PARTIAL = 0.05 // m
const MAX_PARTIALS = 6 // más tramos que esto no se leen: solo se informa el total

export function formatMeters(value) {
  return value.toFixed(2).replace('.', ',') + ' m'
}

/** Caja envolvente de una malla (arreglo plano de posiciones). */
export function boundsOf(positions) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k])
      max[k] = Math.max(max[k], positions[i + k])
    }
  }
  return { min, max }
}

/** Esquinas de una malla: vértices donde se juntan tres o más caras distintas. */
export function findCorners(positions, index = null) {
  const vertices = new Map() // clave → { point, normals }
  const count = index ? index.length : positions.length / 3

  for (let t = 0; t + 2 < count; t += 3) {
    const tri = [0, 1, 2].map(k => {
      const i = (index ? index[t + k] : t + k) * 3
      return [positions[i], positions[i + 1], positions[i + 2]]
    })
    const [a, b, c] = tri
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n)
    if (len < 1e-6) continue // astilla sin área: su normal no es confiable
    const normal = n.map(x => x / len)

    for (const point of tri) {
      const key = point.map(x => Math.round(x * 1000)).join('|')
      let entry = vertices.get(key)
      if (!entry) {
        entry = { point, normals: [] }
        vertices.set(key, entry)
      }
      const known = entry.normals.some(m => m[0] * normal[0] + m[1] * normal[1] + m[2] * normal[2] > CORNER_COS)
      if (!known) entry.normals.push(normal)
    }
  }

  return [...vertices.values()].filter(e => e.normals.length >= 3).map(e => e.point)
}

/** Posiciones a lo largo de un eje donde hay un quiebre, incluidos los extremos. */
export function levels(corners, axis, min, max) {
  const k = INDEX[axis]
  const out = [min]
  for (const value of corners.map(p => p[k]).sort((a, b) => a - b)) {
    if (value - out[out.length - 1] > LEVEL_TOLERANCE && max - value > LEVEL_TOLERANCE) out.push(value)
  }
  out.push(max)
  return out
}

/**
 * Cotas automáticas de un cuerpo: la medida total de cada eje y, cuando hay
 * quiebres (y no son demasiados), la cadena de medidas parciales.
 *
 * `camera` está en las mismas coordenadas que el cuerpo: las líneas se ubican
 * del lado que se está mirando.
 */
export function autoDimensions({ min, max, corners }, camera) {
  const size = [0, 1, 2].map(k => max[k] - min[k])
  const offset = Math.min(1.2, Math.max(0.25, Math.max(...size) * 0.08))
  const side = k => (camera[k] >= (min[k] + max[k]) / 2 ? 1 : -1)
  const sx = side(0)
  const sz = side(2)
  const nearX = sx > 0 ? max[0] : min[0]
  const nearZ = sz > 0 ? max[2] : min[2]
  const farZ = sz > 0 ? min[2] : max[2]

  // Arista de la caja sobre la que se apoya la cota de cada eje, y hacia dónde sale
  const placement = {
    x: { at: v => [v, min[1], nearZ], out: [0, 0, sz] },
    z: { at: v => [nearX, min[1], v], out: [sx, 0, 0] },
    y: { at: v => [nearX, v, farZ], out: [sx, 0, 0] } // borde del contorno
  }

  const result = []
  for (const axis of AXES) {
    const k = INDEX[axis]
    if (size[k] < 0.01) continue
    const { at, out } = placement[axis]
    const marks = levels(corners, axis, min[k], max[k])
    const partial = marks.length > 2 && marks.length - 1 <= MAX_PARTIALS &&
      marks.every((v, i) => i === 0 || v - marks[i - 1] >= MIN_PARTIAL)

    // La línea auxiliar nace en el cuerpo, no en el aire: se busca una esquina
    // alineada con el borde de la caja (primero en la dirección en que sale la
    // cota) para que la línea quede derecha
    const outAxis = out.findIndex(c => c !== 0)
    const origin = (value) => {
      const target = at(value)
      let best = null
      for (const p of corners) {
        if (Math.abs(p[k] - value) > LEVEL_TOLERANCE) continue
        const off = [0, 1, 2].filter(i => Math.abs(p[i] - target[i]) > LEVEL_TOLERANCE)
        if (off.length === 0) return { point: target, straight: true }
        if (off.length > 1) continue
        const rank = off[0] === outAxis ? 0 : 1
        const dist = Math.abs(p[off[0]] - target[off[0]])
        if (!best || rank < best.rank || (rank === best.rank && dist < best.dist)) best = { rank, dist, point: p }
      }
      if (!best) return { point: target, straight: true }
      return { point: best.point, straight: best.rank === 0 }
    }
    // Si la esquina no está en la dirección en que sale la cota, la línea
    // auxiliar hace un codo en el borde de la caja para no cruzar en diagonal
    const extension = (value, end) => {
      const { point, straight } = origin(value)
      return straight ? [[point, end]] : [[point, at(value)], [at(value), end]]
    }
    const add = (from, to, distance, kind) => {
      const [a, b] = [from, to].map(v => at(v).map((c, i) => c + out[i] * distance))
      result.push({ axis, kind, value: to - from, a, b, ext: [...extension(from, a), ...extension(to, b)] })
    }
    if (partial) {
      for (let i = 1; i < marks.length; i++) add(marks[i - 1], marks[i], offset, 'parcial')
    }
    add(min[k], max[k], partial ? offset * 2.2 : offset, 'total')
  }
  return result
}

/**
 * Cota puesta a mano entre dos puntos. Con `eje` se mide solo la distancia sobre
 * ese eje (como en un plano); sin eje, la distancia directa.
 */
export function manualDimension({ a, b, eje }) {
  const k = INDEX[eje]
  if (k === undefined) {
    return { kind: 'manual', value: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), a, b, ext: [] }
  }
  const end = a.slice()
  end[k] = b[k]
  return { kind: 'manual', value: Math.abs(b[k] - a[k]), a, b: end, ext: [[b, end]] }
}

// Largo mínimo en pantalla para que la cota se dibuje (si no, no entra el texto)
const MIN_PIXELS = { total: 30, parcial: 24, manual: 0 }

/**
 * Pasa las cotas a figuras de pantalla. `project` devuelve {x, y} en píxeles, o
 * null si el punto queda detrás de la cámara.
 */
export function toScreenShapes(dimensions, project) {
  const shapes = []
  for (const dim of dimensions) {
    const a = project(dim.a)
    const b = project(dim.b)
    if (!a || !b) continue
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length < MIN_PIXELS[dim.kind]) continue

    const ext = dim.ext.map(([from, to]) => [project(from), project(to)]).filter(([p, q]) => p && q)
    // Puntas de flecha, hacia afuera de la línea
    const ux = length ? (b.x - a.x) / length : 0
    const uy = length ? (b.y - a.y) / length : 0
    const head = Math.min(9, length / 3)
    const arrow = (tip, dx, dy) => [
      [tip.x, tip.y],
      [tip.x + dx * head - dy * head * 0.35, tip.y + dy * head + dx * head * 0.35],
      [tip.x + dx * head + dy * head * 0.35, tip.y + dy * head - dx * head * 0.35]
    ].map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')

    shapes.push({
      kind: dim.kind,
      id: dim.id,
      a,
      b,
      ext,
      arrows: head > 1 ? [arrow(a, ux, uy), arrow(b, -ux, -uy)] : [],
      label: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, text: formatMeters(dim.value) }
    })
  }
  return shapes
}

/**
 * Imán de la herramienta Medir: primero una esquina cercana al puntero, después
 * un punto sobre una arista y, si no hay nada cerca, el punto de la superficie.
 */
export function snapPoint(pointer, { corners, edges, surface }, project, radius) {
  let best = null
  for (const point of corners) {
    const p = project(point)
    if (!p) continue
    const dist = Math.hypot(p.x - pointer.x, p.y - pointer.y)
    // Entre superpuestos gana el que está más cerca de la cámara
    const score = dist + (p.depth || 0) * 4
    if (dist <= radius && (!best || score < best.score)) best = { score, point, type: 'esquina' }
  }
  if (best) return best

  for (const [from, to] of edges) {
    const p = project(from)
    const q = project(to)
    if (!p || !q) continue
    const dx = q.x - p.x
    const dy = q.y - p.y
    const len2 = dx * dx + dy * dy
    if (len2 < 1) continue
    const t = Math.max(0, Math.min(1, ((pointer.x - p.x) * dx + (pointer.y - p.y) * dy) / len2))
    const dist = Math.hypot(p.x + dx * t - pointer.x, p.y + dy * t - pointer.y)
    const score = dist + ((p.depth || 0) * (1 - t) + (q.depth || 0) * t) * 4
    if (dist <= radius * 0.7 && (!best || score < best.score)) {
      // `t` es la fracción en pantalla: con la perspectiva es una aproximación,
      // pero el punto queda exactamente sobre la arista
      best = { score, point: from.map((c, i) => c + (to[i] - c) * t), type: 'arista' }
    }
  }
  if (best) return best

  return surface ? { point: surface, type: 'superficie' } : null
}
