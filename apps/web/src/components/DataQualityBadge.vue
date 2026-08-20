<template>
  <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium" :class="classes">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ label: string; tone?: "good" | "warn" | "danger" | "muted" }>();

const classes = computed(() => {
  switch (props.tone) {
    case "good":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warn":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
});
</script>
