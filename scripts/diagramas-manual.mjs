// Genera los diagramas conceptuales del manual (SVG) en docs/img/manual.
// Uso: node scripts/diagramas-manual.mjs
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const OUT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'img', 'manual')

const C = {
  bg: '#0f172a', panel: '#111c33', borde: '#1e293b', texto: '#cbd5e1', tenue: '#94a3b8',
  x: '#fb7185', y: '#34d399', z: '#38bdf8', suma: '#0ea5e9', resta: '#f43f5e', amarillo: '#fbbf24'
}
const FONT = `font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"`

// Proyección isométrica: X (eslora) hacia la derecha-abajo, Z (manga, babor) hacia la izquierda-abajo
const K = Math.cos(Math.PI / 6), S = 0.5
const iso = (x, y, z, e = 1, o = [0, 0]) => [o[0] + (x - z) * K * e, o[1] + ((x + z) * S - y) * e]
const pts = (arr) => arr.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')

function svg(w, h, body, titulo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${titulo}" ${FONT}>
  <title>${titulo}</title>
  <rect width="${w}" height="${h}" rx="14" fill="${C.bg}"/>
${body}
</svg>
`
}
const texto = (x, y, t, { size = 13, fill = C.texto, anchor = 'middle', weight = 400 } = {}) =>
  `  <text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${t}</text>`

// Prisma recto: caras visibles desde proa-babor-arriba
function caja(x0, x1, y0, y1, z0, z1, e, o, color, opac = 0.35, dash = '') {
  const P = (x, y, z) => iso(x, y, z, e, o)
  const d = dash ? ` stroke-dasharray="${dash}"` : ''
  const cara = (a) => `  <polygon points="${pts(a)}" fill="${color}" fill-opacity="${opac}" stroke="${color}" stroke-width="1.5"${d} stroke-linejoin="round"/>`
  return [
    cara([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)]), // techo
    cara([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)]), // proa
    cara([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)])  // babor
  ].join('\n')
}

// Cilindro vertical (centro cx, cz; radio r)
function cilindro(cx, cz, r, y0, y1, e, o, color, opac = 0.45) {
  const [bx, by] = iso(cx, y0, cz, e, o)
  const [tx, ty] = iso(cx, y1, cz, e, o)
  const rx = r * Math.SQRT2 * K * e, ry = r * Math.SQRT2 * S * e
  return `  <path d="M${(bx - rx).toFixed(1)},${by.toFixed(1)} L${(tx - rx).toFixed(1)},${ty.toFixed(1)} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 0 ${(tx + rx).toFixed(1)},${ty.toFixed(1)} L${(bx + rx).toFixed(1)},${by.toFixed(1)} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 1 ${(bx - rx).toFixed(1)},${by.toFixed(1)} Z" fill="${color}" fill-opacity="${opac}" stroke="${color}" stroke-width="1.5"/>
  <ellipse cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${color}" fill-opacity="${opac}" stroke="${color}" stroke-width="1.5"/>`
}

// Rampa (cuña) en el piso: de x0 a x1 sube de 0 a h, ancho z0..z1
function rampa(x0, x1, h, z0, z1, e, o, color, opac = 0.45) {
  const P = (x, y, z) => iso(x, y, z, e, o)
  const cara = (a) => `  <polygon points="${pts(a)}" fill="${color}" fill-opacity="${opac}" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`
  return [
    cara([P(x0, 0, z0), P(x1, h, z0), P(x1, h, z1), P(x0, 0, z1)]), // pendiente
    cara([P(x1, 0, z0), P(x1, 0, z1), P(x1, h, z1), P(x1, h, z0)]), // cara vertical (proa)
    cara([P(x0, 0, z1), P(x1, 0, z1), P(x1, h, z1)])                 // costado babor
  ].join('\n')
}

