<template>
  <section data-testid="lead-results-view" class="page-surface p-3 sm:p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="field-label">PULLED LEADS</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-950">Lead pipeline</h2>
        <p class="mt-1 text-sm text-slate-500">{{ filteredLeads.length }} shown · {{ totalLabel }}</p>
      </div>
      <div class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
        {{ isScanning ? "Updating live" : `${loadedCount} loaded` }}
      </div>
    </div>

    <div class="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
      <label class="relative block">
        <span class="sr-only">Search pulled leads</span>
        <input
          v-model="localSearchQuery"
          class="field-control pr-10"
          type="search"
          placeholder="Search address or city"
          aria-label="Search pulled leads"
        />
        <svg class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="4.75" />
          <path d="m12 12 4 4" stroke-linecap="round" />
        </svg>
      </label>
      <label>
        <span class="sr-only">Filter lead status</span>
        <select v-model="statusFilter" class="field-control" aria-label="Filter lead status">
          <option value="ALL">All statuses</option>
          <option v-for="status in statusOptions" :key="status" :value="status">{{ formatStatus(status) }}</option>
        </select>
      </label>
      <label>
        <span class="sr-only">Filter lead distance</span>
        <select v-model="distanceFilter" class="field-control" aria-label="Filter lead distance">
          <option value="ALL">Any distance</option>
          <option value="1">Within 1 mi</option>
          <option value="5">Within 5 mi</option>
          <option value="10">Within 10 mi</option>
        </select>
      </label>
    </div>

    <div class="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
      <div class="max-h-[min(62vh,680px)] overflow-auto">
        <table class="w-full table-fixed text-left text-sm">
          <thead class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th class="w-[28%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('address')">Address <span v-if="sortKey === 'address'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[15%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('city')">City <span v-if="sortKey === 'city'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[10%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('opportunityScore')">Score <span v-if="sortKey === 'opportunityScore'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[13%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('capacity')">Capacity <span v-if="sortKey === 'capacity'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[11%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('confidence')">Confidence <span v-if="sortKey === 'confidence'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[10%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('distance')">Distance <span v-if="sortKey === 'distance'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[11%] px-3 py-3"><button class="inline-flex items-center gap-1 font-semibold transition hover:text-slate-900" type="button" @click="sortBy('status')">Status <span v-if="sortKey === 'status'" aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
              <th class="w-[12%] px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            <tr
              v-for="lead in filteredLeads"
              :key="lead.propertyId ?? lead.id"
              class="cursor-pointer transition hover:bg-cyan-50/40"
              :class="selectedPropertyId === leadKey(lead) ? 'bg-cyan-50/70' : ''"
              tabindex="0"
              @click="openLead(lead)"
              @keydown.enter.prevent="openLead(lead)"
            >
              <td class="truncate px-3 py-3 font-semibold text-slate-900" :title="lead.address">{{ leadTitle(lead) }}</td>
              <td class="truncate px-3 py-3 text-slate-600">{{ cityLabel(lead) }}</td>
              <td class="px-3 py-3"><span class="rounded-full bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{{ lead.opportunityScore }}</span></td>
              <td class="px-3 py-3 text-slate-700">{{ formatNumber(lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw) }} kW</td>
              <td class="px-3 py-3 text-slate-700">{{ lead.confidence }}%</td>
              <td class="px-3 py-3 text-slate-600">{{ distanceLabel(lead.distanceMiles) }}</td>
              <td class="px-3 py-3"><span class="inline-flex max-w-full truncate rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" :class="statusClasses(lead.outcome)">{{ formatStatus(lead.outcome) }}</span></td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-1.5">
                  <button class="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700" type="button" @click.stop="openLead(lead)">View</button>
                  <button
                    class="rounded-xl border px-2.5 py-2 text-xs font-semibold transition"
                    :class="isSelected(lead) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200'"
                    type="button"
                    :aria-label="isSelected(lead) ? `Remove ${leadTitle(lead)} from route` : `Add ${leadTitle(lead)} to route`"
                    @click.stop="emit('toggle', lead)"
                  >
                    {{ isSelected(lead) ? "Added" : "Add" }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredLeads.length === 0 && !isScanning">
              <td colspan="8" class="px-4 py-10 text-center">
                <p class="text-sm font-semibold text-slate-900">No leads match this view</p>
                <p class="mt-1 text-sm text-slate-500">Try clearing the local search or status filters.</p>
              </td>
            </tr>
            <template v-if="isScanning">
              <tr v-for="item in 3" :key="`table-skeleton-${item}`" class="animate-pulse">
                <td v-for="cell in 8" :key="cell" class="px-3 py-4"><div class="h-4 rounded-full bg-slate-100" :class="cell === 1 ? 'w-4/5' : 'w-2/3'" /></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-4 grid gap-2 md:hidden">
      <article
        v-for="lead in filteredLeads"
        :key="lead.propertyId ?? lead.id"
        class="rounded-2xl border border-slate-200 bg-white p-4 transition"
        :class="selectedPropertyId === leadKey(lead) ? 'border-cyan-300 bg-cyan-50/40' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <button class="min-w-0 flex-1 text-left" type="button" @click="openLead(lead)">
            <h3 class="truncate text-base font-semibold text-slate-900">{{ leadTitle(lead) }}</h3>
            <p class="mt-1 truncate text-sm text-slate-500">{{ cityLabel(lead) }} · {{ distanceLabel(lead.distanceMiles) }}</p>
          </button>
          <span class="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{{ lead.opportunityScore }}</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div class="rounded-xl bg-slate-50 p-2.5"><span class="block text-slate-500">Capacity</span><strong class="mt-1 block text-slate-900">{{ formatNumber(lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw) }} kW</strong></div>
          <div class="rounded-xl bg-slate-50 p-2.5"><span class="block text-slate-500">Confidence</span><strong class="mt-1 block text-slate-900">{{ lead.confidence }}%</strong></div>
          <div class="rounded-xl bg-slate-50 p-2.5"><span class="block text-slate-500">Status</span><strong class="mt-1 block truncate text-slate-900">{{ formatStatus(lead.outcome) }}</strong></div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="min-h-touch rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" type="button" @click="openLead(lead)">View</button>
          <button
            class="min-h-touch rounded-xl border px-3 py-2 text-sm font-semibold"
            :class="isSelected(lead) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'"
            type="button"
            @click="emit('toggle', lead)"
          >
            {{ isSelected(lead) ? "Added to route" : "Add to route" }}
          </button>
        </div>
      </article>
      <div v-if="filteredLeads.length === 0 && !isScanning" class="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
        <p class="text-sm font-semibold text-slate-900">No leads match this view</p>
        <p class="mt-1 text-sm text-slate-500">Try clearing the local search or status filters.</p>
      </div>
      <template v-if="isScanning">
        <div v-for="item in 3" :key="`mobile-skeleton-${item}`" class="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div class="h-5 w-2/3 rounded-full bg-slate-100" />
          <div class="mt-3 h-4 w-1/2 rounded-full bg-slate-100" />
          <div class="mt-4 grid grid-cols-3 gap-2"><div v-for="cell in 3" :key="cell" class="h-14 rounded-xl bg-slate-50" /></div>
        </div>
      </template>
    </div>

    <div v-if="isScanning" class="mt-3 flex items-center gap-2 px-1 text-xs font-semibold text-slate-500">
      <span class="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
      More leads may appear while the scan continues.
    </div>

    <div v-if="hasMore" class="mt-4 flex flex-col items-center gap-2 border-t border-slate-200 pt-4">
      <button
        class="min-h-touch w-full max-w-xs rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        :disabled="loadingMore"
        @click="emit('loadMore')"
      >
        {{ loadingMore ? "Loading more…" : "Load 20 more leads" }}
      </button>
      <p class="text-xs text-slate-500">{{ loadedCount }} of {{ totalLabel }} currently loaded</p>
    </div>

    <PropertyDetailDrawer
      v-if="selectedPropertyId"
      :property-id="selectedPropertyId"
      :lead-title="selectedLeadTitle"
      :position="selectedPosition"
      :total="filteredLeads.length"
      @close="closeDrawer"
      @previous="selectRelative(-1)"
      @next="selectRelative(1)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { DiscoveryScanLead } from "@solar/contracts";
import PropertyDetailDrawer from "./PropertyDetailDrawer.vue";

type SortKey = "address" | "city" | "opportunityScore" | "capacity" | "confidence" | "distance" | "status";
type SortDirection = "asc" | "desc";

const props = withDefaults(defineProps<{
  leads: DiscoveryScanLead[];
  total?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  isScanning?: boolean;
  selectedIds?: string[];
}>(), {
  total: 0,
  hasMore: false,
  loadingMore: false,
  isScanning: false,
  selectedIds: () => [],
});

const emit = defineEmits<{
  toggle: [lead: DiscoveryScanLead];
  loadMore: [];
}>();

const localSearchQuery = ref("");
const debouncedSearchQuery = ref("");
const statusFilter = ref("ALL");
const distanceFilter = ref("ALL");
const sortKey = ref<SortKey>("opportunityScore");
const sortDirection = ref<SortDirection>("desc");
const selectedPropertyId = ref<string | null>(null);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const statusOptions = computed(() => [...new Set(props.leads.map((lead) => lead.outcome || "NEW"))].sort());
const filteredLeads = computed(() => {
  const query = debouncedSearchQuery.value;
  const maxDistance = distanceFilter.value === "ALL" ? null : Number(distanceFilter.value);
  return [...props.leads]
    .filter((lead) => {
      const searchText = [lead.address, lead.city, lead.state, lead.postalCode, lead.neighborhood, lead.outcome, lead.nextBestAction?.label].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !query || searchText.includes(query);
      const matchesStatus = statusFilter.value === "ALL" || (lead.outcome || "NEW") === statusFilter.value;
      const matchesDistance = maxDistance == null || (lead.distanceMiles != null && lead.distanceMiles <= maxDistance);
      return matchesSearch && matchesStatus && matchesDistance;
    })
    .sort((left, right) => compareLeads(left, right, sortKey.value, sortDirection.value));
});
const loadedCount = computed(() => props.leads.length);
const totalLabel = computed(() => props.total > 0 ? String(props.total) : String(props.leads.length));
const selectedLead = computed(() => filteredLeads.value.find((lead) => leadKey(lead) === selectedPropertyId.value) ?? null);
const selectedPosition = computed(() => {
  if (!selectedLead.value) return 1;
  return filteredLeads.value.findIndex((lead) => leadKey(lead) === selectedPropertyId.value) + 1;
});
const selectedLeadTitle = computed(() => selectedLead.value ? leadTitle(selectedLead.value) : null);

watch(localSearchQuery, (value) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = value.trim().toLowerCase();
  }, 180);
});

