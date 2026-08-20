<template>
  <div class="rounded-2xl border p-3 shadow-sm" :class="toneClasses">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold tracking-[0.08em] text-slate-500">Location match</p>
        <p class="mt-1 text-sm font-semibold text-slate-900">{{ distanceLabel }}</p>
      </div>
      <span class="rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em]" :class="pillClasses">
        {{ statusLabel }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LocationVerificationSummary } from "@solar/contracts";

const props = defineProps<{
  verification?: LocationVerificationSummary | null;
}>();

const distanceLabel = computed(() => {
  if (props.verification?.distanceMeters == null) return "Location match: unknown";
  return `Location match: ${props.verification.distanceMeters} m`;
});

const statusLabel = computed(() => props.verification?.status ?? "UNKNOWN");

const toneClasses = computed(() => {
  switch (props.verification?.status) {
    case "VERIFIED":
      return "border-emerald-200 bg-emerald-50";
    case "REVIEW":
      return "border-amber-200 bg-amber-50";
    case "MISMATCH":
      return "border-rose-200 bg-rose-50";
    default:
      return "border-slate-200 bg-slate-50";
  }
});

const pillClasses = computed(() => {
  switch (props.verification?.status) {
    case "VERIFIED":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    case "REVIEW":
      return "border-amber-200 bg-amber-100 text-amber-700";
    case "MISMATCH":
      return "border-rose-200 bg-rose-100 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
});
</script>
