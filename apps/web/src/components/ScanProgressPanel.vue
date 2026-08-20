<template>
  <section class="page-surface p-4" :class="panelClasses">
    <div class="flex items-start gap-3">
      <div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border" :class="iconClasses">
        <el-icon v-if="!error" class="animate-spin" :size="18">
          <Loading />
        </el-icon>
        <span v-else class="text-base font-semibold">!</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="field-label">{{ error ? "Scan failed" : `Scanning ${locationLabel}` }}</p>
        <h3 class="mt-2 text-lg font-semibold text-slate-900">{{ title }}</h3>
        <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>

        <div v-if="!error" class="mt-4 space-y-3">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Strong leads</span>
              <strong class="mt-1 block text-slate-900">{{ countLabel }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Properties found</span>
              <strong class="mt-1 block text-slate-900">{{ discoveredCount || "--" }}</strong>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-3">
            <div class="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Solar analysis</span>
              <span v-if="shouldShowAnalysisLabel">{{ analysisLabel }}</span>
            </div>
            <div v-if="hasSolarProgress" class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-primary-400 transition-[width]" :style="{ width: progressWidth }" />
            </div>
            <p class="mt-2 text-xs leading-5 text-slate-500">{{ progressHint }}</p>
          </div>
        </div>

        <div v-else class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p>We couldn't finish this scan.</p>
          <button
            class="mt-3 touch-target rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm"
            type="button"
            @click="emit('retry')"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DiscoveryScanStatus } from "@solar/contracts";
import { ElIcon } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import { formatSolarAnalysisProgress } from "../utils/scanProgress";

const emit = defineEmits<{
  retry: [];
}>();

const props = withDefaults(defineProps<{
  locationLabel: string;
  stage: DiscoveryScanStatus | null;
  isScanning?: boolean;
  isComplete?: boolean;
  discoveredCount?: number;
  strongLeadCount?: number;
  solarAnalyzedCount?: number;
  solarAnalysisTarget?: number;
  error?: string | null;
}>(), {
  isScanning: false,
  isComplete: false,
  discoveredCount: 0,
  strongLeadCount: 0,
  solarAnalyzedCount: 0,
  solarAnalysisTarget: 0,
  error: null,
});

const stageLabel = computed(() => {
  switch (props.stage) {
    case "DISCOVERING":
      return "Finding properties nearby…";
    case "PRE_RANKING":
      return "Ranking the best opportunities…";
    case "SOLAR_ANALYSIS":
      return "Analyzing solar potential…";
    case "FINAL_RANKING":
      return "Preparing your best leads…";
    case "COMPLETE":
      return "Scan complete";
    case "FAILED":
    case "DISCOVERY_FAILED":
      return "Scan failed";
    case "DATA_COVERAGE_UNAVAILABLE":
      return "Property data unavailable";
    default:
      return props.isScanning ? "Scanning nearby homes…" : "Ready to scan";
  }
});

const subtitle = computed(() => {
  if (props.error) {
    return props.error;
  }
  if (props.stage === "DATA_COVERAGE_UNAVAILABLE") {
    return "Property data isn’t available for this area yet.";
  }
  if (props.isComplete) {
    return `${props.strongLeadCount} strong leads found`;
  }
  if (!props.isScanning) {
    return "Choose a location and scan a radius to rank opportunities.";
  }
  if (props.stage === "DISCOVERING") {
    return "Finding residential properties nearby.";
  }
  if (props.stage === "PRE_RANKING") {
    return "Scoring likely solar candidates.";
  }
  if (props.stage === "SOLAR_ANALYSIS") {
    return "Some leads may appear now while analysis continues.";
  }
  if (props.stage === "FINAL_RANKING") {
    return "Preparing your best leads.";
  }
  return "More results may appear as the scan continues.";
});

const countLabel = computed(() => {
  if (props.isComplete) {
    return `${props.strongLeadCount} strong leads found`;
  }
  return `${props.strongLeadCount} strong leads found so far`;
});

const hasSolarProgress = computed(() => props.solarAnalysisTarget > 0);
const shouldShowAnalysisLabel = computed(
  () => props.solarAnalyzedCount > 0 || hasSolarProgress.value || props.isComplete,
);
const analysisLabel = computed(() => formatSolarAnalysisProgress(props.solarAnalyzedCount, props.solarAnalysisTarget));
const progressWidth = computed(() => {
  if (!hasSolarProgress.value) return "0%";
  const ratio = Math.min(100, Math.max(0, (props.solarAnalyzedCount / props.solarAnalysisTarget) * 100));
  return `${ratio}%`;
});
const progressHint = computed(() => {
  if (props.isComplete) {
    if (props.strongLeadCount === 0) {
      if (props.solarAnalysisTarget === 0 && props.discoveredCount > 0) {
        return "No candidates met the current solar capacity filter.";
      }
      return `${props.discoveredCount} properties were checked in this area.`;
    }
    return `${analysisLabel.value} completed.`;
  }
  if (props.stage === "DATA_COVERAGE_UNAVAILABLE") {
    return "Try a different location or widen the radius.";
  }
  if (!props.isScanning) {
    return "No scan is running.";
  }
  if (props.solarAnalyzedCount > 0 || hasSolarProgress.value) {
    return analysisLabel.value;
  }
  return "More results may appear while discovery continues.";
});

const panelClasses = computed(() => {
  if (props.error) return "border-rose-200 bg-rose-50/70";
  if (props.isComplete) return "border-emerald-200 bg-emerald-50/60";
  return "border-slate-200";
});

const iconClasses = computed(() => {
  if (props.error) return "border-rose-200 bg-rose-100 text-rose-600";
  if (props.isComplete) return "border-emerald-200 bg-emerald-100 text-emerald-600";
  return "border-primary-200 bg-primary-50 text-primary-500";
});

const title = computed(() => stageLabel.value);
</script>