watch(filteredLeads, (leads) => {
  if (selectedPropertyId.value && !leads.some((lead) => leadKey(lead) === selectedPropertyId.value)) {
    selectedPropertyId.value = null;
  }
});

onBeforeUnmount(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
});

function openLead(lead: DiscoveryScanLead) {
  selectedPropertyId.value = leadKey(lead);
}

function closeDrawer() {
  selectedPropertyId.value = null;
}

function selectRelative(offset: -1 | 1) {
  const currentIndex = filteredLeads.value.findIndex((lead) => leadKey(lead) === selectedPropertyId.value);
  const nextLead = filteredLeads.value[currentIndex + offset];
  if (nextLead) selectedPropertyId.value = leadKey(nextLead);
}

function sortBy(nextKey: SortKey) {
  if (sortKey.value === nextKey) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = nextKey;
  sortDirection.value = nextKey === "address" || nextKey === "city" || nextKey === "status" ? "asc" : "desc";
}

function isSelected(lead: DiscoveryScanLead) {
  return props.selectedIds.includes(leadKey(lead));
}

function leadKey(lead: DiscoveryScanLead) {
  return lead.propertyId ?? lead.id;
}

function leadTitle(lead: DiscoveryScanLead) {
  return lead.address?.split(",")[0]?.trim() || "Address unavailable";
}

