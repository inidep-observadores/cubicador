import { reactive } from 'vue'

/**
 * Diálogos propios en lugar de confirm()/prompt()/alert() del navegador: tienen
 * el estilo de la app, no bloquean el hilo principal (el cálculo 3D y el visor
 * siguen funcionando) y en una PWA instalada no muestran el dominio del sitio.
 *
 * Uso: `if (await confirmDialog({ ... }))`, `const texto = await promptDialog({ ... })`.
 * Los muestra el componente AppDialog, montado una sola vez en App.vue.
 */

export const dialogState = reactive({
  open: false,
  kind: 'confirm', // 'confirm' | 'prompt' | 'alert'
  title: '',
  message: '',
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
  danger: false,
  value: '',
  placeholder: ''
})

let resolver = null

function openDialog(kind, options) {
  // Si había otro abierto, se cierra como cancelado
  if (resolver) closeDialog(kind === 'prompt' ? null : false)
  Object.assign(dialogState, {
    kind,
    title: options.title || '',
    message: options.message || '',
    confirmText: options.confirmText || 'Aceptar',
    cancelText: options.cancelText || 'Cancelar',
    danger: Boolean(options.danger),
    value: options.defaultValue ?? '',
    placeholder: options.placeholder || '',
    open: true
  })
  return new Promise(resolve => { resolver = resolve })
}

/** Cierra el diálogo devolviendo `result` a quien lo abrió. */
export function closeDialog(result) {
  const resolve = resolver
  resolver = null
  dialogState.open = false
  resolve?.(result)
}

/** Resuelve true si se confirma, false si se cancela. */
export function confirmDialog(options) {
  return openDialog('confirm', options)
}

/** Resuelve el texto ingresado (sin espacios a los costados), o null si se cancela. */
export function promptDialog(options) {
  return openDialog('prompt', options)
}

/** Muestra un aviso; resuelve cuando se cierra. */
export function alertDialog(options) {
  return openDialog('alert', { confirmText: 'Entendido', ...options })
}
