<template>
  <p class="text-[10px] text-slate-500 font-mono">
    Versión {{ version }} · {{ buildDate }}
    <span v-if="appUpdate.status === 'actualizando'" class="text-sky-400"> · actualizando…</span>
  </p>
</template>

<script setup>
import { appUpdate } from '../services/pwaUpdate'

/* global __APP_VERSION__, __BUILD_DATE__ */
const version = __APP_VERSION__
const buildDate = new Date(__BUILD_DATE__).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
</script>
