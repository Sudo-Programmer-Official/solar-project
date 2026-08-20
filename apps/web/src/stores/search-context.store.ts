import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { LocationResolveResponse } from "@solar/contracts";
import { reverseLocation, resolveLocation } from "../services/api";

export interface SearchFilters {
  whaleCandidates: boolean;
  highPriority: boolean;
  minimumSystemKw: number | null;
  recentRoofPermit: boolean;
  noDetectedSolar: boolean;
  poolDetected: boolean;
  largeRoof: boolean;
  lowShade: boolean;
  largeLot: boolean;
  largeProperty: boolean;
  highValueArea: boolean;
  revisit: boolean;
}

export interface SearchContext {
  type: "AREA" | "PROPERTY";
  label: string;
  latitude: number;
  longitude: number;
  placeId: string | null;
  propertyId?: string | null;
}

const CONTEXT_KEY = "solar.search.context";
const RECENT_KEY = "solar.search.recent";
const FILTERS_KEY = "solar.search.filters";
const RADIUS_KEY = "solar.search.radius";
const PROMPTED_KEY = "solar.search.prompted";
const STORAGE_VERSION_KEY = "solar.search.version";
const STORAGE_VERSION = "4";
const GENERIC_LOCATION_LABELS = new Set(["current location", "choose a location"]);

const defaultFilters = (): SearchFilters => ({
  whaleCandidates: false,
  highPriority: false,
  minimumSystemKw: null,
  recentRoofPermit: false,
  noDetectedSolar: false,
  poolDetected: false,
  largeRoof: false,
  lowShade: false,
  largeLot: false,
  largeProperty: false,
  highValueArea: false,
  revisit: false,
});

