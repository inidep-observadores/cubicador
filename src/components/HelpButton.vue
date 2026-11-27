<template>
  <!-- Acceso al manual siempre a la vista, en la esquina del visor -->
  <button
    @click="openManual()"
    :title="layout.isTouch ? 'Ayuda: manual de uso' : 'Ayuda: manual de uso (F1)'"
    aria-label="Ayuda: manual de uso"
    class="absolute z-[31] flex items-center justify-center rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-sky-400 hover:text-white hover:bg-slate-800 shadow-lg transition"
    :class="[layout.isCompact ? 'top-2 right-2' : 'top-4 right-4', layout.isTouch ? 'w-9 h-9' : 'w-8 h-8']"
  >
    <CircleHelp class="w-5 h-5" />
  </button>
</template>

<script setup>
import { CircleHelp } from 'lucide-vue-next'
import { layout, openManual } from '../services/layout'
</script>
