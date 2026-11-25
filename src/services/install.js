import { ref } from 'vue'

/**
 * Instalación de la PWA. Instalarla permite usarla sin conexión como una app más
 * y hace que el navegador conserve sus datos de forma más confiable.
 *
 * `beforeinstallprompt` puede dispararse antes de que se monte Vue, por eso se
 * escucha desde que se importa este módulo (en main.js).
 */

let deferredPrompt = null

// true cuando el navegador ofrece instalarla (Chrome, Edge, Android)
export const canInstall = ref(false)

// true si ya se está ejecutando como app instalada
export const isInstalled = ref(
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
)

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault() // mostrar el botón propio en lugar del aviso del navegador
  deferredPrompt = event
  canInstall.value = true
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  canInstall.value = false
  isInstalled.value = true
})

export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  canInstall.value = false
  return outcome === 'accepted'
}
