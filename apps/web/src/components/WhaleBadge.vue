<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em]"
    :class="isWhale ? 'border-whale-200 bg-whale-50 text-whale-600' : label ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'"
  >
    <span>{{ isWhale ? "🐋" : label ? "◌" : "Solar" }}</span>
    <span>{{ label ?? (isWhale ? "Whale" : "Lead") }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ isWhale: boolean; label?: string }>();
</script>
