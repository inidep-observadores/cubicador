import { computed } from 'vue'
import { useEditorStore } from '../stores/editorStore'

const DAY_MS = 24 * 60 * 60 * 1000
const EXPORT_REMINDER_DAYS = 7

/** Antigüedad del último respaldo exportado y si conviene recordarlo. */
export function useExportStatus() {
  const store = useEditorStore()

  const exportAgeDays = computed(() =>
    store.lastExportAt ? Math.floor((Date.now() - store.lastExportAt) / DAY_MS) : null
  )
  const exportOverdue = computed(() =>
    exportAgeDays.value === null || exportAgeDays.value >= EXPORT_REMINDER_DAYS
  )
  const exportAgeLabel = computed(() =>
    exportAgeDays.value === null ? 'nunca' : `hace ${exportAgeDays.value} d`
  )
  const lastExportLabel = computed(() =>
    store.lastExportAt ? new Date(store.lastExportAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'
  )
  const exportTitle = computed(() => {
    const base = 'Descargar un respaldo con todos los datos (.cubi)'
    if (exportAgeDays.value === null) return `${base}. Todavía no se exportó ningún respaldo.`
    return `${base}. Último respaldo: ${lastExportLabel.value}.`
  })

  return { exportAgeDays, exportOverdue, exportAgeLabel, lastExportLabel, exportTitle }
}