// ---------------------------------------------------------------------------
// 1) Sumar y restar
{
  const W = 860, H = 300, e = 17
  const paneles = [
    { cx: 120, titulo: 'Caja', sub: 'suma (+)', color: C.suma },
    { cx: 330, titulo: 'Columna', sub: 'resta (−)', color: C.resta },
    { cx: 530, titulo: 'Rampa', sub: 'resta (−)', color: C.resta },
    { cx: 745, titulo: 'Pozo resultante', sub: '85,87 m³', color: C.suma }
  ]
  let body = ''
  const base = 190
  // Caja 6 × 5 × 3, de x −3..3, z −2,5..2,5
  body += caja(-3, 3, 0, 3, -2.5, 2.5, e, [paneles[0].cx, base], C.suma)
  body += '\n' + cilindro(-1.5, 1, 0.2, 0, 3, e * 1.6, [paneles[1].cx + 40, base - 10], C.resta)
  body += '\n' + rampa(0, 3, 0.5, -2.5, 2.5, e, [paneles[2].cx - 25, base - 40], C.resta)
  // Resultado: caja con los recortes marcados
  const o4 = [paneles[3].cx, base]
  body += '\n' + caja(-3, 3, 0, 3, -2.5, 2.5, e, o4, C.suma, 0.25)
  body += '\n' + cilindro(-1.5, 1, 0.2, 0, 3, e, o4, C.bg, 0.9)
  body += '\n' + rampa(0, 3, 0.5, -2.5, 2.5, e, o4, C.resta, 0.25)
  // Signos entre paneles
  body += '\n' + texto(228, 165, '−', { size: 34, fill: C.resta, weight: 700 })
  body += '\n' + texto(430, 165, '−', { size: 34, fill: C.resta, weight: 700 })
  body += '\n' + texto(632, 165, '=', { size: 34, fill: C.texto, weight: 700 })
  for (const p of paneles) {
    body += '\n' + texto(p.cx, 262, p.titulo, { size: 15, weight: 700 })
    body += '\n' + texto(p.cx, 282, p.sub, { size: 13, fill: p.color === C.resta ? C.resta : C.z })
  }
  body += '\n' + texto(W / 2, 32, 'El pozo se arma sumando y restando figuras', { size: 16, weight: 700 })
  writeFileSync(`${OUT}/sumar-restar.svg`, svg(W, H, body, 'Una caja menos una columna y menos una rampa da el pozo resultante'))
}

// ---------------------------------------------------------------------------
// 2) Ejes del buque: planta y costado
{
  const W = 860, H = 340
  let body = texto(W / 2, 32, 'Los tres ejes, con la orientación del buque', { size: 16, weight: 700 })

  // Planta: casco visto desde arriba, proa a la derecha
  const cx = 230, cy = 190
  body += `
  <path d="M${cx - 170},${cy - 55} L${cx + 90},${cy - 55} Q${cx + 170},${cy - 40} ${cx + 195},${cy} Q${cx + 170},${cy + 40} ${cx + 90},${cy + 55} L${cx - 170},${cy + 55} Q${cx - 185},${cy} ${cx - 170},${cy - 55} Z" fill="${C.panel}" stroke="#334155" stroke-width="2"/>
  <line x1="${cx - 185}" y1="${cy}" x2="${cx + 195}" y2="${cy}" stroke="#334155" stroke-dasharray="6 5"/>
  <rect x="${cx - 60}" y="${cy - 35}" width="90" height="70" rx="4" fill="${C.suma}" fill-opacity="0.35" stroke="${C.suma}" stroke-width="1.5"/>
  <circle cx="${cx - 15}" cy="${cy}" r="5" fill="${C.texto}"/>`
  // Flechas
  body += `
  <defs>
    <marker id="fx" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${C.x}"/></marker>
    <marker id="fy" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${C.y}"/></marker>
    <marker id="fz" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${C.z}"/></marker>
  </defs>
  <line x1="${cx - 15}" y1="${cy}" x2="${cx + 80}" y2="${cy}" stroke="${C.x}" stroke-width="3" marker-end="url(#fx)"/>
  <line x1="${cx - 15}" y1="${cy}" x2="${cx - 15}" y2="${cy - 85}" stroke="${C.z}" stroke-width="3" marker-end="url(#fz)"/>`
  body += '\n' + texto(cx + 88, cy - 8, 'X+', { size: 14, fill: C.x, weight: 700, anchor: 'start' })
  body += '\n' + texto(cx - 5, cy - 88, 'Z+', { size: 14, fill: C.z, weight: 700, anchor: 'start' })
  body += '\n' + texto(cx + 150, cy + 22, 'PROA', { size: 13, fill: C.tenue, weight: 700 })
  body += '\n' + texto(cx - 140, cy + 22, 'POPA', { size: 13, fill: C.tenue, weight: 700 })
  body += '\n' + texto(cx - 100, cy - 70, 'BABOR', { size: 13, fill: C.tenue, weight: 700 })
  body += '\n' + texto(cx, cy + 80, 'ESTRIBOR', { size: 13, fill: C.tenue, weight: 700 })
  body += '\n' + texto(cx, 300, 'Planta (vista desde arriba)', { size: 14, weight: 700 })
  body += '\n' + texto(cx, 320, 'El pozo azul y su origen (0, 0, 0)', { size: 12, fill: C.tenue })

  // Costado: vista desde babor, proa a la derecha
  const sx = 660, sy = 230
  body += `
  <path d="M${sx - 150},${sy - 90} L${sx + 150},${sy - 90} L${sx + 130},${sy + 10} Q${sx + 60},${sy + 30} ${sx - 120},${sy + 20} L${sx - 150},${sy - 90} Z" fill="${C.panel}" stroke="#334155" stroke-width="2"/>
  <rect x="${sx - 60}" y="${sy - 75}" width="90" height="70" rx="3" fill="${C.suma}" fill-opacity="0.35" stroke="${C.suma}" stroke-width="1.5"/>
  <line x1="${sx - 170}" y1="${sy - 5}" x2="${sx + 170}" y2="${sy - 5}" stroke="#334155" stroke-dasharray="6 5"/>
  <circle cx="${sx - 15}" cy="${sy - 5}" r="5" fill="${C.texto}"/>
  <line x1="${sx - 15}" y1="${sy - 5}" x2="${sx + 80}" y2="${sy - 5}" stroke="${C.x}" stroke-width="3" marker-end="url(#fx)"/>
  <line x1="${sx - 15}" y1="${sy - 5}" x2="${sx - 15}" y2="${sy - 120}" stroke="${C.y}" stroke-width="3" marker-end="url(#fy)"/>`
  body += '\n' + texto(sx + 88, sy - 12, 'X+', { size: 14, fill: C.x, weight: 700, anchor: 'start' })
  body += '\n' + texto(sx - 5, sy - 118, 'Y+', { size: 14, fill: C.y, weight: 700, anchor: 'start' })
  body += '\n' + texto(sx + 155, sy + 12, 'piso (Y = 0)', { size: 12, fill: C.tenue, anchor: 'end' })
  body += '\n' + texto(sx, 300, 'Costado (vista desde babor)', { size: 14, weight: 700 })
  body += '\n' + texto(sx, 320, 'Y mide la altura desde el piso', { size: 12, fill: C.tenue })
  writeFileSync(`${OUT}/ejes.svg`, svg(W, H, body, 'Ejes del buque: X hacia proa, Y hacia arriba, Z hacia babor'))
}

