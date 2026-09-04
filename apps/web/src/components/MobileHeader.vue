<template>
  <header class="px-4 pb-4 pt-4">
    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <p class="field-label">{{ eyebrow }}</p>
        <h1 class="mt-2 text-[30px] font-semibold tracking-tight text-slate-900">{{ title }}</h1>
        <p v-if="subtitle" class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{{ subtitle }}</p>
      </div>
      <div class="shrink-0 self-start sm:pt-1">
        <slot name="action" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ eyebrow: string; title: string; subtitle?: string }>();
</script>
