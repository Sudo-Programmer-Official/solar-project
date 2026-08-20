<template>
  <span class="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ label: string }>();
</script>
