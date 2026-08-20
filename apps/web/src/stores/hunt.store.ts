import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  DiscoveryScanFilters,
  DiscoveryScanLead,
  DiscoveryScanResult,
  DiscoveryScanResultsPage,
  DiscoveryScanStatusResponse,
  LeadOutcome,
  RouteNextResponse,
  RoutePlan,
} from "@solar/contracts";
import { createRoute, getDiscoveryScan, getDiscoveryScanResults, getRouteNext, startDiscoveryScan, updateLeadOutcome } from "../services/api";
import { useSearchContextStore } from "./search-context.store";

const defaultFilters: DiscoveryScanFilters = {
  whaleCandidates: false,
  noDetectedExistingSolar: false,
};

export const useHuntStore = defineStore("hunt", () => {
  const radiusMiles = ref<5 | 10 | 20>(10);
  const filters = ref<DiscoveryScanFilters>({ ...defaultFilters });
  const scan = ref<DiscoveryScanStatusResponse | null>(null);
  const scanProgress = ref<DiscoveryScanStatusResponse | null>(null);
  const scanSignature = ref<string | null>(null);
  const scanResults = ref<DiscoveryScanLead[]>([]);
  const scanResultsCursor = ref<string | null>(null);
  const scanResultsHasMore = ref(false);
  const scanResultsTotal = ref(0);
  const currentScanId = ref<string | null>(null);
  const currentScanSession = ref(0);
  const scanResultsLoading = ref(false);
  const routePlan = ref<RoutePlan | null>(null);
  const routeProgress = ref<RouteNextResponse | null>(null);
  const selectedPropertyIds = ref<string[]>([]);
  const skippedPropertyIds = ref<string[]>([]);
  const loading = ref(false);
  const routeLoading = ref(false);
  const error = ref<string | null>(null);
  const lastLatitude = ref<number | null>(null);
  const lastLongitude = ref<number | null>(null);

  const visibleSelectedPropertyIds = computed(() =>
    selectedPropertyIds.value.filter((propertyId) => scanResults.value.some((lead) => lead.propertyId === propertyId)),
  );
  const selectedLeads = computed(() => {
    const selected = new Set(visibleSelectedPropertyIds.value);
    return scanResults.value.filter((lead) => selected.has(lead.propertyId ?? lead.id));
  });
  const currentStop = computed(() => {
    const route = routeProgress.value?.route ?? routePlan.value;
    if (!route) return null;
    const completed = new Set([
      ...route.completedPropertyIds,
      ...skippedPropertyIds.value,
    ]);
    return route.stops.find((stop) => !completed.has(stop.propertyId)) ?? null;
  });
  const nextStop = computed(() => {
    const route = routeProgress.value?.route ?? routePlan.value;
    if (!route) return null;
    const completed = new Set([
      ...route.completedPropertyIds,
      ...skippedPropertyIds.value,
    ]);
    const currentIndex = route.stops.findIndex((stop) => !completed.has(stop.propertyId));
    if (currentIndex < 0) return null;
    return route.stops.slice(currentIndex + 1).find((stop) => !completed.has(stop.propertyId)) ?? null;
  });
  const scanStatus = computed(() => scanProgress.value?.status ?? null);
  const scanStage = computed(() => scanStatus.value);
  const isScanning = computed(() => loading.value || Boolean(scanStatus.value && !["COMPLETE", "FAILED", "DISCOVERY_FAILED", "DATA_COVERAGE_UNAVAILABLE"].includes(scanStatus.value)));
  const isComplete = computed(() => scanStatus.value === "COMPLETE");
  const discoveredCount = computed(() => scanProgress.value?.metrics.discoveredCount ?? scanProgress.value?.metrics.discoveredProperties ?? 0);
  const strongLeadCount = computed(() => scanProgress.value?.metrics.resultsFound ?? scanResults.value.length ?? 0);
  const solarAnalyzedCount = computed(() => scanProgress.value?.metrics.solarAnalyzedCount ?? 0);
  const solarAnalysisTarget = computed(() => scanProgress.value?.metrics.prequalifiedCount ?? 0);
  const totalAvailable = computed(() => scanResultsTotal.value);

  function setRadius(value: 5 | 10 | 20) {
    radiusMiles.value = value;
  }

  function setFilter<K extends keyof DiscoveryScanFilters>(key: K, value: DiscoveryScanFilters[K]) {
    filters.value = {
      ...filters.value,
      [key]: value,
    };
  }

  function setMinCapacity(value: number | null) {
    filters.value = {
      ...filters.value,
      minCapacityKw: value ?? undefined,
    };
  }

  function toggleFilter(key: keyof DiscoveryScanFilters) {
    const current = filters.value[key];
    if (typeof current !== "boolean") {
      return;
    }
    setFilter(key, !current);
  }

  function selectLead(propertyId: string) {
    if (selectedPropertyIds.value.includes(propertyId)) {
      selectedPropertyIds.value = selectedPropertyIds.value.filter((item) => item !== propertyId);
      return;
    }
    selectedPropertyIds.value = [...selectedPropertyIds.value, propertyId];
  }

  function resetSelection() {
    selectedPropertyIds.value = [];
  }

  async function runScan(
    center: { latitude: number; longitude: number },
    options: {
      radiusMiles?: 5 | 10 | 20;
      filters?: DiscoveryScanFilters;
      limit?: number;
      maxGoogleSolarCalls?: number;
    } = {},
  ) {
    const searchStore = useSearchContextStore();
    const committedFilters = options.filters ?? searchStore.filters ?? filters.value;
    const committedRadius = options.radiusMiles ?? searchStore.radiusMiles ?? radiusMiles.value;
    const sessionId = beginScanSession(buildScanSignature(center, committedRadius, committedFilters));
    loading.value = true;
    error.value = null;
    lastLatitude.value = center.latitude;
    lastLongitude.value = center.longitude;
    try {
      const job = await startDiscoveryScan({
        center,
        radiusMiles: committedRadius,
        filters: committedFilters,
        limit: options.limit ?? 250,
        maxGoogleSolarCalls: options.maxGoogleSolarCalls ?? 25,
      });
      if (!isCurrentScanSession(sessionId)) {
        return emptyScanResult(committedRadius, center);
      }
      if (!job?.scanId) {
        resetScanSnapshot();
        return emptyScanResult(committedRadius, center);
      }

      currentScanId.value = job.scanId;
      scanSignature.value = buildScanSignature(center, committedRadius, committedFilters);
      scanProgress.value = await getDiscoveryScan(job.scanId);
      if (!isCurrentScanSession(sessionId)) {
        return emptyScanResult(committedRadius, center);
      }
      scan.value = scanProgress.value;
      scanResults.value = [];
      scanResultsCursor.value = null;
      scanResultsHasMore.value = false;
      scanResultsTotal.value = 0;
      const terminalStatuses = new Set(["COMPLETE", "FAILED", "DISCOVERY_FAILED", "DATA_COVERAGE_UNAVAILABLE"]);
      const deadline = Date.now() + 45_000;
      while (scanProgress.value && !terminalStatuses.has(scanProgress.value.status) && Date.now() < deadline) {
        await sleep(900);
        if (!isCurrentScanSession(sessionId)) {
          return emptyScanResult(committedRadius, center);
        }
        scanProgress.value = await getDiscoveryScan(job.scanId);
        if (!isCurrentScanSession(sessionId)) {
          return emptyScanResult(committedRadius, center);
        }
        scan.value = scanProgress.value;
        if (scanProgress.value && scanProgress.value.metrics.resultsFound > 0 && scanResults.value.length === 0) {
          await loadScanResultsPage({ reset: true, scanId: job.scanId, sessionId });
        }
      }
      if (!isCurrentScanSession(sessionId)) {
        return emptyScanResult(committedRadius, center);
      }
      if (!scan.value) {
        resetScanSnapshot();
      }
      if (currentScanId.value && scanResultsCursor.value == null) {
        await loadScanResultsPage({ reset: true, scanId: job.scanId, sessionId });
      }
      if (scanResults.value.length === 0 && currentScanId.value) {
        await loadScanResultsPage({ reset: true, scanId: job.scanId, sessionId });
      }
      const visibleIds = new Set(scanResults.value.map((lead) => lead.propertyId ?? lead.id));
      selectedPropertyIds.value = selectedPropertyIds.value.filter((propertyId) => visibleIds.has(propertyId));
      return scan.value ?? emptyScanResult(committedRadius, center);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unable to scan area";
      throw cause;
    } finally {
      if (isCurrentScanSession(sessionId)) {
        loading.value = false;
      }
    }
  }

  async function generateRoute() {
    if (lastLatitude.value == null || lastLongitude.value == null) {
      throw new Error("Scan location is missing.");
    }
    const selected = visibleSelectedPropertyIds.value.length > 0
      ? visibleSelectedPropertyIds.value
      : scanResults.value.slice(0, 5).map((lead) => lead.propertyId ?? lead.id);
    if (selected.length === 0) {
      throw new Error("Select at least one lead before building a route.");
    }
    routeLoading.value = true;
    error.value = null;
    try {
      routePlan.value = await createRoute({
        startingLatitude: lastLatitude.value,
        startingLongitude: lastLongitude.value,
        selectedPropertyIds: selected,
      });
      if (!routePlan.value) {
        throw new Error("Unable to create route");
      }
      routeProgress.value = await getRouteNext(routePlan.value.id);
      skippedPropertyIds.value = [];
      return routePlan.value;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unable to create route";
      throw cause;
    } finally {
      routeLoading.value = false;
    }
  }

  async function refreshRoute() {
    const routeId = routePlan.value?.id ?? routeProgress.value?.routeId ?? null;
    if (!routeId) {
      return null;
    }
    routeLoading.value = true;
    try {
      routeProgress.value = await getRouteNext(routeId);
      if (routeProgress.value) {
        routePlan.value = routeProgress.value.route;
      }
      return routeProgress.value;
    } finally {
      routeLoading.value = false;
    }
  }

  async function recordOutcome(propertyId: string, outcome: LeadOutcome["outcome"], notes: string | null = null) {
    await updateLeadOutcome(propertyId, outcome, notes);
    await refreshRoute();
    if (lastLatitude.value != null && lastLongitude.value != null) {
      await runScan({ latitude: lastLatitude.value, longitude: lastLongitude.value });
    }
  }

  async function loadMoreResults() {
    return loadScanResultsPage({ scanId: currentScanId.value ?? undefined, sessionId: currentScanSession.value });
  }

  function skipCurrentStop() {
    const stop = currentStop.value;
    if (!stop) return;
    skippedPropertyIds.value = [...new Set([...skippedPropertyIds.value, stop.propertyId])];
  }

  return {
    radiusMiles,
    filters,
    scan,
    scanProgress,
    scanSignature,
    scanResults,
    scanResultsCursor,
    scanResultsHasMore,
    scanResultsTotal,
    currentScanId,
    currentScanSession,
    scanResultsLoading,
    routePlan,
    routeProgress,
    selectedPropertyIds,
    skippedPropertyIds,
    loading,
    routeLoading,
    error,
    lastLatitude,
    lastLongitude,
    selectedLeads,
    currentStop,
    nextStop,
    scanStatus,
    scanStage,
    isScanning,
    isComplete,
    discoveredCount,
    strongLeadCount,
    solarAnalyzedCount,
    solarAnalysisTarget,
    totalAvailable,
    setRadius,
    setFilter,
    setMinCapacity,
    toggleFilter,
    selectLead,
    resetSelection,
    runScan,
    loadMoreResults,
    generateRoute,
    refreshRoute,
    recordOutcome,
    skipCurrentStop,
  };
});

