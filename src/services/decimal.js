/**
 * Números decimales con la convención en español: se muestran con coma y se
 * aceptan tanto coma como punto al escribirlos (sin separador de miles).
 */
const PATTERN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/
const DECIMALS = 4

/** Devuelve el número, o null si el texto no es un decimal válido. */
export function parseDecimal(text) {
  const t = String(text).trim()
  return PATTERN.test(t) ? Number(t.replace(',', '.')) : null
}

/** Texto para un campo: hasta 4 decimales, sin ceros sobrantes y con coma. */
export function formatDecimal(value) {
  if (!Number.isFinite(value)) return ''
  return String(Number(value.toFixed(DECIMALS))).replace('.', ',')
}
