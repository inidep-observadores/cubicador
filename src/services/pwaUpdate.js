import { reactive } from 'vue'
import { registerSW } from 'virtual:pwa-register'

/**
 * Actualización automática de la app (también la instalada).
 *
 * El service worker nuevo se descarga solo cuando hay una versión publicada.
 * Para no perder trabajo, se aplica (recargando la página) recién cuando la app
 * está en reposo: sin diálogos ni formularios abiertos, sin un campo en edición
 * y después de guardar lo pendiente. Si la pestaña está oculta, se aplica ya.
 */

const CHECK_EVERY_MS = 30 * 60 * 1000 // además de al abrir, volver a la app o reconectar
const RETRY_MS = 4000
const NOTICE_MS = 1500

// 'al-dia' | 'disponible' (esperando un momento de reposo) | 'actualizando'
export const appUpdate = reactive({ status: 'al-dia' })

let updateSW = null
let options = null

/**
 * @param {{ isIdle: () => boolean, beforeReload: () => Promise<void> }} opts
 *   isIdle: true cuando se puede recargar sin interrumpir al usuario.
 *   beforeReload: guarda lo pendiente antes de recargar.
 */
export function setupAutoUpdate(opts) {
  options = opts
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      appUpdate.status = 'disponible'
      tryApply()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (!navigator.onLine || registration.installing) return
        registration.update().catch(() => {}) // sin conexión o servidor caído: se reintenta después
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
        else tryApply() // la app pasó a segundo plano: buen momento para actualizar
      })
      window.addEventListener('online', check)
    }
  })
}

function isUserTyping() {
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

async function tryApply() {
  if (appUpdate.status !== 'disponible' || !updateSW) return
  const hidden = document.visibilityState === 'hidden'
  if (!hidden && (!options.isIdle() || isUserTyping())) {
    setTimeout(tryApply, RETRY_MS)
    return
  }
  appUpdate.status = 'actualizando'
  try {
    await options.beforeReload()
  } catch (err) {
    console.warn('No se pudo guardar antes de actualizar; se reintenta.', err)
    appUpdate.status = 'disponible'
    setTimeout(tryApply, RETRY_MS)
    return
  }
  if (!hidden) await new Promise(r => setTimeout(r, NOTICE_MS)) // dejar ver el aviso
  updateSW(true) // activa la versión nueva y recarga la página
}
