<template>
  <div class="flex items-center gap-3">
    <div class="grid h-14 w-14 place-items-center rounded-2xl border border-whale-200 bg-whale-50 text-lg font-bold text-whale-600 shadow-sm">
      {{ score }}
    </div>
    <div>
      <p class="field-label">Opportunity</p>
      <p class="field-value text-base text-slate-900">{{ label }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ score: number }>();

const label = computed(() => `${props.score}/100`);
</script>