function cityLabel(lead: DiscoveryScanLead) {
  return [lead.city, lead.state].filter(Boolean).join(", ") || lead.neighborhood || "Location unavailable";
}

function formatStatus(status?: string | null) {
  return (status || "NEW").replaceAll("_", " ");
}

function statusClasses(status?: string | null) {
  switch (status) {
    case "APPOINTMENT_BOOKED":
      return "bg-emerald-50 text-emerald-700";
    case "NOT_INTERESTED":
      return "bg-slate-100 text-slate-500";
    case "REVISIT":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-cyan-50 text-cyan-700";
  }
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "--" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function distanceLabel(distance: number | null | undefined) {
  return distance == null ? "--" : `${distance.toFixed(1)} mi`;
}

function compareLeads(left: DiscoveryScanLead, right: DiscoveryScanLead, key: SortKey, direction: SortDirection) {
  const values: Record<SortKey, [string | number, string | number]> = {
    address: [left.address || "", right.address || ""],
    city: [cityLabel(left), cityLabel(right)],
    opportunityScore: [left.opportunityScore ?? 0, right.opportunityScore ?? 0],
    capacity: [left.maxRoofSolarCapacityKw ?? left.maxSystemKw ?? -1, right.maxRoofSolarCapacityKw ?? right.maxSystemKw ?? -1],
    confidence: [left.confidence ?? 0, right.confidence ?? 0],
    distance: [left.distanceMiles ?? Number.POSITIVE_INFINITY, right.distanceMiles ?? Number.POSITIVE_INFINITY],
    status: [formatStatus(left.outcome), formatStatus(right.outcome)],
  };
  const [leftValue, rightValue] = values[key];
  const comparison = typeof leftValue === "number" && typeof rightValue === "number"
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue));
  return direction === "asc" ? comparison : -comparison;
}
</script>
