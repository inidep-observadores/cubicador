<template>
  <!-- Respaldos: exportar/importar .sqlite y copias automáticas del navegador -->
  <div class="space-y-2 text-xs">
    <p v-if="store.storagePersisted === true" class="text-emerald-400/90 text-[11px]">
      ✓ El navegador conserva los datos de forma persistente.
    </p>
    <p v-else class="text-amber-300 text-[11px]">
      ⚠ El navegador podría borrar los datos si falta espacio o la app no se usa por un tiempo.
      Instalá la app y exportá respaldos .sqlite con frecuencia.
    </p>

    <p class="text-slate-400 text-[11px]">
      Almacenamiento:
      <span v-if="store.storageBackend === 'opfs'" class="text-slate-200">archivo SQLite del navegador (OPFS)</span>
      <span v-else class="text-amber-300" title="Este navegador no admite OPFS en segundo plano: la base se guarda completa en IndexedDB después de cada cambio">memoria + IndexedDB (modo compatible)</span>
    </p>

    <p class="text-[11px]" :class="exportOverdue ? 'text-amber-300' : 'text-slate-400'">
      Último archivo exportado: {{ lastExportLabel }}
    </p>

    <div class="flex gap-2">
      <button
        @click="store.exportDatabase()"
        class="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg py-2 font-medium transition"
      >
        <Download class="w-3.5 h-3.5 text-emerald-400" />
        Exportar .sqlite
      </button>
      <button
        @click="fileInput?.click()"
        class="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg py-2 font-medium transition"
        title="Reemplazar la base actual por un archivo .sqlite exportado antes"
      >
        <Upload class="w-3.5 h-3.5 text-sky-400" />
        Importar .sqlite
      </button>
      <input ref="fileInput" type="file" accept=".sqlite,.sqlite3,.db,application/x-sqlite3,application/vnd.sqlite3" class="hidden" @change="onImportFile" />
    </div>

    <p class="text-slate-500 text-[11px] pt-1">
      Copias automáticas: se guardan dentro de este navegador y sirven para volver atrás, pero no reemplazan un archivo exportado.
    </p>

    <div v-if="store.backups.length === 0" class="text-slate-500 italic py-2">Todavía no hay copias.</div>
    <ul v-else class="space-y-1" :class="{ 'max-h-64 overflow-y-auto': scrollList }">
      <li
        v-for="c in store.backups"
        :key="c.id"
        class="flex items-center justify-between gap-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5"
      >
        <div class="min-w-0">
          <div class="font-mono text-slate-200">{{ formatDate(c.fecha) }}</div>
          <div class="text-[10px] text-slate-500 truncate">{{ c.motivo }} · {{ formatSize(c.tamano) }}</div>
        </div>
        <button
          @click="restore(c.id)"
          class="shrink-0 text-[11px] text-sky-300 hover:text-white hover:bg-slate-700 px-2 py-1.5 rounded transition"
        >
          Restaurar
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Download, Upload } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editorStore'
import { useExportStatus } from '../services/exportStatus'

defineProps({
  // En el menú desplegable del escritorio la lista tiene su propio scroll
  scrollList: { type: Boolean, default: false }
})
const emit = defineEmits(['done'])

const store = useEditorStore()
const { exportOverdue, lastExportLabel } = useExportStatus()

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function restore(id) {
  emit('done')
  await store.restoreBackup(id)
}

const fileInput = ref(null)

async function onImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // permitir volver a elegir el mismo archivo
  if (!file) return
  emit('done')
  await store.importDatabase(file)
}
</script>
