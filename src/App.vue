<template>
  <div class="h-screen w-screen flex flex-col bg-slate-950 select-none overflow-hidden font-sans">
    <!-- Pantalla de carga mientras se monta SQLite WASM -->
    <div v-if="store.isLoading" class="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center space-y-4">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 rounded-full border-4 border-sky-500/20 animate-ping"></div>
        <div class="w-16 h-16 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
      </div>
      <div class="text-center">
        <h2 class="text-lg font-bold text-slate-100">Cubicación 3D Naval</h2>
        <p class="text-xs text-slate-400 mt-1">Cargando motor 3D y base de datos SQLite local...</p>
      </div>
    </div>

    <!-- Aplicación Principal -->
    <template v-else>
      <!-- Barra Superior -->
      <Toolbar />

      <!-- Área de Trabajo Principal (Catálogo + Visor 3D + Propiedades) -->
      <div class="flex-1 flex relative overflow-hidden">
        <!-- Paleta Izquierda de Bloques -->
        <BlockCatalog />

        <!-- Visor 3D Central -->
        <main class="flex-1 relative h-full">
          <Viewport3D />
        </main>

        <!-- Inspector Derecho de Propiedades -->
        <PropertiesPanel />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useEditorStore } from './stores/editorStore'
import Toolbar from './components/Toolbar.vue'
import BlockCatalog from './components/BlockCatalog.vue'
import Viewport3D from './components/Viewport3D.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'

const store = useEditorStore()

onMounted(async () => {
  await store.init()
})
</script>
