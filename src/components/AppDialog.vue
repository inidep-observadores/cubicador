<template>
  <div
    v-if="dialogState.open"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
    @mousedown.self="cancel"
  >
    <form
      role="dialog"
      aria-modal="true"
      :aria-labelledby="dialogState.title ? 'app-dialog-title' : undefined"
      aria-describedby="app-dialog-message"
      class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 select-text"
      @submit.prevent="accept"
      @keydown.esc.prevent="cancel"
    >
      <h2 v-if="dialogState.title" id="app-dialog-title" class="text-base font-bold text-slate-100">
        {{ dialogState.title }}
      </h2>
      <p id="app-dialog-message" class="text-sm text-slate-300 whitespace-pre-line">{{ dialogState.message }}</p>

      <input
        v-if="dialogState.kind === 'prompt'"
        ref="inputRef"
        v-model="dialogState.value"
        type="text"
        :placeholder="dialogState.placeholder"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
      />

      <div class="flex justify-end gap-2 pt-1">
        <button
          v-if="dialogState.kind !== 'alert'"
          type="button"
          @click="cancel"
          class="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
        >
          {{ dialogState.cancelText }}
        </button>
        <button
          ref="confirmRef"
          type="submit"
          :disabled="dialogState.kind === 'prompt' && !dialogState.value.trim()"
          :class="dialogState.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-sky-600 hover:bg-sky-500'"
          class="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ dialogState.confirmText }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { dialogState, closeDialog } from '../services/dialog'

const inputRef = ref(null)
const confirmRef = ref(null)
let previousFocus = null

watch(() => dialogState.open, async open => {
  if (open) {
    previousFocus = document.activeElement
    await nextTick()
    if (dialogState.kind === 'prompt') {
      inputRef.value?.focus()
      inputRef.value?.select()
    } else {
      confirmRef.value?.focus()
    }
  } else {
    // Devolver el foco a donde estaba antes de abrir el diálogo
    previousFocus?.focus?.()
    previousFocus = null
  }
})

function accept() {
  if (dialogState.kind === 'prompt') {
    const text = dialogState.value.trim()
    if (!text) return
    closeDialog(text)
  } else {
    closeDialog(true)
  }
}

function cancel() {
  closeDialog(dialogState.kind === 'prompt' ? null : false)
}
</script>
