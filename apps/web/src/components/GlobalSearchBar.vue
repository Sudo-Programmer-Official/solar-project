<template>
  <div class="border-b border-slate-200 bg-white/95 backdrop-blur">
    <div class="mx-auto max-w-6xl px-3 py-2 md:px-4 md:py-3">
      <div class="grid items-center gap-2 md:hidden md:gap-3">
        <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <span class="shrink-0 text-[18px] font-bold tracking-[0.08em] text-slate-950">BLACKOPS FIELD</span>

          <form class="min-w-0" @submit.prevent="searchLocation">
            <label class="relative block" for="global-search-input-mobile">
              <span class="sr-only">Search location</span>
              <input
                id="global-search-input-mobile"
                v-model="query"
                class="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 shadow-sm"
                type="search"
                :placeholder="placeholder"
                autocomplete="off"
              />
              <el-tooltip content="Use current location" placement="bottom" :show-after="250">
                <button
                  class="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                  type="button"
                  :disabled="searchStore.resolvingLocation"
                  @click="useCurrentLocation"
                >
                  <el-icon :size="18">
                    <LocationFilled />
                  </el-icon>
                </button>
              </el-tooltip>
            </label>
          </form>

          <el-dropdown trigger="click" placement="bottom-end" @command="handleMobileCommand">
            <button
              class="touch-target relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl font-semibold leading-none text-slate-700 shadow-sm transition hover:bg-slate-100"
              type="button"
              aria-label="Open search actions"
            >
              ⋯
              <span
                v-if="searchStore.filterCount"
                class="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
              >
                {{ searchStore.filterCount }}
              </span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="filters">Filters</el-dropdown-item>
                <el-dropdown-item command="current-location">Use current location</el-dropdown-item>
                <el-dropdown-item command="rescan">Refresh / Rescan</el-dropdown-item>
                <el-dropdown-item command="list-view">List view if available</el-dropdown-item>
                <el-dropdown-item command="swipe-view">Swipe view if needed later</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="hidden md:flex md:flex-col md:gap-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-lg font-bold tracking-[0.08em] text-slate-950">BLACKOPS FIELD</span>
          </div>
          <button
            class="touch-target rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
            type="button"
            @click="filtersOpen = true"
          >
            Filter
            <span v-if="searchStore.filterCount" class="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">
              {{ searchStore.filterCount }}
            </span>
          </button>
        </div>

        <form class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="searchLocation">
          <label class="relative block" for="global-search-input">
            <span class="sr-only">Search location</span>
            <input
              id="global-search-input"
              v-model="query"
              class="min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 pr-24 text-sm text-slate-900 outline-none placeholder:text-slate-400 shadow-sm"
              type="search"
              :placeholder="placeholder"
              autocomplete="off"
            />
            <el-tooltip content="Use current location" placement="bottom" :show-after="250">
              <button
                class="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                type="button"
                :disabled="searchStore.resolvingLocation"
                @click="useCurrentLocation"
              >
                <el-icon :size="18">
                  <LocationFilled />
                </el-icon>
              </button>
            </el-tooltip>
          </label>

          <button
            class="hidden touch-target rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:inline-flex md:min-w-[112px] md:items-center md:justify-center"
            type="button"
            @click="filtersOpen = true"
          >
            Filter
            <span v-if="searchStore.filterCount" class="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">
              {{ searchStore.filterCount }}
            </span>
          </button>
        </form>
      </div>
    </div>

    <el-drawer
      v-model="filtersOpen"
      :direction="drawerDirection"
      :append-to-body="true"
      :z-index="2600"
      :size="drawerSize"
      class="light-filter-drawer"
      title="Filters"
      @open="syncDraftFromLive"
      @closed="discardDraft"
    >
      <div class="relative flex h-full flex-col">
        <div class="grid gap-5 px-1 pb-24">
          <section class="space-y-2">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[15px] font-semibold tracking-tight text-slate-900">Filters</p>
                <p class="mt-1 text-sm text-slate-500">{{ activeFilterSummary }}</p>
              </div>
              <div class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                {{ activeFilterCount }} active
              </div>
            </div>
            <p class="text-xs text-slate-500">{{ draftSummary }}</p>
          </section>

          <section class="grid gap-3">
            <p class="text-sm font-semibold text-slate-900">Radius</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="radius in radii"
                :key="radius"
                class="touch-target flex min-h-[52px] items-center justify-center rounded-2xl border px-3 py-3 text-sm font-semibold transition"
                :class="draftRadiusMiles === radius ? selectedButtonClasses : unselectedButtonClasses"
                type="button"
                @click="draftRadiusMiles = radius"
              >
                <Check v-if="draftRadiusMiles === radius" class="mr-1 h-4 w-4 text-primary-500" />
                {{ radius }} mi
              </button>
            </div>
          </section>

          <section class="grid gap-3">
            <p class="text-sm font-semibold text-slate-900">Opportunity</p>
            <div class="grid gap-2 sm:grid-cols-3">
              <button
                v-for="item in opportunityFilters"
                :key="item.key"
                class="touch-target flex min-h-[52px] items-center justify-start gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition"
                :class="draftFilters[item.key] ? selectedButtonClasses : unselectedButtonClasses"
                type="button"
                @click="toggleDraftBooleanFilter(item.key)"
              >
                <Check v-if="draftFilters[item.key]" class="h-4 w-4 shrink-0 text-primary-500" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>
          </section>

          <section class="grid gap-3">
            <p class="text-sm font-semibold text-slate-900">Solar capacity</p>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                v-for="option in systemOptions"
                :key="option.label"
                class="touch-target flex min-h-[52px] items-center justify-center rounded-2xl border px-3 py-3 text-sm font-semibold transition"
                :class="draftFilters.minimumSystemKw === option.value ? selectedButtonClasses : unselectedButtonClasses"
                type="button"
                @click="draftFilters.minimumSystemKw = option.value"
              >
                <Check v-if="draftFilters.minimumSystemKw === option.value" class="mr-1 h-4 w-4 text-primary-500" />
                {{ option.label }}
              </button>
            </div>
          </section>

          <section class="grid gap-3">
            <p class="text-sm font-semibold text-slate-900">Property signals</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="item in propertySignalFilters"
                :key="item.key"
                class="touch-target flex min-h-[52px] items-center justify-between rounded-2xl border px-3 py-3 text-sm font-semibold transition"
                :class="draftFilters[item.key] ? selectedButtonClasses : unselectedButtonClasses"
                type="button"
                @click="toggleDraftBooleanFilter(item.key)"
              >
                <span>{{ item.label }}</span>
                <Check v-if="draftFilters[item.key]" class="h-4 w-4 shrink-0 text-primary-500" />
              </button>
            </div>
          </section>

          <section class="grid gap-3">
            <p class="text-sm font-semibold text-slate-900">Signals</p>
            <div class="grid gap-2">
              <button
                v-for="item in signalFilters"
                :key="item.key"
                class="touch-target flex min-h-[52px] items-center justify-between rounded-2xl border px-3 py-3 text-sm font-semibold transition"
                :class="draftFilters[item.key] ? selectedButtonClasses : unselectedButtonClasses"
                type="button"
                @click="toggleDraftBooleanFilter(item.key)"
              >
                <span>{{ item.label }}</span>
                <Check v-if="draftFilters[item.key]" class="h-4 w-4 shrink-0 text-primary-500" />
              </button>
            </div>
          </section>
        </div>

        <div class="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/98 px-1 py-4 backdrop-blur">
          <div class="flex items-center gap-2">
            <button
              class="touch-target flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              type="button"
              @click="resetDraft"
            >
              Reset
            </button>
            <button
              class="touch-target flex-[1.35] rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-600"
              type="button"
              @click="applyDraftFilters"
            >
              Apply filters<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
            </button>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Check, LocationFilled } from "@element-plus/icons-vue";
import { ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon, ElNotification, ElTooltip } from "element-plus";
import { useRouter } from "vue-router";
import { useSearchContextStore } from "../stores/search-context.store";
import { useHuntStore } from "../stores/hunt.store";

const router = useRouter();
const searchStore = useSearchContextStore();
const huntStore = useHuntStore();

const query = ref("");
const filtersOpen = ref(false);
const isDesktop = ref(false);
const draftRadiusMiles = ref<5 | 10 | 20>(10);
const draftFilters = ref(cloneFilters(searchStore.filters));
const bootstrappedScan = ref(false);
const radii = [5, 10, 20] as const;
const opportunityFilters = [
  { key: "whaleCandidates" as const, label: "Whale candidates" },
  { key: "highPriority" as const, label: "High priority" },
  { key: "revisit" as const, label: "Revisit" },
] as const;
const propertySignalFilters = [
  { key: "poolDetected" as const, label: "Pool" },
  { key: "largeRoof" as const, label: "Large roof" },
  { key: "lowShade" as const, label: "Low shade" },
  { key: "largeLot" as const, label: "Large lot" },
] as const;
const signalFilters = [
  { key: "recentRoofPermit" as const, label: "Recent roof permit" },
  { key: "noDetectedSolar" as const, label: "No detected solar" },
  { key: "largeProperty" as const, label: "Large property" },
  { key: "highValueArea" as const, label: "High value area" },
] as const;
const systemOptions = [
  { label: "Any", value: null },
  { label: "12+ kW", value: 12 },
  { label: "15+ kW", value: 15 },
  { label: "20+ kW", value: 20 },
] as const;