async function loadScanResultsPage(options: { reset?: boolean; scanId?: string; sessionId?: number } = {}): Promise<DiscoveryScanResultsPage | null> {
  const store = useHuntStore();
  const scanId = options.scanId ?? store.currentScanId;
  if (!scanId || (options.sessionId != null && options.sessionId !== store.currentScanSession)) {
    return null;
  }

  store.scanResultsLoading = true;
  try {
    const page = await getDiscoveryScanResults(scanId, options.reset ? null : store.scanResultsCursor, 20);
    if (!page) {
      return null;
    }
    if (store.currentScanId !== scanId || (options.sessionId != null && options.sessionId !== store.currentScanSession)) {
      return null;
    }

    if (options.reset) {
      store.scanResults = [];
    }

    const existingIds = new Set(store.scanResults.map((lead) => lead.propertyId ?? lead.id));
    const nextResults = page.results.filter((lead) => {
      const key = lead.propertyId ?? lead.id;
      if (existingIds.has(key)) {
        return false;
      }
      existingIds.add(key);
      return true;
    });

    store.scanResults = [...store.scanResults, ...nextResults];
    store.scanResultsCursor = page.nextCursor;
    store.scanResultsHasMore = page.hasMore;
    store.scanResultsTotal = page.totalAvailable;
    return page;
  } finally {
    store.scanResultsLoading = false;
  }
}

