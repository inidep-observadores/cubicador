/**
 * Factor de captura a partir de una captura conocida:
 * toneladas capturadas ÷ volumen que ocuparon (m³).
 */
import { parseDecimal } from './decimal.js'

/**
 * Kilos escritos a mano. A diferencia de las medidas, acá es común escribir el
 * separador de miles: "68.000" son 68 000 kg y no 68.
 */
export function parseKg(text) {
  const t = String(text).trim().replace(/\s/g, '')
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d*)?$/.test(t)) {
    return Number(t.replaceAll('.', '').replace(',', '.'))
  }
  return parseDecimal(t)
}

/** Factor en t/m³ con 3 decimales, o null si los datos no alcanzan. */
export function captureFactor(kg, m3) {
  if (!(kg > 0) || !(m3 > 0)) return null
  const factor = Math.round(kg / m3) / 1000
  return factor > 0 && Number.isFinite(factor) ? factor : null
}
