<template>
  <div class="page-surface p-6 text-center">
    <p class="text-base font-semibold text-slate-900">{{ title }}</p>
    <p class="mt-2 text-sm leading-6 text-slate-500">{{ message }}</p>
    <button v-if="actionLabel" class="touch-target mt-5 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; message: string; actionLabel?: string }>();
defineEmits<{ action: [] }>();
</script>