// ---------------------------------------------------------------------------
// 3) Ubicación: X y Z marcan el centro, Y el piso de la pieza
{
  const W = 860, H = 300, e = 42
  let body = texto(W / 2, 32, 'Ubicación de una pieza: centro en X y Z, piso en Y', { size: 16, weight: 700 })
  // Vista de costado (X horizontal, Y vertical). Escala 42 px/m, origen en (230, 230)
  const ox = 330, oy = 230
  const X = (x) => ox + x * e, Y = (y) => oy - y * e
  body += `
  <line x1="${X(-6.5)}" y1="${Y(0)}" x2="${X(6.5)}" y2="${Y(0)}" stroke="#334155" stroke-width="2"/>
  <line x1="${X(0)}" y1="${Y(-0.85)}" x2="${X(0)}" y2="${Y(3.2)}" stroke="#334155" stroke-dasharray="5 5"/>`
  body += '\n' + texto(X(0), Y(3.2) - 6, 'X = 0', { size: 12, fill: C.tenue })
  // Caja en X = 4 (de 1 a 7 no entra: usar largo 4, X = 3 → de 1 a 5), Y = 0,5 (apoyada sobre un escalón)
  const x0 = 1, x1 = 5, y0 = 0.5, y1 = 2.5
  body += `
  <rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * e}" height="${(y1 - y0) * e}" rx="3" fill="${C.suma}" fill-opacity="0.35" stroke="${C.suma}" stroke-width="1.5"/>
  <circle cx="${X(3)}" cy="${Y(y0)}" r="6" fill="${C.amarillo}"/>
  <line x1="${X(3)}" y1="${Y(y0)}" x2="${X(3)}" y2="${Y(y1) - 16}" stroke="${C.amarillo}" stroke-dasharray="4 4"/>`
  body += '\n' + texto(X(3), Y(y1) - 22, 'centro de la pieza', { size: 12, fill: C.amarillo })
  // Cota X
  body += `
  <line x1="${X(0)}" y1="${Y(-0.55)}" x2="${X(3)}" y2="${Y(-0.55)}" stroke="${C.x}" stroke-width="2" marker-end="url(#ux)" marker-start="url(#ux)"/>
  <line x1="${X(0)}" y1="${Y(0) - 0}" x2="${X(0)}" y2="${Y(-0.7)}" stroke="${C.x}" stroke-width="1"/>
  <line x1="${X(3)}" y1="${Y(y0)}" x2="${X(3)}" y2="${Y(-0.7)}" stroke="${C.x}" stroke-width="1" stroke-dasharray="3 3"/>
  <defs>
    <marker id="ux" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${C.x}"/></marker>
    <marker id="uy" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${C.y}"/></marker>
  </defs>`
  body += '\n' + texto(X(1.5), Y(-0.55) + 18, 'Eje X = 3', { size: 13, fill: C.x, weight: 700 })
  // Cota Y
  body += `
  <line x1="${X(5.6)}" y1="${Y(0)}" x2="${X(5.6)}" y2="${Y(y0)}" stroke="${C.y}" stroke-width="2" marker-end="url(#uy)" marker-start="url(#uy)"/>
  <line x1="${X(x1)}" y1="${Y(y0)}" x2="${X(5.8)}" y2="${Y(y0)}" stroke="${C.y}" stroke-width="1" stroke-dasharray="3 3"/>`
  body += '\n' + texto(X(5.75), Y(0.25) + 5, 'Eje Y = 0,5', { size: 13, fill: C.y, weight: 700, anchor: 'start' })
  body += '\n' + texto(X(-3.4), Y(2.6), 'Vista de costado', { size: 14, weight: 700 })
  body += '\n' + texto(X(-3.4), Y(2.6) + 22, 'Caja de 4 m de largo con', { size: 12, fill: C.tenue })
  body += '\n' + texto(X(-3.4), Y(2.6) + 40, 'Eje X = 3: va de 1 a 5 m.', { size: 12, fill: C.tenue })
  body += '\n' + texto(X(-3.4), Y(2.6) + 58, 'Eje Y = 0,5: su piso está', { size: 12, fill: C.tenue })
  body += '\n' + texto(X(-3.4), Y(2.6) + 76, 'a medio metro del piso.', { size: 12, fill: C.tenue })
  body += '\n' + texto(X(-6.4), Y(0) - 8, 'piso (Y = 0)', { size: 12, fill: C.tenue, anchor: 'start' })
  writeFileSync(`${OUT}/ubicacion.svg`, svg(W, H, body, 'La ubicación indica el centro de la pieza en X y Z, y la altura de su piso en Y'))
}

