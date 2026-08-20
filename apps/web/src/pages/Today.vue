<template>
  <main class="px-4 pb-4">
    <MobileHeader eyebrow="SolarScout" title="Today's Best Leads" subtitle="One shared context.">
      <template #action>
        <DataQualityBadge :label="syncLabel" :tone="syncTone" />
      </template>
    </MobileHeader>

    <section class="page-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">Current context</p>
          <p class="mt-1 text-lg font-semibold text-slate-900">{{ searchContextStore.contextLabel || "Choose a location" }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ summaryLabel }}</p>
        </div>
        <button
          class="touch-target rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          :disabled="loading"
          @click="reload"
        >
          {{ loading ? "Refreshing..." : "Refresh" }}
        </button>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Potential whales</span>
          <strong class="mt-1 block text-slate-900">{{ summary.whales }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Large opportunities</span>
          <strong class="mt-1 block text-slate-900">{{ summary.large }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Roof-permit leads</span>
          <strong class="mt-1 block text-slate-900">{{ summary.permits }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Revisits</span>
          <strong class="mt-1 block text-slate-900">{{ summary.revisits }}</strong>
        </div>
      </div>
    </section>

    <section v-if="progressVisible" class="mt-4 page-surface p-4">
      <p class="field-label">Scanning {{ scanLocationLabel }}</p>
      <h3 class="mt-2 text-lg font-semibold text-slate-900">{{ progressTitle }}</h3>
      <p class="mt-1 text-sm text-slate-500">{{ progressSubtitle }}</p>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Strong leads</span>
          <strong class="mt-1 block text-slate-900">{{ scanProgressLeadCount }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Solar analyzed</span>
          <strong class="mt-1 block text-slate-900">{{ analyzedProgressLabel }}</strong>
        </div>
      </div>
    </section>

    <section class="mt-4 grid gap-4">
      <LoadingCard v-if="loading && results.length === 0" />
      <EmptyState
        v-else-if="results.length === 0"
        :title="emptyStateTitle"
        :message="emptyStateMessage"
        action-label="Refresh"
        @action="reload"
      />

      <LeadCard
        v-for="lead in results"
        :key="lead.propertyId ?? lead.id"
        :lead="lead"
        :selected="selectedIds.has(lead.propertyId ?? lead.id)"
        @navigate="navigateToLead(lead)"
        @toggle="toggleLead(lead)"
        @open="openLead(lead)"
      />
    </section>

    <section v-if="results.length > 0" class="mt-4 page-surface p-4 text-center">
      <p class="text-sm font-semibold text-slate-900">{{ loadedResultsLabel }}</p>
      <p v-if="scanResultsHasMore" class="mt-1 text-sm text-slate-500">
        More leads remain in this scan.
      </p>
      <p v-else-if="nextRadiusSuggestion" class="mt-1 text-sm text-slate-500">
        All leads in this {{ searchContextStore.radiusMiles }} mi scan are loaded. Expand to {{ nextRadiusSuggestion }} mi.
      </p>
      <button
        v-if="scanResultsHasMore"
        class="mt-4 touch-target w-full rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm disabled:opacity-50"
        :disabled="scanResultsLoading"
        @click="loadMore"
      >
        {{ scanResultsLoading ? "Loading..." : "Load 20 more" }}
      </button>
      <button
        v-else-if="nextRadiusSuggestion"
        class="mt-4 touch-target w-full rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
        @click="expandRadius"
      >
        Expand to {{ nextRadiusSuggestion }} mi
      </button>
      <p v-else class="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        All available leads loaded
      </p>
    </section>

    <div v-if="selectedIds.size > 0" class="sticky bottom-24 mt-4">
      <div class="page-surface mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div>
          <p class="text-sm font-semibold text-slate-900">{{ selectedIds.size }} selected</p>
          <p class="text-xs text-slate-500">Create a simple walking route.</p>
        </div>
        <button class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50" :disabled="routeLoading" @click="createRoute">
          {{ routeLoading ? "Building..." : "Build Route" }}
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useHuntStore } from "../stores/hunt.store";
import { useSearchContextStore } from "../stores/search-context.store";
import MobileHeader from "../components/MobileHeader.vue";
import LeadCard from "../components/LeadCard.vue";
import LoadingCard from "../components/LoadingCard.vue";
import EmptyState from "../components/EmptyState.vue";
import DataQualityBadge from "../components/DataQualityBadge.vue";
import { useLeadActions } from "../composables/useLeadActions";

const router = useRouter();
const hunt = useHuntStore();
const searchContextStore = useSearchContextStore();
const { openDirections } = useLeadActions();
const {
  scanResults: results,
  loading,
  scanProgress,
  scanResultsTotal,
  scanResultsHasMore,
  scanResultsLoading,
  selectedPropertyIds,
  routeLoading,
} = storeToRefs(hunt);

const syncLabel = computed(() => (hunt.error ? "Offline" : "Live"));
const syncTone = computed(() => (hunt.error ? "danger" : "good"));

const summary = computed(() => ({
  whales: results.value.filter((lead) => lead.whaleScore >= 60).length,
  large: results.value.filter((lead) => (lead.maxRoofSolarCapacityKw ?? 0) >= 15).length,
  permits: results.value.filter((lead) => lead.reasons.some((reason) => reason.toLowerCase().includes("permit"))).length,
  revisits: results.value.filter((lead) => lead.outcome === "NOT_HOME" || lead.outcome === "BILL_REQUESTED").length,
}));

const progressVisible = computed(() => Boolean(scanProgress.value || loading.value));
const scanLocationLabel = computed(() => searchContextStore.contextLabel || "selected location");
const summaryLabel = computed(() => {
  if (loading.value && results.value.length === 0) {
    return "Scanning the current context.";
  }
  if (scanProgress.value?.status === "DATA_COVERAGE_UNAVAILABLE") {
    return "Property data isn’t available for this area yet.";
  }
  if (scanProgress.value?.status === "DISCOVERY_FAILED") {
    return "We couldn’t complete this scan.";
  }
  const total = scanResultsTotal.value || scanProgress.value?.metrics.resultsFound || results.value.length;
  return total > 0 ? `${results.value.length} of ${total} leads loaded` : "Pick a location, then scan a radius to rank opportunities.";
});
const progressTitle = computed(() => {
  if (!scanProgress.value) return "Ready to scan";
  if (scanProgress.value.status === "DISCOVERY_FAILED") return "Scan failed";
  if (scanProgress.value.status === "DISCOVERING") return "Finding properties";
  if (scanProgress.value.status === "PRE_RANKING") return "Ranking opportunities";
  if (scanProgress.value.status === "SOLAR_ANALYSIS") return "Analyzing solar";
  if (scanProgress.value.status === "FINAL_RANKING") return "Building final lead list";
  if (scanProgress.value.status === "DATA_COVERAGE_UNAVAILABLE") return "Property data unavailable";
  return "Scan complete";
});
const progressSubtitle = computed(() => {
  if (!scanProgress.value) return "Choose a location and scan a radius to rank opportunities.";
  if (scanProgress.value.status === "DISCOVERY_FAILED") return "Provider discovery failed. Try again.";
  if (scanProgress.value.status === "DISCOVERING") return "Finding residential properties nearby.";
  if (scanProgress.value.status === "PRE_RANKING") return "Scoring likely solar candidates.";
  if (scanProgress.value.status === "SOLAR_ANALYSIS") {
    return `Analyzing solar ${scanProgress.value.metrics.solarAnalyzedCount} / ${scanProgress.value.metrics.prequalifiedCount}`;
  }
  if (scanProgress.value.status === "DATA_COVERAGE_UNAVAILABLE") return "Property data isn’t available for this area yet.";
  return results.value.length > 0 ? `${results.value.length} strong leads found` : "No strong leads found yet.";
});
const scanProgressLeadCount = computed(() => scanProgress.value?.metrics.resultsFound ?? results.value.length ?? 0);
const analyzedProgressLabel = computed(() => {
  if (!scanProgress.value) return "--";
  return `${scanProgress.value.metrics.solarAnalyzedCount} / ${scanProgress.value.metrics.prequalifiedCount}`;
});
const loadedResultsLabel = computed(() => {
  const total = scanResultsTotal.value || scanProgress.value?.metrics.resultsFound || results.value.length;
  return total > 0 ? `${results.value.length} of ${total} leads loaded` : "No leads loaded yet";
});
const nextRadiusSuggestion = computed<10 | 20 | null>(() => {
  if (searchContextStore.radiusMiles === 5) return 10;
  if (searchContextStore.radiusMiles === 10) return 20;
  return null;
});
const emptyStateTitle = computed(() =>
  searchContextStore.context ? "No discovered leads in this area yet" : "Choose a location first",
);
const emptyStateMessage = computed(() =>
  searchContextStore.context
    ? "This location has no ranked properties in the current dataset. Try a different area or widen the search radius."
    : "Pick a location and then scan a radius to rank opportunities.",
);

function reload() {
  if (!searchContextStore.context) {
    return;
  }
  void hunt.runScan({
    latitude: searchContextStore.context.latitude,
    longitude: searchContextStore.context.longitude,
  });
}

function loadMore() {
  void hunt.loadMoreResults();
}

const selectedIds = computed(() => new Set(selectedPropertyIds.value));

function toggleLead(lead: { propertyId?: string | null; id: string }) {
  hunt.selectLead(lead.propertyId ?? lead.id);
}

function createRoute() {
  void hunt.generateRoute();
}

function expandRadius() {
  if (!searchContextStore.context || nextRadiusSuggestion.value == null) {
    return;
  }
  searchContextStore.setRadiusMiles(nextRadiusSuggestion.value);
  void hunt.runScan({
    latitude: searchContextStore.context.latitude,
    longitude: searchContextStore.context.longitude,
  });
}

function navigateToLead(lead: { latitude?: number | null; longitude?: number | null; address: string; propertyId?: string | null }) {
  if (lead.latitude != null && lead.longitude != null) {
    openDirections(lead.latitude, lead.longitude);
    return;
  }
  const id = lead.propertyId ?? encodeURIComponent(lead.address);
  router.push(`/properties/${id}`);
}

function openLead(lead: { propertyId?: string | null; address: string }) {
  const id = lead.propertyId ?? encodeURIComponent(lead.address);
  router.push(`/properties/${id}`);
}
</script>
