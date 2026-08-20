<template>
  <main class="px-4 pb-4">
    <MobileHeader eyebrow="WHALE HUNTER" title="Scan Around Me" subtitle="One shared search and filter system." />

    <section class="page-surface p-4">
      <p class="field-label">Current context</p>
      <h2 class="mt-2 text-lg font-semibold text-slate-900">{{ searchContextStore.contextLabel || "Choose a location" }}</h2>
      <div class="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
        <span>{{ searchStoreRadiusLabel }}</span>
        <span v-if="searchContextStore.context?.type === 'PROPERTY'">Property search</span>
        <span v-else>Area search</span>
      </div>
      <p class="mt-3 text-sm text-slate-500">
        Use the top search bar to change location and filters.
      </p>
    </section>

    <section v-if="showSwipeDeck" class="mt-4 md:hidden">
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

    <template v-else>
    <section class="mt-4 page-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="field-label">Ranked results</p>
          <p class="mt-1 text-sm text-slate-500">{{ summaryLabel }}</p>
        </div>
        <button class="touch-target rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm" :disabled="hunt.isScanning" @click="runScan">
          {{ hunt.isScanning ? "Scanning..." : "Rescan" }}
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
      <p class="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {{ discoveredCount }} properties checked · {{ strongLeadCount }} strong leads · {{ solarAnalyzedCount }} solar analyses
      </p>
    </section>

    <section v-if="clusters.length > 0" class="mt-4 grid gap-3">
      <article v-for="cluster in clusters" :key="cluster.key" class="page-surface p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="field-label">Cluster</p>
            <h3 class="mt-2 text-lg font-semibold text-slate-900">{{ cluster.label }}</h3>
            <p class="mt-1 text-sm text-slate-500">{{ cluster.count }} high-priority properties in this area</p>
          </div>
          <button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold tracking-[0.08em] text-slate-600 shadow-sm" @click="viewCluster(cluster.key)">
            View Cluster
          </button>
        </div>
      </article>
    </section>

    <section v-if="currentView === 'map'" class="mt-4 grid gap-4">
      <LeadCardSkeleton v-if="hunt.isScanning && results.length === 0" />
      <div v-else-if="showLoadMismatch" class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">Lead cards failed to load.</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">The scan found strong leads, but the results page did not return any cards.</p>
        <button class="touch-target mt-5 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm" @click="runScan">
          Retry scan
        </button>
      </div>
      <div v-else-if="showZeroLeadState" class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">{{ emptyStateTitle }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ emptyStateMessage }}</p>
        <div class="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            v-if="suggestedLowerCapacity != null"
            class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
            @click="lowerCapacityAndRescan"
          >
            Try {{ suggestedLowerCapacity }}+ kW
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="clearFiltersAndRescan">
            Clear filters
          </button>
        </div>
      </div>
      <div v-else-if="showClusterEmptyState" class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">No cards in this cluster.</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">Clear the cluster selection to view all {{ strongLeadCount }} leads.</p>
        <button class="touch-target mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="clearClusterFilter">
          Show all leads
        </button>
      </div>
      <EmptyState
        v-else-if="results.length === 0 && !hunt.isScanning"
        :title="emptyStateTitle"
        :message="emptyStateMessage"
        action-label="Find Best Doors"
        @action="runScan"
      />
      <section v-else class="page-surface p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="field-label">Map view</p>
            <p class="mt-1 text-sm text-slate-500">{{ mapSubtitle }}</p>
          </div>
          <button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold tracking-[0.08em] text-slate-600 shadow-sm" @click="recenterMap">
            Recenter
          </button>
        </div>
        <PropertyVisual
          class="mt-4"
          mode="map"
          :center-latitude="currentLatitude ?? mapCenterLatitude"
          :center-longitude="currentLongitude ?? mapCenterLongitude"
          :points="mapPoints"
          :title="selectedLeadTitle || 'Ranked leads'"
          :subtitle="selectedLead ? selectedLeadSummary : 'Tap a pin to inspect a lead.'"
          provider-label="Ranked pins"
          @point-click="selectPin"
        />
        <div class="mt-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ selectedCount }} selected</p>
            <p class="text-xs text-slate-500">Use the route bar below to build the walk.</p>
          </div>
        </div>
      </section>
    </section>

    <section v-else class="mt-4 grid gap-4">
      <template v-if="hunt.isScanning && results.length === 0">
        <LeadCardSkeleton v-for="item in skeletonCount" :key="`lead-skeleton-${item}`" />
      </template>
      <div v-else-if="showLoadMismatch" class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">Lead cards failed to load.</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">The scan found strong leads, but the results page did not return any cards.</p>
        <button class="touch-target mt-5 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm" @click="runScan">
          Retry scan
        </button>
      </div>
      <div v-else-if="showZeroLeadState" class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">{{ emptyStateTitle }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ emptyStateMessage }}</p>
        <div class="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            v-if="suggestedLowerCapacity != null"
            class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
            @click="lowerCapacityAndRescan"
          >
            Try {{ suggestedLowerCapacity }}+ kW
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="clearFiltersAndRescan">
            Clear filters
          </button>
        </div>
      </div>
      <div v-else-if="showClusterEmptyState" class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">No cards in this cluster.</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">Clear the cluster selection to view all {{ strongLeadCount }} leads.</p>
        <button class="touch-target mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="clearClusterFilter">
          Show all leads
        </button>
      </div>
      <EmptyState
        v-else-if="results.length === 0 && !hunt.isScanning"
        :title="emptyStateTitle"
        :message="emptyStateMessage"
        action-label="Find Best Doors"
        @action="runScan"
      />
      <template v-if="visibleResults.length > 0">
        <LeadCard
          v-for="lead in visibleResults"
          :key="lead.id"
          :lead="lead"
          :selected="selectedIds.has(lead.propertyId ?? lead.id)"
          @navigate="navigateToLead(lead)"
          @toggle="toggleLead(lead)"
          @open="openLead(lead)"
        />
      </template>
      <template v-if="hunt.isScanning && results.length > 0">
        <LeadCardSkeleton v-for="item in skeletonCount" :key="`lead-skeleton-inline-${item}`" />
      </template>
      <div v-if="hunt.isScanning" class="page-surface flex items-center gap-3 p-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
          <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" class="opacity-20" stroke="currentColor" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" class="opacity-90" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-900">Still analyzing nearby homes</p>
          <p class="mt-1 text-sm text-slate-500">More results may appear.</p>
        </div>
      </div>
      <div v-if="hunt.isComplete && results.length > 0" class="page-surface p-4 text-center">
        <p class="text-sm font-semibold text-slate-900">{{ loadedResultsLabel }}</p>
        <p v-if="scanResultsHasMore" class="mt-1 text-sm text-slate-500">
          More leads remain in this scan.
        </p>
        <p v-else-if="nextRadiusSuggestion" class="mt-1 text-sm text-slate-500">
          All leads in this {{ hunt.radiusMiles }} mi scan are loaded. Expand to {{ nextRadiusSuggestion }} mi.
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
      </div>
    </section>

    <div v-if="selectedIds.size > 0" class="sticky bottom-24 mt-4">
      <div class="page-surface mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div>
          <p class="text-sm font-semibold text-slate-900">{{ selectedIds.size }} selected</p>
          <p class="text-xs text-slate-500">Create a simple walking route.</p>
        </div>
        <button class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50" :disabled="selectedIds.size === 0 || routeLoading" @click="createRoute">
          {{ routeLoading ? "Building..." : "Add to Route" }}
        </button>
      </div>
    </div>

    <div v-if="selectedCluster || selectedLead" class="fixed inset-x-0 bottom-20 z-40 px-4">
      <div class="page-surface mx-auto max-w-md p-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="field-label">{{ selectedCluster ? "Cluster" : "Selected pin" }}</p>
            <h3 class="mt-2 text-lg font-semibold text-slate-900">
              {{ selectedCluster ? selectedCluster.label : selectedLeadTitle }}
            </h3>
            <p class="mt-1 text-sm text-slate-500">
              {{ selectedCluster ? `${selectedCluster.count} high-priority properties in this area` : formatLocationLabel(selectedLead?.city, selectedLead?.state, selectedLead?.postalCode) }}
            </p>
          </div>
          <button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold tracking-[0.08em] text-slate-600 shadow-sm" @click="selectedPinId = null">
            Close
          </button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Opportunity</span>
            <strong class="mt-1 block text-slate-900">{{ selectedLead?.opportunityScore ?? "--" }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">System potential</span>
            <strong class="mt-1 block text-slate-900">{{ formatNumber(selectedLead?.maxRoofSolarCapacityKw) }} kW</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Distance</span>
            <strong class="mt-1 block text-slate-900">{{ formatDistance(selectedLead?.distanceMiles) }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Next action</span>
            <strong class="mt-1 block text-slate-900">{{ selectedLead?.nextBestAction.label ?? "VIEW CLUSTER" }}</strong>
          </div>
        </div>

        <div v-if="selectedCluster" class="mt-4 rounded-2xl bg-slate-50 p-3">
          <p class="field-label">Cluster members</p>
          <div class="mt-2 space-y-2">
            <p v-for="lead in selectedCluster.leads.slice(0, 3)" :key="lead.propertyId ?? lead.id" class="text-sm text-slate-600">
              {{ formatLeadTitle(lead.address, lead.city, lead.state, lead.postalCode) }} · {{ formatDistance(lead.distanceMiles) }}
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-2">
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="navigateSelected">
            Navigate
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="toggleSelected">
            {{ selectedIds.has(selectedLeadKey) ? "Remove" : "Add to Route" }}
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="openLead(selectedLead)">
            Open
          </button>
        </div>
      </div>
    </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { ElNotification } from "element-plus";
import type { DiscoveryScanLead, LocationResolveResponse } from "@solar/contracts";
import { useCurrentLocation } from "../composables/useCurrentLocation";
import { useLeadActions } from "../composables/useLeadActions";
import { useHuntStore } from "../stores/hunt.store";
import { useSearchContextStore } from "../stores/search-context.store";
import { resolveLocation } from "../services/api";
import PropertyVisual, { type PropertyVisualPoint } from "./PropertyVisual.vue";
import LeadCard from "./LeadCard.vue";
import LoadingCard from "./LoadingCard.vue";
import EmptyState from "./EmptyState.vue";
import MobileHeader from "./MobileHeader.vue";
import LeadCardSkeleton from "./LeadCardSkeleton.vue";
import SwipeHuntDeck from "./SwipeHuntDeck.vue";
import { formatSolarAnalysisProgress } from "../utils/scanProgress";

const props = withDefaults(defineProps<{
  initialView?: "list" | "map";
}>(), {
  initialView: "list",
});

const route = useRoute();
const router = useRouter();
const hunt = useHuntStore();
const searchContextStore = useSearchContextStore();
const currentLocation = useCurrentLocation();
const { openDirections } = useLeadActions();
const { scanResults, loading, routeLoading, scanProgress, scanResultsTotal, scanResultsHasMore, scanResultsLoading, swipeDeckLead, swipeDeckResults, swipeReviewLabel, swipeSavedCount, swipeRemainingCount } = storeToRefs(hunt);
const isSwipeHuntMode = computed(() => router.currentRoute.value.path === "/hunt");
const isMobileViewport = ref(false);
const mobileViewMode = computed(() => (typeof route.query.view === "string" ? route.query.view : null));
const showSwipeDeck = computed(() => isSwipeHuntMode.value && isMobileViewport.value && mobileViewMode.value !== "list");
const currentView = ref<"list" | "map">(props.initialView);
const selectedPinId = ref<string | null>(null);
const activeClusterKey = ref<string | null>(null);
const locationQuery = ref("");
const resolvedLocation = ref<LocationResolveResponse | null>(null);
const resolvingLocation = ref(false);
const locationError = ref<string | null>(null);
const recentSearches = ref<string[]>([]);
const fallback = { latitude: 40.2108, longitude: -79.7665 };

const radii = [5, 10, 20] as const;
const capacityOptions = [
  { label: "12+ kW", value: 12 },
  { label: "15+ kW", value: 15 },
  { label: "20+ kW", value: 20 },
] as const;
const booleanFilters = [
  { key: "whaleCandidates", label: "Whale candidates" },
  { key: "largeProperties", label: "Large properties" },
  { key: "recentRoofPermits", label: "Recent roof permits" },
  { key: "highValueAreas", label: "High-value areas" },
  { key: "noDetectedExistingSolar", label: "No detected solar" },
  { key: "revisits", label: "Revisits" },
  { key: "lowSolarSaturation", label: "Low solar saturation" },
] as const;

const results = computed(() => scanResults.value);
const selectedIds = computed(() => new Set(hunt.selectedPropertyIds));
const selectedCount = computed(() => selectedIds.value.size);
const scan = computed(() => hunt.scan);
const scanStatus = computed(() => hunt.scanStatus);
const discoveredCount = computed(() => hunt.discoveredCount);
const strongLeadCount = computed(() => hunt.strongLeadCount);
const solarAnalyzedCount = computed(() => hunt.solarAnalyzedCount);
const solarAnalysisTarget = computed(() => hunt.solarAnalysisTarget);
const skeletonCount = computed(() => (results.value.length === 0 ? 3 : 2));
const searchStoreRadiusLabel = computed(() => `${searchContextStore.radiusMiles} mi radius`);
const currentLatitude = computed(() => resolvedLocation.value?.latitude ?? hunt.lastLatitude ?? null);
const currentLongitude = computed(() => resolvedLocation.value?.longitude ?? hunt.lastLongitude ?? null);
const canScan = computed(() => resolvedLocation.value != null);
const summary = computed(() => ({
  whales: results.value.filter((lead) => lead.whaleScore >= 60).length,
  large: results.value.filter((lead) => (lead.maxRoofSolarCapacityKw ?? 0) >= 15).length,
  permits: results.value.filter((lead) => lead.reasons.some((reason) => reason.toLowerCase().includes("permit"))).length,
  revisits: results.value.filter((lead) => lead.outcome === "REVISIT" || lead.outcome === "NOT_HOME" || lead.outcome === "BILL_REQUESTED").length,
}));
const summaryLabel = computed(() => {
  if (!scanStatus.value && !hunt.isScanning) return "Pick a location, then scan a radius to rank opportunities.";
  if (scanStatus.value === "DATA_COVERAGE_UNAVAILABLE") {
    return "Property data isn’t available for this area yet.";
  }
  if (scanStatus.value === "DISCOVERY_FAILED" || scanStatus.value === "FAILED") {
    return "We couldn’t complete this scan.";
  }
  if (scanStatus.value === "DISCOVERING") {
    return "Finding properties";
  }
  if (scanStatus.value === "PRE_RANKING") {
    return "Ranking opportunities";
  }
  if (scanStatus.value === "SOLAR_ANALYSIS") {
    return formatSolarAnalysisProgress(solarAnalyzedCount.value, solarAnalysisTarget.value);
  }
  if (scanStatus.value === "FINAL_RANKING") {
    return "Building your best leads";
  }
  if (hunt.isComplete && strongLeadCount.value === 0) {
    return "No leads match these filters.";
  }
  if (!hunt.isComplete) {
    return `${strongLeadCount.value} strong leads found so far`;
  }
  return `${strongLeadCount.value} strong leads loaded`;
});
const loadedResultsLabel = computed(() => {
  const total = scanResultsTotal.value || strongLeadCount.value || results.value.length;
  if (total <= 0) {
    return "No leads loaded yet";
  }
  return `${results.value.length} of ${total} leads loaded`;
});
const nextRadiusSuggestion = computed<10 | 20 | null>(() => {
  if (hunt.radiusMiles === 5) return 10;
  if (hunt.radiusMiles === 10) return 20;
  return null;
});
const emptyStateTitle = computed(() =>
  searchContextStore.context ? "No leads match these filters." : "Choose a location first",
);
const emptyStateMessage = computed(() =>
  searchContextStore.context
    ? `We checked ${discoveredCount.value} properties in this area.`
    : "Pick a location and then scan a radius to rank opportunities.",
);
const suggestedLowerCapacity = computed<12 | 15 | null>(() => {
  if (searchContextStore.filters.minimumSystemKw === 20) return 15;
  if (searchContextStore.filters.minimumSystemKw === 15) return 12;
  return null;
});
const showLoadMismatch = computed(() => hunt.isComplete && strongLeadCount.value > 0 && !scanResultsLoading.value && results.value.length === 0);
const showZeroLeadState = computed(() => hunt.isComplete && strongLeadCount.value === 0 && !showLoadMismatch.value);
const showClusterEmptyState = computed(() => hunt.isComplete && results.value.length > 0 && visibleResults.value.length === 0 && !showLoadMismatch.value && !showZeroLeadState.value);
const visibleResults = computed(() => {
  if (!activeClusterKey.value) return results.value;
  return results.value.filter((lead) => clusterKeyForLead(lead) === activeClusterKey.value);
});
const selectedLead = computed(() => {
  if (!selectedPinId.value) return null;
  return results.value.find((lead) => (lead.propertyId ?? lead.id) === selectedPinId.value) ?? selectedCluster.value?.leads[0] ?? null;
});
const selectedCluster = computed(() => clusters.value.find((cluster) => cluster.key === selectedPinId.value) ?? null);
const selectedLeadKey = computed(() => selectedLead.value?.propertyId ?? selectedLead.value?.id ?? "");
const selectedLeadSummary = computed(() => {
  if (!selectedLead.value) return "Tap a pin to inspect a lead.";
  return `Opportunity ${selectedLead.value.opportunityScore} · ${selectedLead.value.nextBestAction.label}`;
});
const savedLeadIds = computed(() =>
  results.value.filter((lead) => lead.outcome === "SAVED").map((lead) => lead.propertyId ?? lead.id),
);
const selectedLeadTitle = computed(() =>
  formatLeadTitle(selectedLead.value?.address, selectedLead.value?.city, selectedLead.value?.state, selectedLead.value?.postalCode),
);
const mapSubtitle = computed(() => `${results.value.length} ranked leads · ${clusters.value.length} dense clusters`);
const mapCenterLatitude = computed(() => currentLatitude.value ?? fallback.latitude);
const mapCenterLongitude = computed(() => currentLongitude.value ?? fallback.longitude);

const clusters = computed(() => {
  const groups = new Map<string, { key: string; label: string; count: number; leads: DiscoveryScanLead[] }>();
  for (const lead of results.value) {
    if ((lead.opportunityScore ?? 0) < 70 && (lead.whaleScore ?? 0) < 60) continue;
    const key = clusterKeyForLead(lead);
    const current = groups.get(key) ?? {
      key,
      label: clusterLabelForLead(lead),
      count: 0,
      leads: [],
    };
    current.count += 1;
    current.leads.push(lead);
    groups.set(key, current);
  }
  return [...groups.values()].filter((cluster) => cluster.count > 1).sort((left, right) => right.count - left.count);
});

const mapPoints = computed<PropertyVisualPoint[]>(() => {
  const points: PropertyVisualPoint[] = [];
  if (currentLatitude.value != null && currentLongitude.value != null) {
    points.push({
      id: "current-location",
      latitude: currentLatitude.value,
      longitude: currentLongitude.value,
      kind: "current",
      tone: "blue",
      label: "You are here",
    });
  }

  const clustered = new Set<string>();
  for (const cluster of clusters.value) {
    const representative = cluster.leads[0];
    if (representative.latitude == null || representative.longitude == null) continue;
    clustered.add(cluster.key);
    points.push({
      id: cluster.key,
      latitude: representative.latitude,
      longitude: representative.longitude,
      kind: "cluster",
      tone: toneFromLead(representative),
      count: cluster.count,
      label: cluster.label,
    });
  }

  for (const lead of results.value) {
    if (lead.latitude == null || lead.longitude == null) continue;
    if (clustered.has(clusterKeyForLead(lead)) && clusterSizeForKey(clusterKeyForLead(lead)) > 1) {
      continue;
    }
    points.push({
      id: lead.propertyId ?? lead.id,
      latitude: lead.latitude,
      longitude: lead.longitude,
      kind: "lead",
      tone: toneFromLead(lead),
      label: formatLeadTitle(lead.address, lead.city, lead.state, lead.postalCode),
    });
  }
  return points;
});

onMounted(() => {
  loadRecentSearches();
  syncResolvedLocationFromContext();
  syncViewport();
  window.addEventListener("resize", syncViewport);
});

watch(
  () => route.query.view,
  (view) => {
    if (view === "map" || view === "list") {
      currentView.value = view;
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("resize", syncViewport);
});

watch(
  () => searchContextStore.context,
  () => {
    syncResolvedLocationFromContext();
  },
  { deep: true },
);

function loadRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem("solar.hunt.recentSearches");
    const parsed = stored ? JSON.parse(stored) : [];
    recentSearches.value = Array.isArray(parsed) ? (parsed as string[]).filter(Boolean).slice(0, 6) : [];
  } catch {
    recentSearches.value = [];
  }
}

function syncViewport() {
  if (typeof window === "undefined") {
    return;
  }
  isMobileViewport.value = window.innerWidth < 768;
}

function saveRecentSearches() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("solar.hunt.recentSearches", JSON.stringify(recentSearches.value.slice(0, 6)));
}

