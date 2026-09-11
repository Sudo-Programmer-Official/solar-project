<template>
  <section v-if="metrics" class="page-surface border-cyan-100 bg-white/90 p-4 shadow-card sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="field-label">MARKET INTELLIGENCE</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-950">What this scan actually found</h2>
        <p class="mt-1 text-sm leading-6 text-slate-500">Coverage, validation, and solar opportunity stay separate from the lead pipeline.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-full px-3 py-1.5 text-xs font-semibold" :class="coverageClasses">
          {{ coverageLabel }}
        </span>
        <button
          class="touch-target inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
          type="button"
          :aria-expanded="isExpanded"
          aria-controls="market-intelligence-details"
          @click="isExpanded = !isExpanded"
        >
          {{ isExpanded ? "Hide details" : "Show details" }}
          <svg class="h-3.5 w-3.5 transition-transform" :class="isExpanded ? 'rotate-180' : ''" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
          </svg>
        </button>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div v-for="card in summaryCards" :key="card.label" class="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
        <span class="block text-xs text-slate-500">{{ card.label }}</span>
        <strong class="mt-1 block text-xl font-semibold text-slate-950">{{ card.value }}</strong>
      </div>
    </div>

    <div v-if="!isExpanded" class="mt-3 rounded-2xl bg-cyan-50/60 px-3 py-2 text-xs text-slate-600">
      Expand for candidate funnel, evidence freshness, market saturation, and coverage details.
    </div>

    <div v-show="isExpanded" id="market-intelligence-details" class="mt-4">
    <div class="rounded-2xl border border-slate-200 bg-white p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="field-label">CANDIDATE FUNNEL</p>
        <span class="text-xs font-semibold text-slate-500">{{ metrics.funnel.total }} candidates classified</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <div v-for="item in funnelItems" :key="item.label" class="rounded-xl bg-slate-50 px-3 py-2">
          <span class="block text-[11px] text-slate-500">{{ item.label }}</span>
          <strong class="mt-1 block text-sm text-slate-900">{{ item.value }}</strong>
        </div>
      </div>
    </div>

    <div v-if="scanMetrics" class="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/50 px-3 py-2 text-xs leading-5 text-slate-600">
      <span class="font-semibold text-slate-800">Evidence:</span>
      {{ scanMetrics.imageryFreshCount }} fresh · {{ scanMetrics.imageryAgingCount }} aging · {{ scanMetrics.imageryStaleCount }} stale · {{ scanMetrics.imageryUnknownCount }} unknown
      <span class="mx-1 text-slate-300">·</span>
      <span class="font-semibold text-slate-800">Analysis:</span>
      {{ scanMetrics.freshlyAnalyzedCount }} fresh · {{ scanMetrics.cachedAnalyzedCount }} cached · {{ scanMetrics.preliminaryOnlyCount }} preliminary
      <span class="mx-1 text-slate-300">·</span>
      <span class="font-semibold text-slate-800">Whales:</span>
      {{ scanMetrics.confirmedWhaleCount }} confirmed · {{ scanMetrics.potentialWhaleCount }} potential
      <span class="mx-1 text-slate-300">·</span>
      {{ scanMetrics.permitCreditCount }} verified permit signals
    </div>

    <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
      <span>{{ metrics.densePocketCount }} dense pockets</span>
      <span>{{ metrics.clusteredPropertyCount }} clustered · {{ metrics.isolatedPropertyCount }} isolated</span>
      <span>{{ metrics.neighborhoodSignals.nearbyStrongCount }} nearby strong signals</span>
      <span v-if="metrics.desiredWhaleCount != null">Goal: {{ metrics.desiredWhaleCount }} whales · found {{ metrics.whaleCount }}</span>
      <span v-if="metrics.saturation.untouchedPercent != null">{{ metrics.saturation.untouchedPercent }}% untouched</span>
      <span v-if="metrics.coverage.warning" class="text-amber-700">{{ metrics.coverage.warning }}</span>
    </div>
    <div class="mt-4 grid gap-3 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p class="field-label">CAPACITY BANDS</p>
        <div class="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
          <div><strong class="block text-sm text-slate-900">{{ metrics.capacityBands.standard }}</strong><span class="text-slate-500">&lt;15 kW</span></div>
          <div><strong class="block text-sm text-slate-900">{{ metrics.capacityBands.large }}</strong><span class="text-slate-500">15–19.9 kW</span></div>
          <div><strong class="block text-sm text-slate-900">{{ metrics.capacityBands.whale }}</strong><span class="text-slate-500">20–29.9 kW</span></div>
          <div><strong class="block text-sm text-slate-900">{{ metrics.capacityBands.megaWhale }}</strong><span class="text-slate-500">30+ kW</span></div>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p class="field-label">MARKET SATURATION</p>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>{{ metrics.saturation.discovered }} discovered</span>
          <span>{{ metrics.saturation.qualified }} qualified</span>
          <span>{{ metrics.saturation.knocked }} knocked</span>
          <span>{{ metrics.saturation.appointments }} appointments</span>
          <span>{{ metrics.saturation.closed }} closed</span>
        </div>
      </div>
    </div>
    <div v-if="diagnostics" class="mt-3 rounded-2xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
      Coverage cells: {{ diagnostics.processedCellCount ?? 0 }} processed / {{ diagnostics.coverageCellCount ?? 0 }} total · {{ diagnostics.remainingCellCount ?? 0 }} remaining · {{ diagnostics.coveragePercent ?? 0 }}% · neighbor checks at {{ diagnostics.neighborExpansion?.distancesMeters.join(" / ") ?? "50 / 100 / 200 / 300" }} m
    </div>
    <p v-if="metrics.desiredWhaleCount != null && metrics.whaleCount < metrics.desiredWhaleCount" class="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
      Only {{ metrics.whaleCount }} high-confidence whales qualified. Widen the radius or adjust the target to explore more market area; the scanner will not inflate this count.
    </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { DiscoveryDiagnostics, DiscoveryMarketMetrics, DiscoveryScanMetrics } from "@solar/contracts";

