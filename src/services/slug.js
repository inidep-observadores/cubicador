// Igual que GitHub: así funcionan los enlaces del índice del manual, tanto en la
// app como en el PDF
export function slug(texto) {
  return texto
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}