function rememberSearch(value: string) {
  recentSearches.value = [value, ...recentSearches.value.filter((item) => item !== value)].slice(0, 6);
  saveRecentSearches();
}

async function searchLocation() {
  const query = locationQuery.value.trim();
  if (!query) {
    locationError.value = "Enter a location to search.";
    return;
  }
  resolvingLocation.value = true;
  locationError.value = null;
  try {
    const resolved = await resolveLocation({ query });
    if (!resolved) {
      locationError.value = "Location not found";
      resolvedLocation.value = null;
      return;
    }
    resolvedLocation.value = resolved;
    rememberSearch(query);
  } catch (error) {
    locationError.value = error instanceof Error && error.message === "Geocoding unavailable" ? error.message : "Geocoding unavailable";
  } finally {
    resolvingLocation.value = false;
  }
}

async function useBrowserCurrentLocation() {
  locationError.value = null;
  await currentLocation.refresh();
  if (currentLocation.error.value) {
    locationError.value = currentLocation.error.value;
    resolvedLocation.value = null;
    return;
  }
  if (currentLocation.latitude.value == null || currentLocation.longitude.value == null) {
    locationError.value = "Permission denied for current location";
    return;
  }
  resolvedLocation.value = {
    type: "AREA",
    formattedAddress: "Current location",
    latitude: currentLocation.latitude.value,
    longitude: currentLocation.longitude.value,
    placeId: null,
    locationType: "UNKNOWN",
  };
}

