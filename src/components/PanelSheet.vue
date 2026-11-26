<template>
  <!--
    Panel flotante del modo compacto. En teléfono vertical sube desde abajo y
    deja ver la parte superior del visor; en tablet o teléfono horizontal es un
    cajón lateral. No bloquea el visor: se puede seguir tocando la escena.
  -->
  <section
    role="dialog"
    :aria-label="title"
    class="absolute z-40 flex flex-col bg-slate-900/[0.98] backdrop-blur border-slate-700 shadow-2xl"
    :class="layout.isPhone
      ? 'inset-x-0 bottom-0 h-[62%] min-h-[260px] rounded-t-2xl border-t'
      : side === 'left'
        ? 'top-0 bottom-0 left-0 w-80 max-w-[85%] border-r'
        : 'top-0 bottom-0 right-0 w-[21rem] max-w-[85%] border-l'"
    @keydown.esc="closePanel()"
  >
    <header class="shrink-0 flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-slate-800">
      <span v-if="layout.isPhone" class="absolute left-1/2 top-1 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-700" aria-hidden="true"></span>
      <component :is="icon" v-if="icon" class="w-4 h-4 text-sky-400" />
      <h2 class="flex-1 text-xs font-bold uppercase tracking-wider text-slate-200 mt-1">{{ title }}</h2>
      <button
        @click="closePanel()"
        aria-label="Cerrar panel"
        class="p-2 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
      >
        <X class="w-4 h-4" />
      </button>
    </header>
    <div class="flex-1 min-h-0 flex flex-col">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { X } from 'lucide-vue-next'
import { layout, closePanel } from '../services/layout'

defineProps({
  title: { type: String, required: true },
  icon: { type: [Object, Function], default: null },
  side: { type: String, default: 'left' } // en tablet: 'left' | 'right'
})
</script>
