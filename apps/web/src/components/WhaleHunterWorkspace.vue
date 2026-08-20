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

    <section class="mt-4 page-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="field-label">Ranked results</p>
          <p class="mt-1 text-sm text-slate-500">{{ summaryLabel }}</p>
        </div>
        <button class="touch-target rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm" :disabled="loading" @click="runScan">
          {{ loading ? "Scanning..." : "Rescan" }}
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
        {{ scan?.analyzedCount ?? 0 }} analyzed · {{ scan?.candidateCount ?? 0 }} candidates · {{ scan?.googleSolarCalls ?? 0 }} Google Solar calls
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
      <LoadingCard v-if="loading && results.length === 0" />
      <EmptyState
        v-else-if="results.length === 0"
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
      <LoadingCard v-if="loading && results.length === 0" />
      <EmptyState
        v-else-if="results.length === 0"
        title="No doors in this radius yet"
        message="Open a wider radius or clear filters."
        action-label="Find Best Doors"
        @action="runScan"
      />
      <LeadCard
        v-for="lead in visibleResults"
        :key="lead.id"
        :lead="lead"
        :selected="selectedIds.has(lead.propertyId ?? lead.id)"
        @navigate="navigateToLead(lead)"
        @toggle="toggleLead(lead)"
        @open="openLead(lead)"
      />
      <div v-if="results.length > 0" class="page-surface p-4 text-center">
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
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
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

const props = withDefaults(defineProps<{
  initialView?: "list" | "map";
}>(), {
  initialView: "list",
});

const router = useRouter();
const hunt = useHuntStore();
const searchContextStore = useSearchContextStore();
const currentLocation = useCurrentLocation();
const { openDirections } = useLeadActions();
const { scanResults, loading, routeLoading, scanProgress, scanResultsTotal, scanResultsHasMore, scanResultsLoading } = storeToRefs(hunt);
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
const progressVisible = computed(() => Boolean(scanProgress.value || loading.value));
const scanLocationLabel = computed(() => searchContextStore.contextLabel || "selected location");
const searchStoreRadiusLabel = computed(() => `${searchContextStore.radiusMiles} mi radius`);
const currentLatitude = computed(() => resolvedLocation.value?.latitude ?? hunt.lastLatitude ?? null);
const currentLongitude = computed(() => resolvedLocation.value?.longitude ?? hunt.lastLongitude ?? null);
const canScan = computed(() => resolvedLocation.value != null);
const summary = computed(() => ({
  whales: results.value.filter((lead) => lead.whaleScore >= 60).length,
  large: results.value.filter((lead) => (lead.maxRoofSolarCapacityKw ?? 0) >= 15).length,
  permits: results.value.filter((lead) => lead.reasons.some((reason) => reason.toLowerCase().includes("permit"))).length,
  revisits: results.value.filter((lead) => lead.outcome === "NOT_HOME" || lead.outcome === "BILL_REQUESTED").length,
}));
const summaryLabel = computed(() => {
  if (!scanProgress.value) return "Pick a location, then scan a radius to rank opportunities.";
  if (scanProgress.value.status === "DATA_COVERAGE_UNAVAILABLE") {
    return "Property data isn’t available for this area yet.";
  }
  if (scanProgress.value.status === "DISCOVERY_FAILED") {
    return "We couldn’t complete this scan.";
  }
  if (scanProgress.value.status === "DISCOVERING") {
    return "Finding properties";
  }
  if (scanProgress.value.status === "PRE_RANKING") {
    return "Ranking opportunities";
  }
  if (scanProgress.value.status === "SOLAR_ANALYSIS") {
    return `Analyzing solar ${scanProgress.value.metrics.solarAnalyzedCount} / ${scanProgress.value.metrics.prequalifiedCount}`;
  }
  if (results.value.length > 0) {
    return `${results.value.length} strong leads loaded`;
  }
  return `${scan.value?.estimatedCostUsd?.toFixed(2) ?? "0.00"} estimated scan cost · ${scan.value?.analyzedCount ?? 0} analyzed`;
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
  if (scanProgress.value.status === "SOLAR_ANALYSIS") return `Analyzing solar ${scanProgress.value.metrics.solarAnalyzedCount} / ${scanProgress.value.metrics.prequalifiedCount}`;
  if (scanProgress.value.status === "DATA_COVERAGE_UNAVAILABLE") return "Property data isn’t available for this area yet.";
  return results.value.length > 0
    ? `${results.value.length} strong leads found`
    : "No strong leads found yet.";
});
const scanProgressLeadCount = computed(() => scanProgress.value?.metrics.resultsFound ?? results.value.length ?? 0);
const loadedResultsLabel = computed(() => {
  const total = scanResultsTotal.value || scanProgress.value?.metrics.resultsFound || results.value.length;
  if (total <= 0) {
    return "No leads loaded yet";
  }
  if (visibleResults.value.length !== results.value.length) {
    return `${visibleResults.value.length} shown · ${results.value.length} loaded of ${total}`;
  }
  return `${results.value.length} of ${total} leads loaded`;
});
const analyzedProgressLabel = computed(() => {
  if (!scanProgress.value) return "--";
  return `${scanProgress.value.metrics.solarAnalyzedCount} / ${scanProgress.value.metrics.prequalifiedCount}`;
});
const nextRadiusSuggestion = computed<10 | 20 | null>(() => {
  if (hunt.radiusMiles === 5) return 10;
  if (hunt.radiusMiles === 10) return 20;
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
  await hunt.runScan({
    latitude: center.latitude,
    longitude: center.longitude,
  });
}

async function loadMore() {
  await hunt.loadMoreResults();
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
