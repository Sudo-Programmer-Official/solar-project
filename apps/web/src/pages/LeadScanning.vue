<template>
  <main data-testid="lead-scanning-page" class="px-4 pb-28">
    <MobileHeader
      eyebrow="LABS · LEAD FINDER"
      title="Lead scanning"
      subtitle="New leads appear here as soon as they are discovered and ranked."
    >
      <template #action>
        <RouterLink
          to="/labs/lead-finder"
          class="inline-flex min-h-touch items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
        >
          Back to finder
        </RouterLink>
      </template>
    </MobileHeader>

    <section class="page-surface overflow-hidden border-cyan-100 bg-[linear-gradient(135deg,#ffffff_0%,#f0fbff_100%)] p-5 shadow-card sm:p-6">
      <div class="flex items-start gap-4">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
          :class="statusIconClasses"
          aria-hidden="true"
        >
          <svg v-if="hunt.isScanning" class="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" class="opacity-20" stroke="currentColor" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" class="opacity-90" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
          </svg>
          <span v-else class="text-lg font-bold">{{ hasError ? "!" : hunt.isComplete ? "✓" : "•" }}</span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="field-label">{{ statusLabel }}</p>
            <span class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" :class="statusBadgeClasses">
              {{ statusBadgeLabel }}
            </span>
          </div>
          <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{{ stageTitle }}</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{{ stageDescription }}</p>

          <div class="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
            <div class="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Solar analysis</span>
              <span v-if="solarAnalysisTarget > 0 || hunt.isComplete">{{ solarProgressLabel }}</span>
            </div>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" :class="!hasSolarProgress && hunt.isScanning ? 'scan-progress-indeterminate' : ''">
              <div class="h-full rounded-full bg-primary-400 transition-[width]" :style="{ width: progressWidth }" />
            </div>
            <p class="mt-2 text-xs leading-5 text-slate-500">{{ progressHint }}</p>
          </div>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div class="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200/70 sm:p-4">
          <span class="block text-xs text-slate-500">Strong leads</span>
          <strong class="mt-1 block text-xl font-semibold text-slate-950 sm:text-2xl">{{ strongLeadCount }}</strong>
        </div>
        <div class="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200/70 sm:p-4">
          <span class="block text-xs text-slate-500">Properties found</span>
          <strong class="mt-1 block text-xl font-semibold text-slate-950 sm:text-2xl">{{ discoveredCount || "--" }}</strong>
        </div>
        <div class="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200/70 sm:p-4">
          <span class="block text-xs text-slate-500">Solar analyzed</span>
          <strong class="mt-1 block text-xl font-semibold text-slate-950 sm:text-2xl">{{ solarAnalyzedCount }}</strong>
        </div>
      </div>
    </section>

    <section class="mt-4 page-surface p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">Scanning location</p>
          <h2 class="mt-2 text-lg font-semibold text-slate-950">{{ locationLabel }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ radiusLabel }} · {{ filterLabel }}</p>
        </div>
        <span class="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:inline-flex">
          {{ loadedLabel }}
        </span>
      </div>
    </section>

    <section v-if="hunt.scan || hunt.isScanning || swipeDeckResults.length > 0" class="mt-4 md:hidden">
      <SwipeHuntDeck
        :lead="swipeDeckLead"
        :preload-leads="swipeDeckResults.slice(1, 3)"
        :review-label="swipeReviewLabel"
        :saved-count="swipeSavedCount"
        :remaining-count="swipeRemainingCount"
        :has-more="scanResultsHasMore"
        :loading-more="scanResultsLoading"
        :is-scanning="hunt.isScanning"
        :empty-title="emptyStateTitle"
        :empty-message="emptyStateMessage"
        :next-radius-suggestion="nextRadiusSuggestion"
        @save="saveCurrentSwipeLead"
        @skip="skipCurrentSwipeLead"
        @navigate="navigateCurrentSwipeLead"
        @open="openCurrentSwipeLead"
        @build-route="buildRouteFromSaved"
        @load-more="loadMore"
        @expand-radius="expandRadius"
      />
    </section>

    <section v-if="results.length > 0 || hunt.isScanning" class="mt-4">
      <div class="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <p class="field-label">Pulled leads</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Live pipeline</h2>
        </div>
        <span class="text-sm font-semibold text-slate-500">{{ loadedLabel }}</span>
      </div>

      <div class="grid gap-3">
        <article
          v-for="lead in results"
          :key="lead.propertyId ?? lead.id"
          class="page-surface border-slate-200/90 p-4 transition hover:border-cyan-200 hover:shadow-md"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{{ lead.opportunityScore }} opportunity</span>
                <span v-if="lead.whaleScore >= 60" class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Whale candidate</span>
              </div>
              <h3 class="mt-3 truncate text-base font-semibold text-slate-950 sm:text-lg">{{ leadTitle(lead) }}</h3>
              <p class="mt-1 truncate text-sm text-slate-500">{{ leadLocation(lead) }} · {{ distanceLabel(lead.distanceMiles) }}</p>
            </div>
            <button
              class="inline-flex min-h-touch shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700"
              type="button"
              @click="openLead(lead)"
            >
              Open
            </button>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div class="rounded-xl bg-slate-50 p-3">
              <span class="block text-xs text-slate-500">System potential</span>
              <strong class="mt-1 block text-slate-950">{{ formatNumber(lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw) }} kW</strong>
            </div>
            <div class="rounded-xl bg-slate-50 p-3">
              <span class="block text-xs text-slate-500">Confidence</span>
              <strong class="mt-1 block text-slate-950">{{ lead.confidence }}%</strong>
            </div>
            <div class="col-span-2 rounded-xl bg-slate-50 p-3 sm:col-span-1">
              <span class="block text-xs text-slate-500">Next action</span>
              <strong class="mt-1 block truncate text-slate-950">{{ lead.nextBestAction.label }}</strong>
            </div>
          </div>
        </article>

        <template v-if="hunt.isScanning">
          <div v-for="item in skeletonCount" :key="`lead-scanning-skeleton-${item}`" class="page-surface animate-pulse p-4" aria-hidden="true">
            <div class="flex items-start justify-between gap-3">
              <div class="w-full space-y-3">
                <div class="h-5 w-32 rounded-full bg-slate-100" />
                <div class="h-5 w-56 max-w-full rounded-full bg-slate-100" />
                <div class="h-4 w-40 rounded-full bg-slate-100" />
              </div>
              <div class="h-11 w-16 shrink-0 rounded-xl bg-slate-100" />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div v-for="metric in 3" :key="metric" class="h-16 rounded-xl bg-slate-50" />
            </div>
          </div>
        </template>
      </div>
    </section>

    <section v-else class="mt-4 page-surface p-6 text-center">
      <p class="text-base font-semibold text-slate-950">No scan is running</p>
      <p class="mt-2 text-sm leading-6 text-slate-500">Start a scan to pull ranked solar opportunities into this pipeline.</p>
      <button
        class="mt-5 min-h-touch rounded-2xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        :disabled="startingScan"
        @click="startScan"
      >
        {{ startingScan ? "Starting scan…" : "Start scan" }}
      </button>
    </section>

    <section v-if="hasError" class="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm">
      <p class="text-sm font-semibold">The scan could not finish.</p>
      <p class="mt-1 text-sm text-rose-700">{{ errorMessage }}</p>
      <button class="mt-4 min-h-touch rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm" type="button" @click="startScan">
        Retry scan
      </button>
    </section>

    <section v-if="hunt.isTerminal && !hasError" class="mt-4 page-surface flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p class="text-sm font-semibold text-slate-950">{{ hunt.isComplete ? "Scan complete" : "Scan completed with warnings" }}</p>
        <p class="mt-1 text-sm text-slate-500">{{ results.length > 0 ? "Your pulled leads are ready for review." : "Try another location or adjust the filters." }}</p>
      </div>
      <RouterLink to="/labs/lead-finder" class="inline-flex min-h-touch items-center rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-600">
        Review pipeline
      </RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useRouter } from "vue-router";
