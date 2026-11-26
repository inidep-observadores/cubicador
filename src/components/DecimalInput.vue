<template>
  <!--
    Es un campo de texto y no type="number": en ese tipo cada navegador decide qué
    separador decimal acepta, y no se puede escribir la coma desde el código.
  -->
  <input
    type="text"
    :inputmode="min !== undefined && min >= 0 ? 'decimal' : 'text'"
    autocomplete="off"
    spellcheck="false"
    :value="text"
    :title="invalid ? 'Valor inválido: no se aplicó' : undefined"
    :aria-invalid="invalid"
    :class="{ '!border-rose-500': invalid }"
    class="select-text"
    @input="onInput($event.target.value)"
    @keydown="onKeyDown"
    @blur="reset"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import { parseDecimal, formatDecimal } from '../services/decimal'

/**
 * Mientras se escribe solo se aplican valores válidos; un valor vacío, no
 * numérico o menor al mínimo marca el campo en rojo y no se emite. Al salir del
 * campo vuelve el último valor válido.
 */
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: undefined },
  step: { type: Number, default: 1 }
})
const emit = defineEmits(['update:modelValue'])

const text = ref(formatDecimal(props.modelValue))
const invalid = ref(false)

const isAllowed = v => v !== null && (props.min === undefined || v >= props.min)

function reset() {
  text.value = formatDecimal(props.modelValue)
  invalid.value = false
}

// Cambios hechos desde afuera (gizmo, deshacer, otro campo, otra pieza).
// Si el texto ya representa el valor, se respeta lo escrito ("2," o "2,50").
watch(() => props.modelValue, value => {
  const current = parseDecimal(text.value)
  if (current === null || Math.abs(current - value) > 1e-4) reset()
})

function onInput(value) {
  text.value = value
  const n = parseDecimal(value)
  invalid.value = !isAllowed(n)
  if (!invalid.value) emit('update:modelValue', n)
}

function onKeyDown(event) {
  const input = event.target

  // El punto del teclado numérico escribe la coma decimal. Se comprueba `key`
  // porque con Bloq Num apagado la misma tecla es Supr.
  if (event.code === 'NumpadDecimal' && (event.key === '.' || event.key === 'Decimal')) {
    event.preventDefault()
    input.setRangeText(',', input.selectionStart, input.selectionEnd, 'end')
    onInput(input.value)
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    const base = parseDecimal(text.value) ?? props.modelValue
    let next = base + (event.key === 'ArrowUp' ? props.step : -props.step)
    if (props.min !== undefined) next = Math.max(props.min, next)
    onInput(formatDecimal(next))
  } else if (event.key === 'Enter' || event.key === 'Escape') {
    input.blur()
  }
}
</script>
