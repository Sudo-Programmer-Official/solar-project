<template>
  <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="field-label">Next Best Action</p>
        <h3 class="mt-1 text-base font-semibold text-slate-900">{{ action.label }}</h3>
      </div>
      <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]" :class="toneClass">
        {{ action.priority }}
      </span>
    </div>
    <p class="mt-2 text-sm leading-6 text-slate-500">{{ action.reason }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { NextBestAction } from "@solar/contracts";

const props = defineProps<{ action: NextBestAction }>();

const toneClass = computed(() => {
  switch (props.action.tone) {
    case "sales":
      return "bg-primary-50 text-primary-700 border border-primary-200";
    case "recovery":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "ops":
      return "bg-slate-100 text-slate-700 border border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
});
</script>
