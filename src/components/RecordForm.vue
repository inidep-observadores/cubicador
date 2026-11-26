<template>
  <div
    v-if="store.recordForm"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
    @mousedown.self="close"
  >
    <form
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-form-title"
      class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-3 select-text"
      @submit.prevent="save"
      @keydown.esc.prevent="close"
    >
      <h2 id="record-form-title" class="text-base font-bold text-slate-100">{{ title }}</h2>

      <label class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Nombre *</span>
        <input ref="nameRef" v-model="data.nombre" type="text" :placeholder="isBuque ? 'B/P …' : 'Pozo N° 2 Estribor'" :class="FIELD" />
      </label>

      <template v-if="isBuque">
        <label class="block space-y-1">
          <span class="text-xs font-medium text-slate-400">Factor de captura (t/m³) *</span>
          <DecimalInput v-model="data.factor" :min="0.001" :step="0.01" :class="FIELD" />
          <span class="block text-[11px] text-slate-500">Toneladas de captura por m³ de pozo. Se usa para estimar la capacidad de todos los pozos de este buque.</span>
        </label>
      </template>

      <label v-else class="block space-y-1">
        <span class="text-xs font-medium text-slate-400">Notas</span>
        <textarea v-model="data.notas" rows="3" :class="FIELD"></textarea>
      </label>

      <p v-if="error" class="text-xs text-rose-400">{{ error }}</p>

      <div class="flex items-center gap-2 pt-1">
        <button
          v-if="store.recordForm.id"
          type="button"
          @click="remove"
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-300 border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/60 transition"
        >
          <Trash2 class="w-4 h-4" />
          Eliminar
        </button>
        <div class="flex-1"></div>
        <button type="button" @click="close" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition">
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="!data.nombre.trim() || saving"
          class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ store.recordForm.id ? 'Guardar' : 'Crear' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { useEditorStore, DENSIDAD_POR_DEFECTO } from '../stores/editorStore'
import DecimalInput from './DecimalInput.vue'

/** Alta, edición y baja de buques y pozos (según `store.recordForm`). */
const FIELD = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500'

const store = useEditorStore()
const nameRef = ref(null)
const saving = ref(false)
const error = ref('')
const data = reactive({ nombre: '', factor: DENSIDAD_POR_DEFECTO / 1000, notas: '' })

const isBuque = computed(() => store.recordForm?.tipo === 'buque')
const title = computed(() => {
  const what = isBuque.value ? 'buque' : 'pozo'
  return store.recordForm?.id ? `Editar ${what}` : `Nuevo ${what}`
})

// Cargar los datos del registro cada vez que se abre el formulario
watch(() => store.recordForm, async form => {
  if (!form) return
  const list = form.tipo === 'buque' ? store.buques : store.pozos
  const record = list.find(r => r.id === form.id)
  Object.assign(data, {
    nombre: record?.nombre ?? (form.tipo === 'pozo' ? `Pozo N° ${store.pozos.length + 1}` : ''),
    factor: (record?.densidad_estiba || DENSIDAD_POR_DEFECTO) / 1000,
    notas: record?.notas ?? ''
  })
  error.value = ''
  saving.value = false
  await nextTick()
  nameRef.value?.focus()
  nameRef.value?.select()
})

function close() {
  store.closeRecordForm()
}

async function save() {
  if (!data.nombre.trim() || saving.value) return
  const { id } = store.recordForm
  saving.value = true
  try {
    if (isBuque.value) {
      await store.saveBuque(id, {
        nombre: data.nombre,
        densidad_estiba: Math.round(data.factor * 1000 * 1000) / 1000 // t/m³ → kg/m³
      })
    } else {
      await store.savePozo(id, { nombre: data.nombre, notas: data.notas })
    }
    close()
  } catch (err) {
    error.value = `No se pudo guardar: ${err.message || err}`
    saving.value = false
  }
}

async function remove() {
  const { id } = store.recordForm
  try {
    const deleted = isBuque.value ? await store.deleteBuque(id) : await store.deletePozo(id)
    if (deleted) close()
  } catch (err) {
    error.value = `No se pudo eliminar: ${err.message || err}`
  }
}
</script>
