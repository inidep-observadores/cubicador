<template>
  <!-- Barra inferior del modo compacto: abre los paneles y tiene deshacer/rehacer a mano -->
  <nav
    class="shrink-0 z-40 bg-slate-900 border-t border-slate-800 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]"
    aria-label="Paneles"
  >
    <button
      v-for="item in items"
      :key="item.id"
      @click="item.action"
      :disabled="item.disabled"
      :aria-pressed="item.panel ? layout.panel === item.panel : undefined"
      :title="item.title"
      class="relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg transition disabled:opacity-30"
      :class="[
        layout.isShort ? 'py-1' : 'py-1.5',
        item.panel && layout.panel === item.panel ? 'text-sky-300 bg-sky-500/10' : 'text-slate-400 hover:text-white'
      ]"
    >
      <component :is="item.icon" class="w-5 h-5" />
      <span v-if="!layout.isShort" class="text-[10px] font-medium leading-none">{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="absolute top-1 right-1/2 translate-x-4 min-w-[16px] h-4 px-1 rounded-full bg-sky-600 text-white text-[9px] font-bold leading-4 text-center"
      >{{ item.badge }}</span>
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { Shapes, ListTree, Sliders, Undo2, Redo2, Menu } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editorStore'
import { layout, togglePanel } from '../services/layout'

const store = useEditorStore()

const items = computed(() => [
  { id: 'catalogo', panel: 'catalogo', label: 'Figuras', title: 'Agregar figuras', icon: Shapes, action: () => togglePanel('catalogo'), disabled: !store.selectedPozoId },
  { id: 'componentes', panel: 'componentes', label: 'Piezas', title: 'Piezas del pozo', icon: ListTree, action: () => togglePanel('componentes'), disabled: !store.selectedPozoId, badge: store.bloques.length || null },
  { id: 'inspector', panel: 'inspector', label: 'Editar', title: 'Editar la pieza seleccionada', icon: Sliders, action: () => togglePanel('inspector'), disabled: !store.selectedPozoId },
  { id: 'undo', label: 'Deshacer', title: 'Deshacer', icon: Undo2, action: () => store.undo(), disabled: !store.canUndo },
  { id: 'redo', label: 'Rehacer', title: 'Rehacer', icon: Redo2, action: () => store.redo(), disabled: !store.canRedo },
  { id: 'menu', panel: 'menu', label: 'Más', title: 'Vista, respaldos y app', icon: Menu, action: () => togglePanel('menu') }
])
</script>