export const useSearchContextStore = defineStore("search-context", () => {
  const context = ref<SearchContext | null>(null);
  const radiusMiles = ref<5 | 10 | 20>(10);
  const filters = ref<SearchFilters>(defaultFilters());
  const recentSearchLabels = ref<string[]>([]);
  const initialized = ref(false);
  const locationPermissionDenied = ref(false);
  const resolvingLocation = ref(false);

  const hasContext = computed(() => context.value != null);
  const isPropertyContext = computed(() => context.value?.type === "PROPERTY");
  const isAreaContext = computed(() => context.value?.type === "AREA");
  const contextLabel = computed(() => context.value?.label ?? (locationPermissionDenied.value ? "Choose a location" : ""));
  const filterCount = computed(() =>
    [
      filters.value.whaleCandidates ? 1 : 0,
      filters.value.highPriority ? 1 : 0,
      filters.value.minimumSystemKw != null ? 1 : 0,
      filters.value.recentRoofPermit ? 1 : 0,
      filters.value.noDetectedSolar ? 1 : 0,
      filters.value.poolDetected ? 1 : 0,
      filters.value.largeRoof ? 1 : 0,
      filters.value.lowShade ? 1 : 0,
      filters.value.largeLot ? 1 : 0,
      filters.value.largeProperty ? 1 : 0,
      filters.value.highValueArea ? 1 : 0,
      filters.value.revisit ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0),
  );

  function hydrate() {
    if (initialized.value || typeof window === "undefined") {
      return;
    }
    initialized.value = true;
    const storedVersion = readStorage<string>(STORAGE_VERSION_KEY);
    if (storedVersion !== STORAGE_VERSION) {
      clearPersistedState();
      window.localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    }
    context.value = readStorage<SearchContext>(CONTEXT_KEY);
    radiusMiles.value = readStorage<5 | 10 | 20>(RADIUS_KEY) ?? 10;
    filters.value = mergeFilters(readStorage<Partial<SearchFilters>>(FILTERS_KEY));
    recentSearchLabels.value = (readStorage<string[]>(RECENT_KEY)?.slice(0, 5) ?? []).filter((label) => !isGenericLocationLabel(label));
    locationPermissionDenied.value = readStorage<boolean>(PROMPTED_KEY) ?? false;
  }

  async function initializeDefaultContext(force = false) {
    hydrate();
    if ((context.value && !force) || locationPermissionDenied.value || typeof window === "undefined") {
      return;
    }
    if (!navigator.geolocation) {
      locationPermissionDenied.value = true;
      persist();
      return;
    }

    resolvingLocation.value = true;
    try {
      const position = await getCurrentPosition();
      const resolved = await reverseLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (resolved) {
        applyResolvedLocation(resolved, undefined, false);
      } else {
        locationPermissionDenied.value = true;
      }
    } catch {
      locationPermissionDenied.value = true;
    } finally {
      resolvingLocation.value = false;
      persist();
      window.localStorage.setItem(PROMPTED_KEY, JSON.stringify(true));
    }
  }

  async function resolveAndSetContext(query: string): Promise<LocationResolveResponse | null> {
    hydrate();
    const resolved = await resolveLocation({ query });
    if (!resolved) {
      return null;
    }
    applyResolvedLocation(resolved, query, true);
    return resolved;
  }

  function applyResolvedLocation(resolved: LocationResolveResponse, query?: string, addToRecent = true) {
    const nextContext: SearchContext = {
      type: resolved.type,
      label: resolved.formattedAddress,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      placeId: resolved.placeId,
      propertyId: resolved.propertyId ?? null,
    };
    context.value = nextContext;
    locationPermissionDenied.value = false;
    if (addToRecent) {
      recordRecentSearch(query ?? resolved.formattedAddress);
    }
    persist();
  }

  function setContext(nextContext: SearchContext) {
    context.value = nextContext;
    locationPermissionDenied.value = false;
    recordRecentSearch(nextContext.label);
    persist();
  }

  function clearContext() {
    context.value = null;
    persist();
  }

  function setRadiusMiles(value: 5 | 10 | 20) {
    radiusMiles.value = value;
    persist();
  }

  function setMinimumSystemKw(value: number | null) {
    filters.value.minimumSystemKw = value;
    persist();
  }

  function toggleBooleanFilter(key: Exclude<keyof SearchFilters, "minimumSystemKw">) {
    filters.value = {
      ...filters.value,
      [key]: !filters.value[key],
    };
    persist();
  }

  function setFilters(nextFilters: SearchFilters) {
    filters.value = { ...nextFilters };
    persist();
  }

  function setSearchPreferences(nextRadius: 5 | 10 | 20, nextFilters: SearchFilters) {
    radiusMiles.value = nextRadius;
    filters.value = { ...nextFilters };
    persist();
  }

  function resetFilters() {
    filters.value = defaultFilters();
    persist();
  }

  function recordRecentSearch(label: string) {
    const cleaned = label.trim();
    if (!cleaned || isGenericLocationLabel(cleaned)) return;
    recentSearchLabels.value = [cleaned, ...recentSearchLabels.value.filter((item) => item !== cleaned)].slice(0, 5);
  }

  function persist() {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    if (context.value) {
      window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(context.value));
    } else {
      window.localStorage.removeItem(CONTEXT_KEY);
    }
    window.localStorage.setItem(RADIUS_KEY, JSON.stringify(radiusMiles.value));
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(filters.value));
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearchLabels.value.slice(0, 5)));
    window.localStorage.setItem(PROMPTED_KEY, JSON.stringify(locationPermissionDenied.value));
  }

  watch(context, persist, { deep: true });
  watch(radiusMiles, persist);
  watch(filters, persist, { deep: true });
  watch(recentSearchLabels, persist, { deep: true });

  hydrate();

  return {
    context,
    radiusMiles,
    filters,
    recentSearchLabels,
    initialized,
    locationPermissionDenied,
    resolvingLocation,
    hasContext,
    isPropertyContext,
    isAreaContext,
    contextLabel,
    filterCount,
    hydrate,
    initializeDefaultContext,
    resolveAndSetContext,
    setContext,
    clearContext,
    setRadiusMiles,
    setMinimumSystemKw,
    toggleBooleanFilter,
    setFilters,
    setSearchPreferences,
    resetFilters,
    recordRecentSearch,
  };
});

function mergeFilters(stored?: Partial<SearchFilters> | null): SearchFilters {
  return {
    ...defaultFilters(),
    ...stored,
  };
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isGenericLocationLabel(label: string): boolean {
  return GENERIC_LOCATION_LABELS.has(label.trim().toLowerCase());
}

function clearPersistedState() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CONTEXT_KEY);
  window.localStorage.removeItem(RECENT_KEY);
  window.localStorage.removeItem(FILTERS_KEY);
  window.localStorage.removeItem(RADIUS_KEY);
  window.localStorage.removeItem(PROMPTED_KEY);
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000,
    });
  });
}
