<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em]"
    :class="isWhale ? 'border-whale-200 bg-whale-50 text-whale-600' : 'border-slate-200 bg-slate-50 text-slate-500'"
  >
    <span>{{ isWhale ? "🐋" : "Solar" }}</span>
    <span>{{ isWhale ? "Whale" : "Lead" }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ isWhale: boolean }>();
</script>
