import { buildCompositePozo } from './csgService.js'

/**
 * Calcula el sólido booleano y lo devuelve como datos planos (sin objetos de
 * Three.js), listos para enviarse desde un Web Worker con transferencia de buffers.
 * La geometría sale en coordenadas del mundo.
 *
 * @returns {{ volume: number, error: string|null,
 *             positions: Float32Array|null, normals: Float32Array|null, index: Uint32Array|null }}
 */
export function computeCompositeData(bloques) {
  const result = buildCompositePozo(bloques)
  const data = { volume: result.volume, error: result.error, positions: null, normals: null, index: null }

  const mesh = result.mesh
  if (mesh?.geometry) {
    // La librería CSG deja la malla con la posición/rotación de la primera pieza:
    // se aplica a la geometría para que el visor la dibuje sin transformaciones.
    mesh.updateMatrix()
    const geometry = mesh.geometry
    geometry.applyMatrix4(mesh.matrix)

    const pos = geometry.getAttribute('position')
    const nor = geometry.getAttribute('normal')
    if (pos) data.positions = new Float32Array(pos.array)
    if (nor) data.normals = new Float32Array(nor.array)
    if (geometry.index) data.index = new Uint32Array(geometry.index.array)
    geometry.dispose()
  }
  return data
}