import type { DiscoveryScanLead } from "@solar/contracts";
import { ElNotification } from "element-plus";
import MobileHeader from "../components/MobileHeader.vue";
import { useLeadActions } from "../composables/useLeadActions";
import { useHuntStore } from "../stores/hunt.store";
import { useSearchContextStore } from "../stores/search-context.store";
import { formatSolarAnalysisProgress } from "../utils/scanProgress";
import SwipeHuntDeck from "../components/SwipeHuntDeck.vue";

const router = useRouter();
const hunt = useHuntStore();
const searchStore = useSearchContextStore();
const { openDirections } = useLeadActions();
const startingScan = ref(false);

const results = computed(() => hunt.scanResults);
const swipeDeckResults = computed(() => hunt.swipeDeckResults);
const swipeDeckLead = computed(() => hunt.swipeDeckLead);
const swipeReviewLabel = computed(() => hunt.swipeReviewLabel);
const swipeSavedCount = computed(() => hunt.swipeSavedCount);
const swipeRemainingCount = computed(() => hunt.swipeRemainingCount);
const locationLabel = computed(() => searchStore.contextLabel || hunt.scan?.currentLocation || "selected location");
const radiusLabel = computed(() => `${searchStore.radiusMiles} mi radius`);
const filterLabel = computed(() => searchStore.filterCount > 0 ? `${searchStore.filterCount} filters active` : "all filters");
const discoveredCount = computed(() => hunt.discoveredCount);
const strongLeadCount = computed(() => hunt.strongLeadCount);
const solarAnalyzedCount = computed(() => hunt.solarAnalyzedCount);
const solarAnalysisTarget = computed(() => hunt.solarAnalysisTarget);
const loadedLabel = computed(() => {
  const total = hunt.scanResultsTotal || strongLeadCount.value || results.value.length;
  return total > 0 ? `${results.value.length} of ${total} loaded` : "Waiting for leads";
});
const hasError = computed(() => Boolean(hunt.error || hunt.scan?.error || hunt.scanStatus === "FAILED" || hunt.scanStatus === "DISCOVERY_FAILED"));
const errorMessage = computed(() => hunt.error || hunt.scan?.error?.message || "We couldn't finish this scan.");
const statusLabel = computed(() => {
  if (hasError.value) return "Scan failed";
  if (hunt.isScanning) return `Scanning ${locationLabel.value}`;
  if (hunt.scanStatus === "PARTIAL") return "Scan completed with warnings";
  if (hunt.isComplete) return "Scan complete";
  return "Ready to scan";
});
const statusBadgeLabel = computed(() => {
  if (hasError.value) return "Action needed";
  if (hunt.isScanning) return "Live";
  if (hunt.isComplete) return "Ready";
  return "Idle";
});
const statusBadgeClasses = computed(() => {
  if (hasError.value) return "bg-rose-100 text-rose-700";
  if (hunt.isScanning) return "bg-cyan-100 text-cyan-700";
  if (hunt.isComplete) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
});
const statusIconClasses = computed(() => {
  if (hasError.value) return "border-rose-200 bg-rose-100 text-rose-600";
  if (hunt.isScanning) return "border-cyan-200 bg-cyan-50 text-cyan-600";
  if (hunt.isComplete) return "border-emerald-200 bg-emerald-100 text-emerald-600";
  return "border-slate-200 bg-slate-50 text-slate-500";
});
const stageTitle = computed(() => {
  switch (hunt.scanStatus) {
    case "DISCOVERING": return "Finding properties nearby…";
    case "PRE_RANKING": return "Ranking the best opportunities…";
    case "SOLAR_ANALYSIS": return "Analyzing solar potential…";
    case "FINAL_RANKING": return "Preparing your best leads…";
    case "COMPLETE": return "Your leads are ready";
    case "PARTIAL": return "Available leads are ready";
    case "DATA_COVERAGE_UNAVAILABLE": return "Property data is unavailable";
    case "FAILED":
    case "DISCOVERY_FAILED": return "Scan needs attention";
    default: return hunt.isScanning ? "Scanning nearby homes…" : "Ready to pull leads";
  }
});
const stageDescription = computed(() => {
  if (hasError.value) return errorMessage.value;
  if (hunt.isComplete) return `${strongLeadCount.value} strong leads found for ${locationLabel.value}.`;
  if (hunt.scanStatus === "PARTIAL") return "The scan finished with limited data. Review what was found and retry if needed.";
  if (hunt.scanStatus === "DATA_COVERAGE_UNAVAILABLE") return "Try a different location or widen the search radius.";
  if (hunt.scanStatus === "SOLAR_ANALYSIS") return "Some leads may appear now while analysis continues.";
  if (hunt.scanStatus === "PRE_RANKING") return "Scoring likely solar candidates.";
  if (hunt.scanStatus === "DISCOVERING") return "Finding residential properties nearby.";
  return hunt.isScanning ? "More results may appear as the scan continues." : "Choose a location and start a scan to rank opportunities.";
});
const solarProgressLabel = computed(() => formatSolarAnalysisProgress(solarAnalyzedCount.value, solarAnalysisTarget.value));
const hasSolarProgress = computed(() => solarAnalysisTarget.value > 0);
const progressWidth = computed(() => {
  if (!hasSolarProgress.value) return hunt.isScanning ? "42%" : "0%";
  return `${Math.min(100, Math.max(0, (solarAnalyzedCount.value / solarAnalysisTarget.value) * 100))}%`;
});
const progressHint = computed(() => {
  if (hunt.isComplete) return `${solarProgressLabel.value} completed.`;
  if (hunt.scanStatus === "PARTIAL") return "The scan finished with limited data.";
  if (solarAnalyzedCount.value > 0 || hasSolarProgress.value) return solarProgressLabel.value;
  return "More results may appear while discovery continues.";
});
const skeletonCount = computed(() => results.value.length === 0 ? 2 : 1);
const nextRadiusSuggestion = computed<10 | 20 | null>(() => {
  if (hunt.radiusMiles === 5) return 10;
  if (hunt.radiusMiles === 10) return 20;
  return null;
});
const emptyStateTitle = computed(() => searchStore.context ? "No leads match these filters." : "Choose a location first");
const emptyStateMessage = computed(() => searchStore.context ? `We checked ${discoveredCount.value} properties in this area.` : "Pick a location and then scan a radius to rank opportunities.");
const scanResultsHasMore = computed(() => hunt.scanResultsHasMore);
const scanResultsLoading = computed(() => hunt.scanResultsLoading);
const savedLeadIds = computed(() => results.value.filter((lead) => lead.outcome === "SAVED").map((lead) => lead.propertyId ?? lead.id));

