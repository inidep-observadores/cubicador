<template>
  <!-- Cotas dibujadas sobre el visor: siempre se leen de frente y no tapan los toques -->
  <svg class="absolute inset-0 w-full h-full pointer-events-none overflow-hidden" aria-hidden="true">
    <g v-for="(s, i) in shapes" :key="i" :style="{ color: COLORS[s.kind] }">
      <line
        v-for="([p, q], j) in s.ext" :key="j"
        :x1="p.x" :y1="p.y" :x2="q.x" :y2="q.y"
        stroke="currentColor" stroke-width="1" stroke-opacity="0.45" :stroke-dasharray="s.kind === 'manual' ? '4 3' : null"
      />
      <line :x1="s.a.x" :y1="s.a.y" :x2="s.b.x" :y2="s.b.y" stroke="currentColor" stroke-width="1.3" />
      <polygon v-for="(points, j) in s.arrows" :key="'f' + j" :points="points" fill="currentColor" />
    </g>
    <!-- Los textos van encima de todas las líneas -->
    <text
      v-for="(s, i) in shapes" :key="'t' + i"
      :x="s.label.x" :y="s.label.y"
      :fill="COLORS[s.kind]"
      stroke="#0b0f19" stroke-width="4" stroke-linejoin="round" paint-order="stroke"
      text-anchor="middle" dominant-baseline="central"
      class="font-mono font-bold" :font-size="s.kind === 'parcial' ? 11 : 13"
    >{{ s.label.text }}</text>

    <!-- Puntos de la herramienta Medir -->
    <circle
      v-for="(m, i) in markers" :key="'m' + i"
      :cx="m.x" :cy="m.y" :r="m.type === 'superficie' ? 4 : 6"
      fill="none" stroke="#ffffff" stroke-width="2"
    />
  </svg>
</template>

<script setup>
defineProps({
  shapes: { type: Array, default: () => [] },
  markers: { type: Array, default: () => [] }
})

const COLORS = { total: '#fbbf24', parcial: '#fde68a', manual: '#34d399' }
</script>