const props = defineProps<{
  metrics: DiscoveryMarketMetrics | null | undefined;
  diagnostics?: DiscoveryDiagnostics | null;
  scanMetrics?: DiscoveryScanMetrics | null;
}>();

const isExpanded = ref(false);
const metrics = computed(() => props.metrics ?? null);
const coverageLabel = computed(() => {
  if (!metrics.value) return "No coverage data";
  if (metrics.value.coverage.coveragePercent == null) return "Coverage unavailable";
  return `${metrics.value.coverage.coveragePercent}% area queried`;
});
const coverageClasses = computed(() => {
  if (!metrics.value || metrics.value.coverage.coveragePercent == null) return "bg-amber-50 text-amber-700";
  if (metrics.value.coverage.status === "PARTIAL") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
});
const summaryCards = computed(() => {
  const current = metrics.value;
  if (!current) return [];
  return [
    { label: "Discovered", value: current.discoveredPropertyCount },
    { label: "Verified", value: current.verifiedPropertyCount },
    { label: "Solar viable", value: current.solarViableCount },
    { label: "Whales", value: current.whaleCount },
  ];
});
const funnelItems = computed(() => {
  const funnel = metrics.value?.funnel;
  if (!funnel) return [];
  return [
    { label: "Viable", value: funnel.viable },
    { label: "Strong", value: funnel.strong },
    { label: "Whale", value: funnel.whale },
    { label: "Existing solar", value: funnel.existingSolar },
    { label: "Low solar", value: funnel.lowSolar },
    { label: "Unverified", value: funnel.unverified },
    { label: "Non-residential", value: funnel.nonResidential },
    { label: "No building", value: funnel.noBuilding },
    { label: "Bad address", value: funnel.badAddress },
    { label: "Duplicate", value: funnel.duplicate },
    { label: "Processing error", value: funnel.processingError },
  ];
});
</script>