function resetScanSnapshot() {
  const store = useHuntStore();
  store.scan = null;
  store.scanProgress = null;
  store.scanSignature = null;
  store.scanResults = [];
  store.scanResultsCursor = null;
  store.scanResultsHasMore = false;
  store.scanResultsTotal = 0;
  store.currentScanId = null;
}

function beginScanSession(signature: string): number {
  const store = useHuntStore();
  store.currentScanSession += 1;
  store.currentScanId = null;
  store.scanSignature = signature;
  store.scan = null;
  store.scanProgress = null;
  store.scanResults = [];
  store.scanResultsCursor = null;
  store.scanResultsHasMore = false;
  store.scanResultsTotal = 0;
  return store.currentScanSession;
}

function isCurrentScanSession(sessionId: number): boolean {
  const store = useHuntStore();
  return store.currentScanSession === sessionId;
}

function buildScanSignature(
  center: { latitude: number; longitude: number },
  radiusMiles: 5 | 10 | 20,
  filters: DiscoveryScanFilters,
): string {
  return JSON.stringify({
    center: [
      Number(center.latitude.toFixed(5)),
      Number(center.longitude.toFixed(5)),
    ],
    radiusMiles,
    filters: {
      whaleCandidates: Boolean(filters.whaleCandidates),
      noDetectedExistingSolar: Boolean(filters.noDetectedExistingSolar),
      largeProperties: Boolean(filters.largeProperties),
      highPriority: Boolean(filters.highPriority),
      recentRoofPermits: Boolean(filters.recentRoofPermits),
      highValueAreas: Boolean(filters.highValueAreas),
      noDetectedSolar: Boolean(filters.noDetectedSolar),
      revisits: Boolean(filters.revisits),
      lowSolarSaturation: Boolean(filters.lowSolarSaturation),
      minCapacityKw: filters.minCapacityKw ?? null,
    },
  });
}

function emptyScanResult(
  radiusMiles: number,
  center: { latitude: number; longitude: number },
): DiscoveryScanResult {
  return {
    scanId: `empty-${radiusMiles}-${center.latitude}-${center.longitude}`,
    currentLocation: "",
    radiusMiles,
    candidateCount: 0,
    analyzedCount: 0,
    googleSolarCalls: 0,
    estimatedCostUsd: 0,
    results: [],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