async function startScan() {
  if (startingScan.value || hunt.isScanning) return;
  await searchStore.initializeDefaultContext();
  const context = searchStore.context;
  if (!context) {
    await router.push("/labs/lead-finder");
    return;
  }
  startingScan.value = true;
  try {
    await hunt.runScan({ latitude: context.latitude, longitude: context.longitude }, {
      radiusMiles: searchStore.radiusMiles,
      filters: searchStore.filters,
    });
  } finally {
    startingScan.value = false;
  }
}

async function saveCurrentSwipeLead() {
  const lead = swipeDeckLead.value;
  if (!lead) return;
  await hunt.setLeadDisposition(lead.propertyId ?? lead.id, "SAVED");
  showSwipeUndoToast("Lead saved");
}

async function skipCurrentSwipeLead() {
  const lead = swipeDeckLead.value;
  if (!lead) return;
  await hunt.setLeadDisposition(lead.propertyId ?? lead.id, "SKIPPED");
  showSwipeUndoToast("Lead skipped");
}

function navigateCurrentSwipeLead() {
  const lead = swipeDeckLead.value;
  if (lead) navigateLead(lead);
}

function openCurrentSwipeLead() {
  const lead = swipeDeckLead.value;
  if (lead) openLead(lead);
}

async function buildRouteFromSaved() {
  if (savedLeadIds.value.length === 0) return;
  await hunt.generateRoute(savedLeadIds.value);
  await router.push("/labs/route");
}

