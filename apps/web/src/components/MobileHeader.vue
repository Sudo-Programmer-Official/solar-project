<template>
  <header class="px-4 pb-4 pt-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="field-label">{{ eyebrow }}</p>
        <h1 class="mt-2 text-[30px] font-semibold tracking-tight text-slate-900">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{{ subtitle }}</p>
      </div>
      <slot name="action" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; subtitle?: string }>();
</script>
