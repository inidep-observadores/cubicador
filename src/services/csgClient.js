import * as THREE from 'three'
import { computeCompositeData } from './csgCompute.js'

/**
 * Punto único de acceso al cálculo del sólido booleano.
 *
 * - Corre en un Web Worker (con respaldo síncrono si no hay soporte).
 * - Guarda en caché los últimos resultados: el store (volumen) y el visor
 *   (malla del modo "Pozo Booleano") comparten el mismo cálculo.
 * - Hace un solo cálculo a la vez y, si llegan varios pedidos mientras tanto,
 *   procesa solo el último: los intermedios se resuelven como `superseded`.
 *
 * Resultado: { volume, error, geometry: THREE.BufferGeometry|null, superseded? }
 * La geometría es compartida: quien la use no debe liberarla (dispose).
 */

// Campos que cambian la forma del sólido (el nombre, por ejemplo, no)
const CAMPOS_GEOMETRICOS = [
  'tipo_figura', 'operacion', 'largo', 'ancho', 'alto', 'base_a', 'base_b',
  'diametro_d', 'diametro_d_menor', 'pos_x', 'pos_y', 'pos_z', 'rot_x', 'rot_y', 'rot_z'
]
const MAX_CACHE = 4

const cache = new Map() // clave → Promise<resultado>
let worker = null
let workerUnavailable = typeof Worker === 'undefined'
let nextId = 1
let inFlight = null // { id, key, resolve }
let queued = null // { key, bloques, resolve }

export function compositeKey(bloques) {
  return JSON.stringify(bloques.map(b => CAMPOS_GEOMETRICOS.map(c => b[c])))
}

function toResult(data) {
  let geometry = null
  if (data.positions) {
    geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    if (data.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
    else geometry.computeVertexNormals()
    if (data.index) geometry.setIndex(new THREE.BufferAttribute(data.index, 1))
  }
  return { volume: data.volume, error: data.error, geometry }
}

function getWorker() {
  if (worker || workerUnavailable) return worker
  try {
    worker = new Worker(new URL('../workers/csgWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = event => {
      const pending = inFlight
      inFlight = null
      if (pending && pending.id === event.data.id) pending.resolve(toResult(event.data))
      sendNext()
    }
    worker.onerror = event => {
      // El worker no pudo cargarse: seguir calculando en el hilo principal
      console.warn('Cálculo 3D en segundo plano no disponible; se usa el hilo principal.', event.message)
      event.preventDefault?.()
      worker.terminate()
      worker = null
      workerUnavailable = true
      const pending = inFlight
      inFlight = null
      if (pending) pending.resolve(computeSync(pending.bloques))
      sendNext()
    }
  } catch (err) {
    console.warn('No se pudo crear el worker de cálculo 3D:', err)
    workerUnavailable = true
    worker = null
  }
  return worker
}

function computeSync(bloques) {
  try {
    return toResult(computeCompositeData(bloques))
  } catch (err) {
    return { volume: 0, error: err?.message || String(err), geometry: null }
  }
}

function sendNext() {
  if (inFlight || !queued) return
  const job = queued
  queued = null
  const w = getWorker()
  if (!w) {
    job.resolve(computeSync(job.bloques))
    sendNext()
    return
  }
  inFlight = { id: nextId++, key: job.key, bloques: job.bloques, resolve: job.resolve }
  w.postMessage({ id: inFlight.id, bloques: job.bloques })
}

function remember(key, promise) {
  cache.set(key, promise)
  while (cache.size > MAX_CACHE) {
    const [oldKey, oldPromise] = cache.entries().next().value
    cache.delete(oldKey)
    oldPromise.then(r => r.geometry?.dispose())
  }
}

/**
 * Pide el sólido booleano de un conjunto de piezas.
 * Devuelve la misma promesa para piezas idénticas.
 */
export function computeComposite(bloques) {
  const key = compositeKey(bloques)
  const cached = cache.get(key)
  if (cached) return cached

  // Copia plana: el worker no puede recibir objetos reactivos de Vue
  const plain = bloques.map(b => {
    const copy = { id: b.id, nombre: b.nombre }
    for (const c of CAMPOS_GEOMETRICOS) copy[c] = b[c]
    return copy
  })

  let resolve
  const promise = new Promise(r => { resolve = r })

  // Un pedido que todavía esperaba turno queda obsoleto: se reemplaza por este
  if (queued) {
    cache.delete(queued.key)
    queued.resolve({ volume: 0, error: null, geometry: null, superseded: true })
  }
  queued = { key, bloques: plain, resolve }

  // Los resultados `superseded` no se guardan en caché
  promise.then(r => { if (r.superseded && cache.get(key) === promise) cache.delete(key) })
  remember(key, promise)
  sendNext()
  return promise
}
