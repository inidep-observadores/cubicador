<template>
  <!-- 100dvh: en el teléfono descuenta la barra de direcciones del navegador -->
  <div class="h-[100dvh] w-full flex flex-col bg-slate-950 select-none overflow-hidden font-sans pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
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
      <div class="flex-1 min-h-0 flex relative overflow-hidden">
        <!-- Paleta Izquierda de Bloques (escritorio) -->
        <BlockCatalog v-if="!layout.isCompact" class="w-64 2xl:w-80 shrink-0 border-r border-slate-800 z-20" />

        <!-- Visor 3D Central -->
        <main class="flex-1 min-w-0 relative h-full">
          <Viewport3D />
          <!-- Sin pozo no hay dónde modelar: explicar cómo seguir -->
          <div v-if="!store.selectedPozoId" class="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-6 text-center">
            <div class="space-y-3 max-w-xs">
              <p class="text-sm text-slate-300">
                {{ store.selectedBuqueId ? 'Este buque todavía no tiene pozos.' : 'Todavía no hay ningún buque cargado.' }}
              </p>
              <button
                @click="store.openRecordForm(store.selectedBuqueId ? 'pozo' : 'buque')"
                class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                {{ store.selectedBuqueId ? 'Crear un pozo' : 'Crear un buque' }}
              </button>
            </div>
          </div>
          <HelpButton />
        </main>

        <!-- Inspector Derecho de Propiedades (escritorio) -->
        <PropertiesPanel v-if="!layout.isCompact" class="w-80 2xl:w-[21rem] shrink-0 border-l border-slate-800 z-20" />

        <!-- Modo compacto: los paneles se abren sobre el visor -->
        <template v-if="layout.isCompact && store.selectedPozoId">
          <PanelSheet v-if="layout.panel === 'catalogo'" title="Figuras" :icon="Shapes" side="left">
            <BlockCatalog embedded @added="closePanel()" />
          </PanelSheet>
          <PanelSheet v-else-if="layout.panel === 'componentes'" :title="`Piezas del pozo (${store.bloques.length})`" :icon="ListTree" side="left">
            <PropertiesPanel section="lista" @picked="openPanel('inspector')" />
          </PanelSheet>
          <PanelSheet v-else-if="layout.panel === 'inspector'" :title="inspectorTitle" :icon="Sliders" side="right">
            <PropertiesPanel section="editor" />
          </PanelSheet>
        </template>
        <PanelSheet v-if="layout.isCompact && layout.panel === 'menu'" title="Más opciones" :icon="Menu" side="right">
          <MoreMenu />
        </PanelSheet>
      </div>

      <!-- Barra inferior (modo compacto) -->
      <BottomNav v-if="layout.isCompact" />
    </template>

    <!-- Aviso de actualización automática -->
    <div
      v-if="appUpdate.status === 'actualizando'"
      role="status"
      class="fixed left-1/2 -translate-x-1/2 bottom-20 z-[70] flex items-center gap-2 bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-full shadow-2xl"
    >
      <RefreshCw class="w-4 h-4 animate-spin" />
      Actualizando a la nueva versión…
    </div>

    <!-- Alta y edición de buques y pozos -->
    <RecordForm />

    <!-- Diálogos de confirmación y avisos -->
    <ManualDialog />
    <AppDialog />
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { Shapes, ListTree, Sliders, Menu, RefreshCw } from 'lucide-vue-next'
import { useEditorStore } from './stores/editorStore'
import { layout, openPanel, closePanel } from './services/layout'
import { dialogState } from './services/dialog'
import { appUpdate, setupAutoUpdate } from './services/pwaUpdate'
import PanelSheet from './components/PanelSheet.vue'
import BottomNav from './components/BottomNav.vue'
import MoreMenu from './components/MoreMenu.vue'
import Toolbar from './components/Toolbar.vue'
import BlockCatalog from './components/BlockCatalog.vue'
import Viewport3D from './components/Viewport3D.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import AppDialog from './components/AppDialog.vue'
import ManualDialog from './components/ManualDialog.vue'
import HelpButton from './components/HelpButton.vue'
import RecordForm from './components/RecordForm.vue'

const store = useEditorStore()

const inspectorTitle = computed(() => store.selectedBlock ? `Editar: ${store.selectedBlock.nombre}` : 'Editar pieza')

// Actualización automática: solo en reposo y después de guardar lo pendiente
setupAutoUpdate({
  isIdle: () => !store.isLoading && !dialogState.open && !store.recordForm,
  beforeReload: () => store.flushPendingSave()
})

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
