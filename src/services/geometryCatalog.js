import * as THREE from 'three'

/**
 * Catálogo completo de las 10 figuras geométricas de la ficha técnica naval
 * Incluye:
 * - Fórmulas analíticas exactas
 * - Generador de mallas cerradas (manifold / watertight) para Three.js y CSG
 * - Generador de desglose matemático explicativo paso a paso
 * - Esquemas SVG con cotas para la interfaz de usuario
 */

const SEGMENTOS_RADIALES = 32

// Radio del polígono regular que tiene la misma área que el círculo de radio R.
// Sin esta corrección la malla facetada de cilindros y conos pierde ~0.6 % de volumen.
function radioEquivalente(R) {
  const angulo = (2 * Math.PI) / SEGMENTOS_RADIALES
  return R * Math.sqrt(angulo / Math.sin(angulo))
}

/**
 * Arma una malla cerrada a partir de caras poligonales (pueden ser alabeadas).
 * Cada cara se triangula en abanico desde su centro, lo que reproduce exactamente
 * el volumen de una superficie reglada bilineal. Las normales se orientan hacia
 * afuera respecto del centro del sólido, y los vértices repetidos (bordes que
 * convergen en un punto) se eliminan para no generar triángulos degenerados.
 */
function solidFromFaces(faces) {
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
  const polys = faces
    .map(f => f.filter((v, i) => !same(v, f[(i + 1) % f.length])))
    .filter(f => f.length >= 3)

  const all = polys.flat()
  const center = new THREE.Vector3()
  all.forEach(v => center.add(new THREE.Vector3(...v)))
  center.divideScalar(all.length)

  const positions = []
  for (const poly of polys) {
    const pts = poly.map(v => new THREE.Vector3(...v))
    const c = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(pts.length)
    // Normal de Newell para decidir el sentido de giro
    const n = new THREE.Vector3()
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length]
      n.x += (p.y - q.y) * (p.z + q.z)
      n.y += (p.z - q.z) * (p.x + q.x)
      n.z += (p.x - q.x) * (p.y + q.y)
    })
    if (n.dot(c.clone().sub(center)) < 0) pts.reverse()

    const triangles = pts.length === 3
      ? [[pts[0], pts[1], pts[2]]]
      : pts.map((p, i) => [c, p, pts[(i + 1) % pts.length]])
    triangles.forEach(t => t.forEach(p => positions.push(p.x, p.y, p.z)))
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.computeVertexNormals()
  geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2))
  return geom
}

/**
 * Pozo cuya sección transversal es un trapecio de altura H que varía linealmente
 * a lo largo de la eslora: en x = -L/2 mide A arriba y B abajo; en x = +L/2 mide
 * C arriba y D abajo. El área de la sección es lineal en x, así que su volumen es
 * exactamente L·H·(A + B + C + D) / 4.
 */
function prismoideTrapezoidal(L, H, A, B, C, D) {
  const x0 = -L / 2
  const x1 = L / 2
  const b0 = [[x0, 0, -B / 2], [x0, 0, B / 2]]
  const t0 = [[x0, H, -A / 2], [x0, H, A / 2]]
  const b1 = [[x1, 0, -D / 2], [x1, 0, D / 2]]
  const t1 = [[x1, H, -C / 2], [x1, H, C / 2]]

  return solidFromFaces([
    [b0[0], b1[0], b1[1], b0[1]], // piso
    [t0[0], t0[1], t1[1], t1[0]], // techo
    [b0[0], b0[1], t0[1], t0[0]], // extremo x = -L/2
    [b1[0], t1[0], t1[1], b1[1]], // extremo x = +L/2
    [b0[0], t0[0], t1[0], b1[0]], // costado z-
    [b0[1], b1[1], t1[1], t0[1]]  // costado z+
  ])
}