async function loadMore() {
  await hunt.loadMoreResults();
}

async function expandRadius() {
  if (!nextRadiusSuggestion.value || !searchStore.context) return;
  hunt.setRadius(nextRadiusSuggestion.value);
  searchStore.setRadiusMiles(nextRadiusSuggestion.value);
  await hunt.runScan({ latitude: searchStore.context.latitude, longitude: searchStore.context.longitude }, {
    radiusMiles: nextRadiusSuggestion.value,
    filters: searchStore.filters,
  });
}

function showSwipeUndoToast(title: string) {
  const notification = ElNotification({
    title,
    message: h(
      "button",
      {
        type: "button",
        class: "mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-primary-200 hover:text-primary-600",
        onClick: async () => {
          try {
            await hunt.undoLastSwipeDisposition();
          } finally {
            notification.close();
          }
        },
      },
      "Undo",
    ),
    duration: 3500,
    position: "top-right",
  });
}

function openLead(lead: DiscoveryScanLead) {
  void router.push(`/properties/${encodeURIComponent(lead.propertyId ?? lead.id)}`);
}

function navigateLead(lead: DiscoveryScanLead) {
  if (lead.latitude != null && lead.longitude != null) {
    openDirections(lead.latitude, lead.longitude);
    return;
  }
  openLead(lead);
}

function leadTitle(lead: DiscoveryScanLead) {
  return lead.address?.split(",")[0]?.trim() || "Address unavailable";
}

function leadLocation(lead: DiscoveryScanLead) {
  return [lead.city, lead.state, lead.postalCode].filter(Boolean).join(", ") || "Location unavailable";
}

function distanceLabel(distance: number | null | undefined) {
  return distance == null ? "distance unknown" : `${distance.toFixed(1)} mi`;
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "--" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
</script>

<style scoped>
.scan-progress-indeterminate > div {
  width: 42% !important;
  animation: scan-progress 1.35s ease-in-out infinite;
}

@keyframes scan-progress {
  0% { transform: translateX(-120%); }
  55% { transform: translateX(130%); }
  100% { transform: translateX(260%); }
}
</style>
