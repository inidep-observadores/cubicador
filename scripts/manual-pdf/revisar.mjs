/**
 * Reglas de maquetado del PDF del manual. Cada una devuelve los problemas que
 * encuentra, en texto; sin problemas, una lista vacía.
 * Las páginas se numeran desde 1, como en el pie.
 */
import { MM, MARGEN } from './analizar.mjs'

// Una página que continúa un capítulo debe tener al menos este alto ocupado.
// En la versión revisada a mano, la menos ocupada tiene 0,5
const OCUPACION_MINIMA = 0.4
// Tamaños de letra de estilos.css, en puntos
const TITULO_CAPITULO = 17.5
const TITULO_APARTADO = 12.2
const TEXTO_BASE = 10
const TOLERANCIA = 1.5

// Por el centro: la línea del pie queda pegada al borde del cuerpo y, con
// tolerancia, haría parecer llenas todas las páginas
const dentro = (p) => (e) => {
  const centro = (e.y0 + e.y1) / 2
  return centro > MARGEN.arriba && centro < p.alto - MARGEN.abajo
}
const completo = (p, e) => e.y0 >= MARGEN.arriba - TOLERANCIA && e.y1 <= p.alto - MARGEN.abajo + TOLERANCIA
const cuerpo = (p) => p.elementos.filter(dentro(p))
const textoDe = (elementos) => elementos.filter(e => e.tipo === 'texto').map(e => e.texto).join(' ')
const sinEspacios = (s) => s.replace(/\s+/g, '')
const esCapitulo = (e) => e.tipo === 'texto' && Math.abs(e.tamano - 18) < 0.5

/** Página (desde 1) donde empieza cada capítulo, o null si no empieza arriba. */
function inicios(paginas, capitulos) {
  return capitulos.map(titulo => {
    const i = paginas.findIndex(p => {
      const arriba = cuerpo(p).filter(e => esCapitulo(e) && e.y0 < MARGEN.arriba + 15 * MM)
      return sinEspacios(textoDe(arriba)) === sinEspacios(titulo)
    })
    return i < 0 ? null : i + 1
  })
}

export const REGLAS = {
  'cada capítulo empieza arriba de una página': ({ paginas }, capitulos) => {
    const paginasDe = inicios(paginas, capitulos)
    return capitulos.filter((_, i) => paginasDe[i] === null)
      .map(t => `"${t}" no empieza arriba de una página`)
  },

  'no hay páginas casi vacías': ({ paginas }, capitulos) => {
    const comienzos = new Set(inicios(paginas, capitulos))
    const problemas = []
    paginas.forEach((p, i) => {
      // La portada, el índice y las que abren capítulo pueden ser cortas
      if (i < 2 || comienzos.has(i + 1)) return
      const fondo = Math.max(MARGEN.arriba, ...cuerpo(p).map(e => e.y1))
      const ocupado = (fondo - MARGEN.arriba) / (p.alto - MARGEN.arriba - MARGEN.abajo)
      // La última de un capítulo termina donde termina el texto
      const cierraCapitulo = i + 1 === paginas.length || comienzos.has(i + 2)
      if (ocupado < OCUPACION_MINIMA && !(cierraCapitulo && ocupado > 0.2)) {
        problemas.push(`página ${i + 1}: solo ocupa el ${Math.round(ocupado * 100)} %`)
      }
    })
    return problemas
  },

  'no quedan títulos sueltos al pie de una página': ({ paginas }) => {
    const problemas = []
    paginas.forEach((p, i) => {
      if (i === 0) return
      const elementos = cuerpo(p)
      for (const titulo of elementos.filter(e => e.tipo === 'texto' && e.tamano >= TITULO_APARTADO && e.tamano < 19)) {
        const sigue = elementos.some(e =>
          e.y0 > titulo.y1 - 1 && (e.tipo === 'imagen' || (e.tipo === 'texto' && e.tamano < TITULO_APARTADO)))
        const otroTitulo = elementos.some(e => e.tipo === 'texto' && e.tamano >= TITULO_APARTADO && e.y0 > titulo.y1)
        if (!sigue && !otroTitulo) problemas.push(`página ${i + 1}: "${titulo.texto}" quedó al pie`)
      }
    })
    return problemas
  },

  'nada se sale de los márgenes': ({ paginas }) => {
    const problemas = []
    paginas.forEach((p, i) => {
      if (i === 0) return
      const afuera = cuerpo(p).filter(e =>
        e.x0 < MARGEN.lados - TOLERANCIA || e.x1 > p.ancho - MARGEN.lados + TOLERANCIA)
      if (afuera.length) problemas.push(`página ${i + 1}: contenido fuera de los márgenes laterales`)
      // Arriba y abajo solo puede haber el encabezado y el pie
      const intrusos = p.elementos.filter(e => e.tipo === 'imagen' && !completo(p, e))
      if (intrusos.length) problemas.push(`página ${i + 1}: una imagen invade el encabezado o el pie`)
    })
    return problemas
  },

  'el texto conserva su tamaño (la hoja no se encogió)': ({ paginas }) => {
    const cuantos = new Map()
    for (const e of paginas.slice(1).flatMap(cuerpo)) {
      if (e.tipo !== 'texto') continue
      const t = Math.round(e.tamano * 10) / 10
      cuantos.set(t, (cuantos.get(t) ?? 0) + e.texto.length)
    }
    const [comun] = [...cuantos].sort((a, b) => b[1] - a[1])[0]
    return Math.abs(comun - TEXTO_BASE) < 0.2 ? [] : [`el texto común mide ${comun} pt y no ${TEXTO_BASE}`]
  },

  'encabezado y pie con número de página, salvo en la portada': ({ paginas }) => {
    const problemas = []
    paginas.forEach((p, i) => {
      const margenes = textoDe(p.elementos.filter(e => !dentro(p)(e)))
      const numero = `Página ${i + 1} de ${paginas.length}`
      if (i === 0) {
        if (/Página \d|Manual de usuario.*Página/.test(textoDe(p.elementos))) problemas.push('la portada tiene pie de página')
        return
      }
      if (!sinEspacios(margenes).includes(sinEspacios(numero))) problemas.push(`página ${i + 1}: falta "${numero}"`)
      if (!margenes.includes('Manual de usuario')) problemas.push(`página ${i + 1}: falta el encabezado`)
    })
    return problemas
  },

  'el índice lleva a cada capítulo': ({ paginas }, capitulos) => {
    const destinos = paginas[1].enlaces.map(i => i + 1)
    const esperados = inicios(paginas, capitulos)
    return capitulos.flatMap((titulo, i) =>
      destinos[i] === esperados[i] ? [] : [`el enlace de "${titulo}" va a la página ${destinos[i]} y no a la ${esperados[i]}`])
  },

  'los marcadores nombran cada capítulo una sola vez': ({ marcadores }, capitulos) =>
    capitulos.filter(t => marcadores.filter(m => m.titulo === t).length !== 1)
      .map(t => `falta el marcador "${t}" o está mal escrito`)
}

/** Títulos de capítulo del manual ("## 1. La idea en dos minutos"). */
export const capitulosDe = (markdown) =>
  [...markdown.matchAll(/^## (\d+\. .+?)\s*$/gm)].map(m => m[1])