const placeholder = computed(() =>
  searchStore.locationPermissionDenied ? "Choose a location" : "Search address, city, ZIP or neighborhood",
);
const drawerDirection = computed(() => (isDesktop.value ? "rtl" : "btt"));
const drawerSize = computed(() => (isDesktop.value ? "360px" : "72%"));
const selectedButtonClasses = "border-primary-300 bg-primary-50 text-slate-900 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]";
const unselectedButtonClasses = "border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-slate-50";
const contextLine = computed(() => {
  const context = searchStore.context;
  if (!context) {
    return "";
  }
  const parts = [context.label, `${searchStore.radiusMiles} mi`, ...filterSummary.value].filter(Boolean);
  return parts.join(" • ");
});
const filterSummary = computed(() => {
  const labels: string[] = [];
  if (searchStore.filters.whaleCandidates) labels.push("Whales");
  if (searchStore.filters.highPriority) labels.push("High Priority");
  if (searchStore.filters.minimumSystemKw != null) labels.push(`${searchStore.filters.minimumSystemKw}+ kW`);
  if (searchStore.filters.poolDetected) labels.push("Pool");
  if (searchStore.filters.largeRoof) labels.push("Large roof");
  if (searchStore.filters.lowShade) labels.push("Low shade");
  if (searchStore.filters.largeLot) labels.push("Large lot");
  if (searchStore.filters.recentRoofPermit) labels.push("Roof permits");
  if (searchStore.filters.noDetectedSolar) labels.push("No detected solar");
  if (searchStore.filters.largeProperty) labels.push("Large properties");
  if (searchStore.filters.highValueArea) labels.push("High-value areas");
  if (searchStore.filters.revisit) labels.push("Revisit");
  return labels.slice(0, 4);
});
const activeFilterCount = computed(() => searchStore.filterCount);
const activeFilterSummary = computed(() => {
  const labels = filterSummary.value;
  return labels.length > 0 ? `${activeFilterCount.value} active • ${labels.join(" • ")}` : `${activeFilterCount.value} active`;
});
const draftSummary = computed(() => {
  const labels: string[] = [];
  labels.push(`${draftRadiusMiles.value} mi`);
  if (draftFilters.value.whaleCandidates) labels.push("Whales");
  if (draftFilters.value.highPriority) labels.push("High Priority");
  if (draftFilters.value.minimumSystemKw != null) labels.push(`${draftFilters.value.minimumSystemKw}+ kW`);
  if (draftFilters.value.poolDetected) labels.push("Pool");
  if (draftFilters.value.largeRoof) labels.push("Large roof");
  if (draftFilters.value.lowShade) labels.push("Low shade");
  if (draftFilters.value.largeLot) labels.push("Large lot");
  if (draftFilters.value.recentRoofPermit) labels.push("Recent roof permit");
  if (draftFilters.value.noDetectedSolar) labels.push("No detected solar");
  if (draftFilters.value.largeProperty) labels.push("Large property");
  if (draftFilters.value.highValueArea) labels.push("High value area");
  if (draftFilters.value.revisit) labels.push("Revisit");
  return labels.join(" • ");
});
const genericLocationLabels = ["current location", "choose a location"];

onMounted(() => {
  searchStore.hydrate();
  if (searchStore.context?.label) {
    query.value = searchStore.context.label;
  }
  syncViewport();
  window.addEventListener("resize", syncViewport);
  void bootstrapSearchContext();
});

onUnmounted(() => {
  window.removeEventListener("resize", syncViewport);
});

watch(
  () => searchStore.context?.label,
  (value) => {
    if (!value) {
      return;
    }
    const normalizedQuery = query.value.trim().toLowerCase();
    if (!normalizedQuery || genericLocationLabels.includes(normalizedQuery) || normalizedQuery === value.trim().toLowerCase()) {
      query.value = value;
    }
  },
);

function syncViewport() {
  if (typeof window === "undefined") {
    return;
  }
  isDesktop.value = window.innerWidth >= 1024;
}

async function searchLocation() {
  const value = query.value.trim();
  if (!value) {
    notifyError("We couldn't resolve that location.");
    return;
  }

  const normalizedValue = value.toLowerCase();
  if (genericLocationLabels.includes(normalizedValue)) {
    await useCurrentLocation();
    return;
  }

  if (searchStore.context?.label && normalizedValue === searchStore.context.label.trim().toLowerCase()) {
    await findBestDoors({ quiet: true });
    return;
  }

  try {
    const resolved = await searchStore.resolveAndSetContext(value);
    if (!resolved) {
      notifyError("We couldn't resolve that location.");
      return;
    }
    query.value = resolved.formattedAddress;
    if (resolved.type === "PROPERTY" && resolved.propertyId) {
      await router.push(`/properties/${encodeURIComponent(resolved.propertyId)}`);
      return;
    }
    await findBestDoors({ quiet: true });
  } catch {
    notifyError("Unable to reach BlackOps Field. Please try again.");
  }
}

