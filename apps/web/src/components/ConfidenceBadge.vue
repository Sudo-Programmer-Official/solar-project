<template>
  <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium" :class="classes">
    Confidence {{ confidence }}%
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ confidence: number }>();

const classes = computed(() => {
  if (props.confidence >= 70) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (props.confidence >= 45) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
});
</script>