function clearLocation() {
  resolvedLocation.value = null;
  locationError.value = null;
}

function applyRecentSearch(item: string) {
  locationQuery.value = item;
  void searchLocation();
}

function setRadius(radius: 5 | 10 | 20) {
  hunt.setRadius(radius);
  searchContextStore.setRadiusMiles(radius);
}

function booleanFilterActive(key: typeof booleanFilters[number]["key"]) {
  return Boolean(hunt.filters[key]);
}

function recenterMap() {
  activeClusterKey.value = null;
  selectedPinId.value = null;
}

function clearClusterFilter() {
  activeClusterKey.value = null;
}

async function lowerCapacityAndRescan() {
  if (suggestedLowerCapacity.value == null) {
    return;
  }
  searchContextStore.setMinimumSystemKw(suggestedLowerCapacity.value);
  await runScan();
}

async function clearFiltersAndRescan() {
  searchContextStore.resetFilters();
  await runScan();
}

async function runScan() {
  const context = searchContextStore.context;
  if (!resolvedLocation.value && !context) {
    locationError.value = "Choose a location first.";
    return;
  }
  const center = resolvedLocation.value ?? context;
  if (!center) {
    locationError.value = "Choose a location first.";
    return;
  }
  activeClusterKey.value = null;
  selectedPinId.value = null;
  currentView.value = "list";
  await hunt.runScan({
    latitude: center.latitude,
    longitude: center.longitude,
  });
}

