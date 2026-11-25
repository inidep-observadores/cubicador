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

    <!-- La base no se pudo abrir -->
    <div v-else-if="store.loadError" class="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-6">
      <div class="max-w-md text-center space-y-3">
        <h2 class="text-lg font-bold text-rose-300">No se pudo abrir la base de datos</h2>
        <p class="text-sm text-slate-300">{{ store.loadError }}</p>
        <p class="text-xs text-slate-500">Los datos guardados no se modificaron.</p>
      </div>
    </div>

    <!-- La base está abierta en otra pestaña -->
    <div v-else-if="store.tabStatus !== 'ok'" class="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-6">
      <div class="max-w-md text-center space-y-4">
        <h2 class="text-lg font-bold text-amber-300">
          {{ store.tabStatus === 'ocupada' ? 'La aplicación ya está abierta en otra pestaña' : 'La aplicación se abrió en otra pestaña' }}
        </h2>
        <p class="text-sm text-slate-300">
          Para no perder datos, la base se usa en una sola pestaña a la vez.
          {{ store.tabStatus === 'ocupada'
            ? 'Podés seguir en la otra pestaña o pasar a usarla acá.'
            : 'Esta pestaña dejó de guardar cambios.' }}
        </p>
        <button
          v-if="store.tabStatus === 'ocupada'"
          @click="store.useInThisTab()"
          class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Usar en esta pestaña
        </button>
        <button
          v-else
          @click="reload"
          class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Recargar esta pestaña
        </button>
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
import { onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from './stores/editorStore'
import Toolbar from './components/Toolbar.vue'
import BlockCatalog from './components/BlockCatalog.vue'
import Viewport3D from './components/Viewport3D.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'

const store = useEditorStore()

// Guardar lo pendiente antes de que la pestaña se cierre o pase a segundo plano
// (en móviles, ocultarse suele ser el último aviso antes de que el sistema la cierre)
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') store.flushPendingSave()
}
function onPageHide() {
  store.flushPendingSave()
}

function reload() {
  location.reload()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  await store.init()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', onPageHide)
})
</script>
