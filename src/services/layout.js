import { reactive } from 'vue'

/**
 * Estado del diseño adaptable.
 *
 * - Escritorio (≥ 1280 px): paleta, visor e inspector en tres columnas; con
 *   menos de 1536 px, paneles más angostos y botones sin texto.
 * - Compacto (< 1280 px, incluida la tablet horizontal): el visor ocupa todo; los paneles se abren desde la
 *   barra inferior, como cajones laterales (tablet, teléfono horizontal) o como
 *   hojas que suben desde abajo (teléfono vertical, < 768 px).
 */
const QUERIES = {
  isPhone: '(max-width: 767px)',
  isCompact: '(max-width: 1279px)',
  isWide: '(min-width: 1536px)',
  isTouch: '(pointer: coarse)',
  isShort: '(max-height: 520px)'
}

export const layout = reactive({
  isPhone: false,
  isCompact: false,
  isWide: true,
  isTouch: false,
  isShort: false,
  // Panel abierto en modo compacto: 'catalogo' | 'componentes' | 'inspector' | 'menu' | null
  panel: null,
  // Manual de uso abierto
  manualOpen: false
})

for (const [key, query] of Object.entries(QUERIES)) {
  const media = window.matchMedia(query)
  layout[key] = media.matches
  media.addEventListener('change', event => {
    layout[key] = event.matches
    // Al pasar a escritorio los paneles vuelven a sus columnas
    if (key === 'isCompact' && !event.matches) layout.panel = null
  })
}

export function openPanel(name) {
  layout.panel = name
}

export function togglePanel(name) {
  layout.panel = layout.panel === name ? null : name
}

export function closePanel() {
  layout.panel = null
}

export function openManual() {
  layout.manualOpen = true
}

export function closeManual() {
  layout.manualOpen = false
}