async function loadMore() {
  await hunt.loadMoreResults();
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
  if (!lead) return;
  navigateToLead(lead);
}

function openCurrentSwipeLead() {
  const lead = swipeDeckLead.value;
  if (!lead) return;
  openLead(lead);
}

async function buildRouteFromSaved() {
  if (savedLeadIds.value.length === 0) {
    return;
  }
  await hunt.generateRoute(savedLeadIds.value);
  await router.push("/route");
}

async function expandRadius() {
  if (!nextRadiusSuggestion.value) {
    return;
  }
  setRadius(nextRadiusSuggestion.value);
  await runScan();
}

function syncResolvedLocationFromContext() {
  if (!searchContextStore.context) {
    return;
  }
  resolvedLocation.value = {
    type: searchContextStore.context.type,
    formattedAddress: searchContextStore.context.label,
    latitude: searchContextStore.context.latitude,
    longitude: searchContextStore.context.longitude,
    placeId: searchContextStore.context.placeId,
    locationType: "UNKNOWN",
  };
}

function toggleLead(lead: DiscoveryScanLead) {
  hunt.selectLead(lead.propertyId ?? lead.id);
}

function showSwipeUndoToast(title: string) {
  const notification = ElNotification({
    title,
    message: h(
      "button",
      {
        type: "button",
        class:
          "mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-primary-200 hover:text-primary-600",
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

function openLead(lead: DiscoveryScanLead | null) {
  if (!lead) return;
  const id = lead.propertyId ?? lead.id;
  void router.push(`/properties/${encodeURIComponent(id)}`);
}

function navigateToLead(lead: DiscoveryScanLead) {
  if (lead.latitude != null && lead.longitude != null) {
    openDirections(lead.latitude, lead.longitude);
    return;
  }
  openLead(lead);
}

function navigateSelected() {
  const lead = selectedLead.value ?? visibleResults.value[0] ?? null;
  if (!lead) return;
  navigateToLead(lead);
}

function toggleSelected() {
  if (!selectedLead.value) return;
  toggleLead(selectedLead.value);
}

async function createRoute() {
  await hunt.generateRoute();
  await router.push("/route");
}

function viewCluster(key: string) {
  activeClusterKey.value = key;
  currentView.value = "list";
}

function selectPin(id: string) {
  if (id === "current-location") {
    activeClusterKey.value = null;
    return;
  }
  selectedPinId.value = id;
}

function clusterKeyForLead(lead: DiscoveryScanLead) {
  return `${Math.round((lead.latitude ?? 0) * 100)}:${Math.round((lead.longitude ?? 0) * 100)}`;
}

function clusterSizeForKey(key: string) {
  return clusters.value.find((cluster) => cluster.key === key)?.count ?? 0;
}

function clusterLabelForLead(lead: DiscoveryScanLead) {
  const address = lead.address.split(",")[0];
  return address.length > 24 ? `${address.slice(0, 24).trim()}...` : address;
}

function formatLocationLabel(city?: string | null, state?: string | null, postalCode?: string | null) {
  const cleanCity = sanitizeText(city);
  const stateLabel = abbreviateState(state);
  const cleanPostalCode = sanitizeText(postalCode);
  const cityComponent = cleanCity && !isPlusCode(cleanCity) ? cleanCity : null;
  const line = cityComponent && stateLabel ? `${cityComponent}, ${stateLabel}${cleanPostalCode ? ` ${cleanPostalCode}` : ""}` : cityComponent ?? cleanPostalCode;
  return line || "Location unavailable";
}

function formatLeadTitle(address?: string | null, city?: string | null, state?: string | null, postalCode?: string | null) {
  const cleanAddress = sanitizeText(address);
  if (cleanAddress && !isPlusCode(cleanAddress)) {
    return cleanAddress;
  }
  const location = formatLocationLabel(city, state, postalCode);
  return location === "Location unavailable" ? "Address unavailable" : location;
}

function abbreviateState(state?: string | null) {
  if (!state) return null;
  const cleaned = state.trim().toUpperCase();
  const map: Record<string, string> = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };
  return map[cleaned] ?? cleaned;
}

function sanitizeText(value?: string | null) {
  const cleaned = value?.trim() ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

function isPlusCode(value: string) {
  return /(?:^|\s)[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s|$)/i.test(value);
}

function toneFromLead(lead: DiscoveryScanLead) {
  if (lead.outcome === "APPOINTMENT_BOOKED") return "purple";
  if (lead.outcome === "NOT_HOME") return "blue";
  if (lead.outcome === "BILL_REQUESTED" || lead.outcome === "BILL_RECEIVED") return "green";
  if (lead.whaleScore >= 60) return "gold";
  if ((lead.maxRoofSolarCapacityKw ?? 0) >= 15) return "green";
  return "gray";
}

function formatNumber(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDistance(value?: number | null) {
  if (value == null) return "Distance unknown";
  return `${value.toFixed(1)} mi away`;
}
</script>
