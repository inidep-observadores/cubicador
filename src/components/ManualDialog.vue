<template>
  <div
    v-if="layout.manualOpen"
    class="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
    :class="layout.isPhone ? '' : 'p-4'"
    @mousedown.self="closeManual"
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-title"
      class="flex flex-col w-full bg-slate-900 border-slate-700 shadow-2xl select-text"
      :class="layout.isPhone ? 'h-full' : 'max-w-3xl h-[90vh] border rounded-xl'"
      @keydown.esc.prevent="closeManual"
    >
      <header class="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
        <BookOpen class="w-4 h-4 text-sky-400" />
        <h2 id="manual-title" class="text-sm font-bold text-slate-100">Manual de uso</h2>
        <button
          @click="toTop"
          class="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
        >
          <ListTree class="w-3.5 h-3.5" />
          Índice
        </button>
        <button
          ref="closeRef"
          @click="closeManual"
          aria-label="Cerrar el manual"
          title="Cerrar (Esc)"
          class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </header>

      <div
        ref="bodyRef"
        class="manual-content flex-1 overflow-y-auto px-4 sm:px-6 py-4"
        @click="onClick"
        v-html="manualHtml"
      ></div>
    </section>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { BookOpen, ListTree, X } from 'lucide-vue-next'
import { layout, openManual, closeManual } from '../services/layout'
import { dialogState } from '../services/dialog'
import { manualHtml } from '../services/manual'

const bodyRef = ref(null)
const closeRef = ref(null)
let previousFocus = null

watch(() => layout.manualOpen, async open => {
  if (open) {
    previousFocus = document.activeElement
    await nextTick()
    closeRef.value?.focus()
  } else {
    previousFocus?.focus?.()
    previousFocus = null
  }
})

function toTop() {
  bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// Los enlaces del índice navegan dentro del manual, sin cambiar la dirección
function onClick(e) {
  const a = e.target.closest('a')
  const href = a?.getAttribute('href')
  if (!href?.startsWith('#')) return
  e.preventDefault()
  const target = document.getElementById(decodeURIComponent(href.slice(1)))
  if (target && bodyRef.value?.contains(target)) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// F1 abre o cierra el manual desde cualquier parte de la app
function onKeyDown(e) {
  if (e.key !== 'F1') return
  e.preventDefault()
  if (dialogState.open) return
  if (layout.manualOpen) closeManual()
  else openManual()
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>