export const GEOMETRY_TYPES = {
  // 1. CAJA (PRISMA RECTANGULAR)
  caja: {
    id: 'caja',
    nombre: 'Caja (Prisma Rectangular)',
    categoria: 'Básicos',
    descripcion: 'V = H × L × W. Cuerpo principal de bodegas, tanques y pozos rectangulares.',
    formula: 'V = H × L × W',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 6.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'ancho', label: 'Ancho (W)', default: 4.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto (H)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 20 60 L 90 60 L 90 25 L 20 25 Z" />
        <path d="M 90 60 L 135 45 L 135 15 L 90 25" />
        <path d="M 20 25 L 65 15 L 135 15" />
        <text x="50" y="73" class="fill-amber-300 stroke-none text-center">L</text>
        <text x="8" y="45" class="fill-amber-300 stroke-none">H</text>
        <text x="115" y="60" class="fill-amber-300 stroke-none">W</text>
      </svg>
    `,
    calculateVolume(p) {
      return (p.alto || 0) * (p.largo || 0) * (p.ancho || 0)
    },
    explainCalculation(p) {
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const W = (p.ancho || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `${H}m × ${L}m × ${W}m = ${V} m³`
    },
    createGeometry(p) {
      const geom = new THREE.BoxGeometry(p.largo, p.alto, p.ancho)
      geom.translate(0, p.alto / 2, 0)
      return geom
    }
  },

  // 2. CUÑA IRREGULAR (FORMA TÍPICA DEL POZO)
  cuna_irregular: {
    id: 'cuna_irregular',
    nombre: 'Cuña Irregular (Forma Pozo)',
    categoria: 'Pozos y Rampas',
    descripcion: 'V = H·L·(A + 2B) / 6. Base trapezoidal con rampa inclinada ascendente.',
    formula: 'V = [ H × L × (A + 2B) ] / 6',
    params: [
      { key: 'largo', label: 'Largo del piso (L)', default: 5.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Altura máxima (H)', default: 2.5, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_a', label: 'Ancho base bajo (A)', default: 4.5, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_b', label: 'Ancho extremo alto (B)', default: 2.5, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 20 75 L 85 75 L 135 35 L 110 35 Z" fill="rgba(14, 165, 233, 0.15)" />
        <path d="M 135 35 L 135 15 L 110 15 L 110 35 Z" />
        <path d="M 20 75 L 110 15 L 135 15 L 85 75 Z" />
        <text x="50" y="87" class="fill-amber-300 stroke-none">A (Base baja)</text>
        <text x="120" y="10" class="fill-amber-300 stroke-none">B (Base alta)</text>
        <text x="140" y="28" class="fill-amber-300 stroke-none">H</text>
        <text x="100" y="65" class="fill-amber-300 stroke-none">L</text>
      </svg>
    `,
    calculateVolume(p) {
      const H = p.alto || 0
      const L = p.largo || 0
      const A = p.base_a || 0
      const B = p.base_b || 0
      return (H * L * (A + 2 * B)) / 6
    },
    explainCalculation(p) {
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const A = (p.base_a || 0).toFixed(2)
      const B = (p.base_b || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `[ ${H}m × ${L}m × (${A} + 2×${B}) ] / 6 = ${V} m³`
    },
    createGeometry(p) {
      const L = Math.max(0.01, p.largo || 1)
      const H = Math.max(0.01, p.alto || 1)
      const A = Math.max(0.01, p.base_a || 1)
      const B = Math.max(0.01, p.base_b || 1)

      const v = [
        [-L/2, 0, -A/2],
        [-L/2, 0,  A/2],
        [ L/2, 0,  B/2],
        [ L/2, 0, -B/2],
        [ L/2, H, -B/2],
        [ L/2, H,  B/2]
      ]

      const indices = [
        0, 3, 2,   0, 2, 1, // Base inferior (normal hacia -Y)
        3, 5, 2,   3, 4, 5, // Cara vertical (normal hacia +X)
        0, 1, 5,   0, 5, 4, // Rampa inclinada (normal hacia el exterior)
        0, 4, 3,            // Lateral Z- (normal hacia -Z)
        1, 2, 5             // Lateral Z+ (normal hacia +Z)
      ]

      const positions = []
      for (const idx of indices) {
        positions.push(...v[idx])
      }

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geom.computeVertexNormals()
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2))
      return geom
    }
  },

  // 3. CUÑA REGULAR (RAMPA RECTA)
  cuna_regular: {
    id: 'cuna_regular',
    nombre: 'Cuña Regular (Rampa)',
    categoria: 'Pozos y Rampas',
    descripcion: 'V = ½ × (H × L × W). Rampa de acceso o pendiente longitudinal.',
    formula: 'V = ½ × (H × L × W)',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 5.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'ancho', label: 'Ancho (W)', default: 4.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto (H)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 20 65 L 90 65 L 135 45 L 90 20 Z" />
        <path d="M 90 65 L 90 20" />
        <path d="M 135 45 L 135 15 L 90 20" />
        <path d="M 20 65 L 90 20" />
        <text x="50" y="77" class="fill-amber-300 stroke-none">L</text>
        <text x="80" y="45" class="fill-amber-300 stroke-none">H</text>
        <text x="115" y="60" class="fill-amber-300 stroke-none">W</text>
      </svg>
    `,
    calculateVolume(p) {
      return 0.5 * (p.alto || 0) * (p.largo || 0) * (p.ancho || 0)
    },
    explainCalculation(p) {
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const W = (p.ancho || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `0.5 × (${H}m × ${L}m × ${W}m) = ${V} m³`
    },
    createGeometry(p) {
      const L = Math.max(0.01, p.largo || 1)
      const H = Math.max(0.01, p.alto || 1)
      const W = Math.max(0.01, p.ancho || 1)

      const v = [
        [-L/2, 0, -W/2],
        [-L/2, 0,  W/2],
        [ L/2, 0,  W/2],
        [ L/2, 0, -W/2],
        [ L/2, H, -W/2],
        [ L/2, H,  W/2]
      ]

      const indices = [
        0, 3, 2,   0, 2, 1, // Base inferior (normal hacia -Y)
        3, 5, 2,   3, 4, 5, // Cara vertical (normal hacia +X)
        0, 1, 5,   0, 5, 4, // Rampa inclinada (normal hacia el exterior)
        0, 4, 3,            // Lateral Z- (normal hacia -Z)
        1, 2, 5             // Lateral Z+ (normal hacia +Z)
      ]

      const positions = []
      for (const idx of indices) {
        positions.push(...v[idx])
      }

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geom.computeVertexNormals()
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2))
      return geom
    }
  },

  // 4. TRAPEZOIDE (PRISMA TRAPEZOIDAL)
  trapezoide: {
    id: 'trapezoide',
    nombre: 'Trapezoide (Prisma Trapezoidal)',
    categoria: 'Pozos y Rampas',
    descripcion: 'V = ½ × (A + B) × H × L. Bodega con laterales de pantoque simétricos.',
    formula: 'V = ½ × (A + B) × H × L',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 6.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto vertical (H)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_a', label: 'Ancho Superior (A)', default: 5.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_b', label: 'Ancho Inferior (B)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 35 65 L 75 65 L 90 25 L 20 25 Z" />
        <path d="M 75 65 L 120 50 L 135 15 L 90 25" />
        <path d="M 20 25 L 65 15 L 135 15" />
        <text x="50" y="20" class="fill-amber-300 stroke-none">A (Sup)</text>
        <text x="50" y="77" class="fill-amber-300 stroke-none">B (Inf)</text>
        <text x="8" y="48" class="fill-amber-300 stroke-none">H</text>
        <text x="105" y="62" class="fill-amber-300 stroke-none">L</text>
      </svg>
    `,
    calculateVolume(p) {
      return 0.5 * ((p.base_a || 0) + (p.base_b || 0)) * (p.alto || 0) * (p.largo || 0)
    },
    explainCalculation(p) {
      const A = (p.base_a || 0).toFixed(2)
      const B = (p.base_b || 0).toFixed(2)
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `0.5 × (${A}m + ${B}m) × ${H}m × ${L}m = ${V} m³`
    },
    createGeometry(p) {
      const L = Math.max(0.01, p.largo || 1)
      const H = Math.max(0.01, p.alto || 1)
      const A = Math.max(0.01, p.base_a || 1)
      const B = Math.max(0.01, p.base_b || 1)

      const shape = new THREE.Shape()
      shape.moveTo(-B / 2, 0)
      shape.lineTo(B / 2, 0)
      shape.lineTo(A / 2, H)
      shape.lineTo(-A / 2, H)
      shape.closePath()

      const geom = new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth: L,
        bevelEnabled: false
      })
      geom.translate(0, 0, -L / 2)
      geom.rotateY(Math.PI / 2) // el largo corre sobre X (eslora)
      return geom
    }
  },

  // 5. TRAPEZOIDE CÓNICO (1) - 4 LADOS
  trapezoide_conico_1: {
    id: 'trapezoide_conico_1',
    nombre: 'Trapezoide Cónico (1)',
    categoria: 'Pozos y Rampas',
    descripcion: 'V = ¼ × (A + B + C + D) × H × L. Pozo trapezoidal cuya sección cambia de un extremo al otro.',
    formula: 'V = ¼ × (A + B + C + D) × H × L',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 5.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto vertical (H)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_a', label: 'Ancho sup. extremo 1 (A)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_b', label: 'Ancho inf. extremo 1 (B)', default: 1.5, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'diametro_d', label: 'Ancho sup. extremo 2 (C)', default: 1.8, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'diametro_d_menor', label: 'Ancho inf. extremo 2 (D)', default: 1.2, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 30 70 L 80 70 L 105 20 L 15 20 Z" />
        <path d="M 80 70 L 125 55 L 145 15 L 105 20" />
        <path d="M 15 20 L 60 10 L 145 15" />
        <text x="55" y="16" class="fill-amber-300 stroke-none">A</text>
        <text x="50" y="82" class="fill-amber-300 stroke-none">B</text>
        <text x="135" y="38" class="fill-amber-300 stroke-none">C, D</text>
      </svg>
    `,
    calculateVolume(p) {
      const A = p.base_a || 0
      const B = p.base_b || 0
      const C = p.diametro_d || 0
      const D = p.diametro_d_menor || 0
      const H = p.alto || 0
      const L = p.largo || 0
      return 0.25 * (A + B + C + D) * H * L
    },
    explainCalculation(p) {
      const sum = ((p.base_a || 0) + (p.base_b || 0) + (p.diametro_d || 0) + (p.diametro_d_menor || 0)).toFixed(2)
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `0.25 × (${sum}m) × ${H}m × ${L}m = ${V} m³`
    },
    createGeometry(p) {
      return prismoideTrapezoidal(
        Math.max(0.01, p.largo || 1),
        Math.max(0.01, p.alto || 1),
        Math.max(0.01, p.base_a || 1),
        Math.max(0.01, p.base_b || 1),
        Math.max(0.01, p.diametro_d || 1),
        Math.max(0.01, p.diametro_d_menor || 1)
      )
    }
  },

  // 6. TRAPEZOIDE CÓNICO (2) - 3 LADOS
  trapezoide_conico_2: {
    id: 'trapezoide_conico_2',
    nombre: 'Trapezoide Cónico (2)',
    categoria: 'Pozos y Rampas',
    descripcion: 'V = ¼ × (A + B + C) × H × L. Tolva: el piso converge en un punto en el extremo 2.',
    formula: 'V = ¼ × (A + B + C) × H × L',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 5.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto vertical (H)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_a', label: 'Ancho sup. extremo 1 (A)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'base_b', label: 'Ancho inf. extremo 1 (B)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'diametro_d', label: 'Ancho sup. extremo 2 (C)', default: 2.5, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 30 70 L 80 70 L 95 25 L 20 25 Z" />
        <path d="M 80 70 L 125 55 L 140 18 L 95 25" />
        <path d="M 20 25 L 65 15 L 140 18" />
        <text x="55" y="20" class="fill-amber-300 stroke-none">A</text>
        <text x="50" y="82" class="fill-amber-300 stroke-none">B</text>
        <text x="135" y="40" class="fill-amber-300 stroke-none">C</text>
      </svg>
    `,
    calculateVolume(p) {
      const A = p.base_a || 0
      const B = p.base_b || 0
      const C = p.diametro_d || 0
      const H = p.alto || 0
      const L = p.largo || 0
      return 0.25 * (A + B + C) * H * L
    },
    explainCalculation(p) {
      const sum = ((p.base_a || 0) + (p.base_b || 0) + (p.diametro_d || 0)).toFixed(2)
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `0.25 × (${sum}m) × ${H}m × ${L}m = ${V} m³`
    },
    createGeometry(p) {
      // Caso particular del trapezoide cónico (1) con D = 0
      return prismoideTrapezoidal(
        Math.max(0.01, p.largo || 1),
        Math.max(0.01, p.alto || 1),
        Math.max(0.01, p.base_a || 1),
        Math.max(0.01, p.base_b || 1),
        Math.max(0.01, p.diametro_d || 1),
        0
      )
    }
  },

  // 7. CILINDRO (COLUMNA / CONDUCTO)
  cilindro: {
    id: 'cilindro',
    nombre: 'Cilindro (Columna / Tubería)',
    categoria: 'Conductos y Columnas',
    descripcion: 'V = π × R² × L. Columnas estructurales de bodega o conductos.',
    formula: 'V = π × R² × L',
    params: [
      { key: 'diametro_d', label: 'Diámetro (D)', default: 1.0, min: 0.05, step: 0.05, unit: 'm' },
      { key: 'alto', label: 'Longitud / Alto (L)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <ellipse cx="40" cy="50" rx="15" ry="30" />
        <line x1="40" y1="20" x2="120" y2="20" />
        <line x1="40" y1="80" x2="120" y2="80" />
        <path d="M 120 20 A 15 30 0 0 1 120 80 A 15 30 0 0 1 120 20" />
        <text x="75" y="15" class="fill-amber-300 stroke-none">L</text>
        <text x="25" y="55" class="fill-amber-300 stroke-none">R</text>
      </svg>
    `,
    calculateVolume(p) {
      const R = (p.diametro_d || 0) / 2
      return Math.PI * Math.pow(R, 2) * (p.alto || 0)
    },
    explainCalculation(p) {
      const R = ((p.diametro_d || 0) / 2).toFixed(2)
      const L = (p.alto || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `π × (${R}m)² × ${L}m = ${V} m³`
    },
    createGeometry(p) {
      const R = Math.max(0.01, (p.diametro_d || 1) / 2)
      const H = Math.max(0.01, p.alto || 1)
      const geom = new THREE.CylinderGeometry(radioEquivalente(R), radioEquivalente(R), H, SEGMENTOS_RADIALES)
      geom.translate(0, H / 2, 0)
      return geom
    }
  },

  // 8. CILINDRO CÓNICO (TRONCO DE CONO)
  tronco_cono: {
    id: 'tronco_cono',
    nombre: 'Cilindro Cónico (Tronco de Cono)',
    categoria: 'Conductos y Columnas',
    descripcion: 'V = 0.2618 × H × (d² + D² + d·D). Embudos, escotillas y tolvas cónicas.',
    formula: 'V = 0.2618 × H × (d² + D² + d·D)',
    params: [
      { key: 'diametro_d', label: 'Diámetro Mayor (D)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'diametro_d_menor', label: 'Diámetro Menor (d)', default: 1.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Altura (H)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <ellipse cx="80" cy="25" rx="45" ry="12" />
        <ellipse cx="80" cy="75" rx="25" ry="7" />
        <line x1="35" y1="25" x2="55" y2="75" />
        <line x1="125" y1="25" x2="105" y2="75" />
        <text x="75" y="15" class="fill-amber-300 stroke-none">D (Mayor)</text>
        <text x="75" y="92" class="fill-amber-300 stroke-none">d (Menor)</text>
        <text x="125" y="55" class="fill-amber-300 stroke-none">H</text>
      </svg>
    `,
    calculateVolume(p) {
      const D = p.diametro_d || 0
      const d = p.diametro_d_menor || 0
      const H = p.alto || 0
      return 0.2618 * H * (Math.pow(d, 2) + Math.pow(D, 2) + d * D)
    },
    explainCalculation(p) {
      const D = (p.diametro_d || 0).toFixed(2)
      const d = (p.diametro_d_menor || 0).toFixed(2)
      const H = (p.alto || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `0.2618 × ${H}m × (${d}² + ${D}² + ${d}×${D}) = ${V} m³`
    },
    createGeometry(p) {
      const rTop = Math.max(0.01, (p.diametro_d || 1) / 2)
      const rBottom = Math.max(0.01, (p.diametro_d_menor || 1) / 2)
      const H = Math.max(0.01, p.alto || 1)
      const geom = new THREE.CylinderGeometry(radioEquivalente(rTop), radioEquivalente(rBottom), H, SEGMENTOS_RADIALES)
      geom.translate(0, H / 2, 0)
      return geom
    }
  },

  // 9. CILINDRO ELÍPTICO (BOLSA DE RED)
  // Se conserva el id 'elipsoide' para no romper las bases ya guardadas.
  // La ficha lo llama "Elipsoide", pero lo dibuja y lo calcula como un cilindro de
  // sección elíptica: 0,78545 = π/4 (la ficha usa π ≈ 3,1418).
  elipsoide: {
    id: 'elipsoide',
    nombre: 'Cilindro Elíptico (Bolsa de Red)',
    categoria: 'Especiales',
    descripcion: 'V = π/4 × W × H × L (≈ 0,7854). Copo o bolsa de red: cilindro de largo L con sección elíptica W × H.',
    formula: 'V = π/4 × W × H × L',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 6.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'ancho', label: 'Ancho de la sección (W)', default: 3.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto de la sección (H)', default: 2.5, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <ellipse cx="40" cy="50" rx="12" ry="22" />
        <line x1="40" y1="28" x2="120" y2="28" />
        <line x1="40" y1="72" x2="120" y2="72" />
        <path d="M 120 28 A 12 22 0 0 1 120 72" />
        <path d="M 120 28 A 12 22 0 0 0 120 72" stroke-dasharray="2,2" />
        <text x="78" y="22" class="fill-amber-300 stroke-none">L</text>
        <text x="20" y="90" class="fill-amber-300 stroke-none">W × H</text>
      </svg>
    `,
    calculateVolume(p) {
      return (Math.PI / 4) * (p.ancho || 0) * (p.alto || 0) * (p.largo || 0)
    },
    explainCalculation(p) {
      const W = (p.ancho || 0).toFixed(2)
      const H = (p.alto || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `0.7854 × ${W}m × ${H}m × ${L}m = ${V} m³`
    },
    createGeometry(p) {
      const L = Math.max(0.01, p.largo || 1)
      // Semiejes ajustados para que el polígono de la sección conserve el área de la elipse
      const ry = radioEquivalente(Math.max(0.01, (p.alto || 1) / 2))
      const rz = radioEquivalente(Math.max(0.01, (p.ancho || 1) / 2))
      const geom = new THREE.CylinderGeometry(1, 1, L, SEGMENTOS_RADIALES)
      geom.rotateZ(Math.PI / 2) // eje del cilindro sobre X (eslora)
      geom.scale(1, ry, rz)
      geom.translate(0, ry, 0)
      return geom
    }
  },


  // 10. PIRAMIDAL / TETRAEDRO
  piramidal: {
    id: 'piramidal',
    nombre: 'Piramidal / Cuña Esquinera',
    categoria: 'Especiales',
    descripcion: 'V = (W × L × H) / 6. Rincones de quilla o compensaciones triangulares.',
    formula: 'V = (W × L × H) / 6',
    params: [
      { key: 'largo', label: 'Largo (L)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'ancho', label: 'Ancho (W)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' },
      { key: 'alto', label: 'Alto (H)', default: 2.0, min: 0.1, step: 0.1, unit: 'm' }
    ],
    svgDiagram: `
      <svg viewBox="0 0 160 100" class="w-full h-20 stroke-sky-400 fill-sky-500/10 stroke-1 font-mono text-[9px]">
        <path d="M 25 75 L 120 75 L 70 20 Z" />
        <path d="M 120 75 L 140 50 L 70 20" />
        <path d="M 25 75 L 70 20" />
        <text x="65" y="87" class="fill-amber-300 stroke-none">L</text>
        <text x="75" y="16" class="fill-amber-300 stroke-none">H</text>
        <text x="130" y="68" class="fill-amber-300 stroke-none">W</text>
      </svg>
    `,
    calculateVolume(p) {
      return ((p.ancho || 0) * (p.largo || 0) * (p.alto || 0)) / 6
    },
    explainCalculation(p) {
      const W = (p.ancho || 0).toFixed(2)
      const L = (p.largo || 0).toFixed(2)
      const H = (p.alto || 0).toFixed(2)
      const V = this.calculateVolume(p).toFixed(2)
      return `(${W}m × ${L}m × ${H}m) / 6 = ${V} m³`
    },
    createGeometry(p) {
      const L = Math.max(0.01, p.largo || 1)
      const W = Math.max(0.01, p.ancho || 1)
      const H = Math.max(0.01, p.alto || 1)

      const v = [
        [-L/2, 0, -W/2],
        [ L/2, 0, -W/2],
        [-L/2, 0,  W/2],
        [-L/2, H, -W/2]
      ]

      const indices = [
        0, 1, 2, // Base inferior (normal hacia -Y)
        0, 3, 1, // Cara posterior Z- (normal hacia -Z)
        0, 2, 3, // Cara lateral X- (normal hacia -X)
        1, 3, 2  // Cara inclinada frontal (normal hacia afuera)
      ]

      const positions = []
      for (const idx of indices) {
        positions.push(...v[idx])
      }

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geom.computeVertexNormals()
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((positions.length / 3) * 2), 2))
      return geom
    }
  }
}

/**
 * Calcula el volumen analítico total de una lista de bloques
 */
export function calculateAnalyticalTotal(bloques) {
  let total = 0
  for (const b of bloques) {
    const def = GEOMETRY_TYPES[b.tipo_figura]
    if (!def) continue
    const vol = def.calculateVolume(b)
    if (b.operacion === 'SUBSTRACCION') {
      total -= vol
    } else {
      total += vol
    }
  }
  return Math.max(0, total)
}