// ---------------------------------------------------------------------------
// 4) Espejo: una cuña antes y después de espejar en X (vista de costado)
{
  const W = 860, H = 260
  let body = texto(W / 2, 32, 'Espejo en X (Eslora): la pieza se invierte sin moverse de lugar', { size: 16, weight: 700 })
  const piso = 200
  const cuna = (x0, x1, alto, subeHacia) => {
    const p = subeHacia === 'derecha'
      ? [[x0, piso], [x1, piso], [x1, piso - alto]]
      : [[x0, piso], [x1, piso], [x0, piso - alto]]
    return `  <polygon points="${pts(p)}" fill="${C.suma}" fill-opacity="0.35" stroke="${C.suma}" stroke-width="2" stroke-linejoin="round"/>`
  }
  // Antes
  body += `\n  <line x1="60" y1="${piso}" x2="380" y2="${piso}" stroke="#334155" stroke-width="2"/>`
  body += '\n' + cuna(100, 340, 110, 'derecha')
  body += `\n  <line x1="220" y1="60" x2="220" y2="${piso + 8}" stroke="${C.amarillo}" stroke-width="1.5" stroke-dasharray="6 5"/>`
  body += '\n' + texto(228, 72, 'centro', { size: 12, fill: C.amarillo, anchor: 'start' })
  body += '\n' + texto(220, 236, 'Antes: el filo hacia popa', { size: 13 })
  // Flecha
  body += `
  <defs><marker id="fe" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${C.texto}"/></marker></defs>
  <line x1="400" y1="140" x2="455" y2="140" stroke="${C.texto}" stroke-width="2.5" marker-end="url(#fe)"/>`
  body += '\n' + texto(428, 125, 'Espejo X', { size: 12, fill: C.x, weight: 700 })
  // Después
  body += `\n  <line x1="480" y1="${piso}" x2="800" y2="${piso}" stroke="#334155" stroke-width="2"/>`
  body += '\n' + cuna(520, 760, 110, 'izquierda')
  body += `\n  <line x1="640" y1="60" x2="640" y2="${piso + 8}" stroke="${C.amarillo}" stroke-width="1.5" stroke-dasharray="6 5"/>`
  body += '\n' + texto(648, 72, 'mismo centro', { size: 12, fill: C.amarillo, anchor: 'start' })
  body += '\n' + texto(640, 236, 'Después: el filo hacia proa', { size: 13 })
  body += '\n' + texto(70, 60, 'POPA ←', { size: 12, fill: C.tenue, weight: 700, anchor: 'start' })
  body += '\n' + texto(790, 60, '→ PROA', { size: 12, fill: C.tenue, weight: 700, anchor: 'end' })
  writeFileSync(`${OUT}/espejo-concepto.svg`, svg(W, H, body, 'Una cuña antes y después de espejarla en eslora'))
}
console.log('Diagramas listos')
