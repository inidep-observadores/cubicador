import { Marked } from 'marked'
import fuente from '../../docs/06-manual-de-usuario.md?raw'

/**
 * Manual de usuario dentro de la app. La fuente es la misma que en /docs, así que
 * hay un solo texto que mantener.
 */

// Igual que GitHub: así funcionan los enlaces del índice del manual
export function slug(texto) {
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const escapar = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const marked = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${escapar(slug(text))}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
    link({ href, title, tokens }) {
      const contenido = this.parser.parseInline(tokens)
      const t = title ? ` title="${escapar(title)}"` : ''
      const externo = !href.startsWith('#')
      return `<a href="${escapar(href)}"${t}${externo ? ' target="_blank" rel="noopener"' : ''}>${contenido}</a>`
    }
  }
})

// Imágenes del manual: el texto las nombra relativas a /docs (img/manual/...);
// en la app se sirven como recursos del build
const imagenes = Object.fromEntries(
  Object.entries(import.meta.glob('../../docs/img/manual/*', { eager: true, query: '?url', import: 'default' }))
    .map(([ruta, url]) => [ruta.replace('../../docs/', ''), url])
)

// Sin la línea que dice dónde leer el manual: ya se está leyendo
export const manualHtml = marked
  .parse(fuente.replace(/^> \*\*Dónde leer este manual:\*\*.*$/m, ''))
  .replace(/<img src="(img\/[^"]+)"/g, (todo, ruta) =>
    imagenes[ruta] ? `<img loading="lazy" src="${imagenes[ruta]}"` : todo)
