import { computeCompositeData } from '../services/csgCompute.js'

// El cálculo booleano puede tardar cientos de milisegundos con muchas piezas:
// corre acá para no congelar la interfaz.
self.onmessage = event => {
  const { id, bloques } = event.data
  let data
  try {
    data = computeCompositeData(bloques)
  } catch (err) {
    data = { volume: 0, error: err?.message || String(err), positions: null, normals: null, index: null }
  }
  const transfer = [data.positions, data.normals, data.index].filter(Boolean).map(a => a.buffer)
  self.postMessage({ id, ...data }, transfer)
}