async function useCurrentLocation() {
  try {
    await searchStore.initializeDefaultContext(true);
    if (searchStore.context?.label) {
      query.value = searchStore.context.label;
      await findBestDoors({ quiet: true });
      return;
    }
    notifyWarning("Unable to use current location.");
  } catch {
    notifyWarning("Unable to use current location.");
  }
}

async function findBestDoors(options: { quiet?: boolean } = {}) {
  if (!searchStore.context) {
    return;
  }
  const center = searchStore.context;
  try {
    await huntStore.runScan(
      { latitude: center.latitude, longitude: center.longitude },
      {
        radiusMiles: searchStore.radiusMiles,
        filters: searchStore.filters,
      },
    );
    if (!options.quiet) {
      await router.push("/labs/lead-finder");
    }
  } catch {
    notifyError("Scan failed. Try again.");
  }
}

type FilterToggleKey = typeof opportunityFilters[number]["key"] | typeof propertySignalFilters[number]["key"] | typeof signalFilters[number]["key"];

function booleanFilterActive(key: FilterToggleKey) {
  return Boolean(searchStore.filters[key]);
}

async function handleMobileCommand(command: string) {
  if (command === "filters") {
    filtersOpen.value = true;
    return;
  }
  if (command === "current-location") {
    await useCurrentLocation();
    return;
  }
  if (command === "rescan") {
    await findBestDoors({ quiet: true });
    return;
  }
  if (command === "list-view") {
    await router.push({ path: "/labs/lead-finder", query: { ...router.currentRoute.value.query, view: "list" } });
    return;
  }
  if (command === "swipe-view") {
    await router.push({ path: "/labs/lead-finder", query: { ...router.currentRoute.value.query, view: "swipe" } });
  }
}

function syncDraftFromLive() {
  draftRadiusMiles.value = searchStore.radiusMiles;
  draftFilters.value = cloneFilters(searchStore.filters);
}

function discardDraft() {
  syncDraftFromLive();
}

function resetDraft() {
  draftRadiusMiles.value = 10;
  draftFilters.value = cloneFilters({
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
}

function applyDraftFilters() {
  searchStore.setSearchPreferences(draftRadiusMiles.value, cloneFilters(draftFilters.value));
  filtersOpen.value = false;
  void findBestDoors({ quiet: true });
}

function toggleDraftBooleanFilter(key: FilterToggleKey) {
  draftFilters.value = {
    ...draftFilters.value,
    [key]: !draftFilters.value[key],
  };
}

function cloneFilters(filters: typeof searchStore.filters): typeof searchStore.filters {
  return {
    ...filters,
  };
}

function notifyError(message: string) {
  ElNotification({
    title: "BlackOps Field",
    message,
    type: "error",
    duration: 2600,
    position: "top-right",
  });
}

function notifyWarning(message: string) {
  ElNotification({
    title: "BlackOps Field",
    message,
    type: "warning",
    duration: 2600,
    position: "top-right",
  });
}

async function bootstrapSearchContext() {
  if (bootstrappedScan.value) {
    return;
  }
  await searchStore.initializeDefaultContext();
  if (!searchStore.context) {
    return;
  }
  bootstrappedScan.value = true;
  query.value = searchStore.context.label;
  await findBestDoors({ quiet: true });
}
</script>

<style scoped>
:deep(.light-filter-drawer) {
  background: #ffffff;
  color: #0f172a;
}

:deep(.light-filter-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 20px 12px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  color: #0f172a;
}

:deep(.light-filter-drawer .el-drawer__title) {
  color: #0f172a;
  font-weight: 700;
  letter-spacing: 0.01em;
}

:deep(.light-filter-drawer .el-drawer__close-btn) {
  color: #64748b;
}

:deep(.light-filter-drawer .el-drawer__body) {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 1));
  color: #0f172a;
}

:deep(.light-filter-drawer .el-drawer__body .field-label) {
  color: #64748b;
}

:deep(.light-filter-drawer .el-checkbox-button__inner),
:deep(.light-filter-drawer .el-radio-button__inner) {
  color: #0f172a;
}

:deep(.light-filter-drawer .el-checkbox-button.is-checked .el-checkbox-button__inner),
:deep(.light-filter-drawer .el-radio-button__original-radio:checked + .el-radio-button__inner),
:deep(.light-filter-drawer .el-checkbox-button.is-focus .el-checkbox-button__inner) {
  background: #ecfeff;
  border-color: #67e8f9;
  color: #0f172a;
}
</style>
