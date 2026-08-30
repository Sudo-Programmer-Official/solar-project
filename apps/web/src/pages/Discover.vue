<template>
  <main class="px-4 pb-4">
    <MobileHeader eyebrow="BLACKOPS FIELD" title="Discover" subtitle="Ranked neighborhoods and ranked properties." >
      <template #action>
        <DataQualityBadge :label="loading ? 'Loading' : 'Ready'" :tone="loading ? 'warn' : 'good'" />
      </template>
    </MobileHeader>

    <section class="page-surface p-4">
      <p class="field-label">Current context</p>
      <p class="mt-1 text-lg font-semibold text-slate-900">{{ searchContextStore.contextLabel || "Choose a location" }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ searchContextStore.radiusMiles }} mi radius</p>
    </section>

    <section class="mt-4 grid gap-4">
      <LoadingCard v-if="loading" />

      <section v-else class="space-y-4">
        <div class="page-surface p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="field-label">Ranked Neighborhoods</p>
              <p class="mt-1 text-sm text-slate-500">High-value territory with the cleanest signal mix.</p>
            </div>
            <span class="text-xs font-semibold tracking-[0.08em] text-slate-500">{{ rankedNeighborhoodCards.length }}</span>
          </div>

          <div class="mt-4 grid gap-3">
            <article v-for="market in rankedNeighborhoodCards" :key="market.id" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="field-label">{{ market.geographyType.replaceAll("_", " ") }}</p>
                  <h3 class="mt-1 text-lg font-semibold text-slate-900">{{ market.name }}</h3>
                  <p class="mt-1 text-sm text-slate-500">{{ market.currentLocationLabel }}</p>
                </div>
                <div class="rounded-2xl border border-whale-200 bg-whale-50 px-3 py-2 text-whale-600">
                  {{ market.marketScore }}
                </div>
              </div>
            </article>
          </div>
        </div>

        <div class="page-surface p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="field-label">Ranked Properties</p>
              <p class="mt-1 text-sm text-slate-500">Filtered by the shared global filter drawer.</p>
            </div>
            <span class="text-xs font-semibold tracking-[0.08em] text-slate-500">{{ rankedPropertyCards.length }}</span>
          </div>

          <div class="mt-4 grid gap-4">
            <LeadCard
              v-for="lead in rankedPropertyCards"
              :key="lead.id"
              :lead="lead"
              :selected="selectedIds.has(lead.propertyId ?? lead.id)"
              @navigate="navigateToLead(lead)"
              @toggle="toggleLead(lead)"
              @open="openProperty(lead)"
            />
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { TodayLeadCard } from "@solar/contracts";
import { useTerritoryStore } from "../stores/territory.store";
import { useLeadActions } from "../composables/useLeadActions";
import { useSearchContextStore } from "../stores/search-context.store";
import { useHuntStore } from "../stores/hunt.store";
import MobileHeader from "../components/MobileHeader.vue";
import LoadingCard from "../components/LoadingCard.vue";
import DataQualityBadge from "../components/DataQualityBadge.vue";
import LeadCard from "../components/LeadCard.vue";

const router = useRouter();
const territoryStore = useTerritoryStore();
const searchContextStore = useSearchContextStore();
const hunt = useHuntStore();
const { neighborhoods, properties, loading, radiusMiles } = storeToRefs(territoryStore);
const { updateOutcome, openDirections } = useLeadActions();
const selectedIds = computed(() => new Set(hunt.selectedPropertyIds));

const rankedPropertyCards = computed(() => {
  return properties.value
    .filter((lead) => matchesFilters(lead))
    .slice()
    .sort((left, right) => right.opportunityScore - left.opportunityScore);
});

const rankedNeighborhoodCards = computed(() => {
  return neighborhoods.value
    .slice()
    .sort((left, right) => right.marketScore - left.marketScore)
    .filter((market) => market.radiusMiles <= searchContextStore.radiusMiles);
});

onMounted(syncAndLoad);

watch(
  () => searchContextStore.radiusMiles,
  () => {
    void syncAndLoad();
  },
);

watch(
  () => searchContextStore.filters,
  () => {
    void syncAndLoad();
  },
  { deep: true },
);

watch(
  () => searchContextStore.context,
  () => {
    void syncAndLoad();
  },
  { deep: true },
);

async function syncAndLoad() {
  radiusMiles.value = searchContextStore.radiusMiles;
  await territoryStore.loadNeighborhoods();
}

function matchesFilters(lead: TodayLeadCard) {
  const reasons = lead.reasons.join(" ").toLowerCase();
  const signals = lead.signals.join(" ").toLowerCase();
  const roof = lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw ?? null;
  const filters = searchContextStore.filters;

  if (filters.whaleCandidates && lead.whaleScore < 60) return false;
  if (filters.highPriority && lead.opportunityScore < 70) return false;
  if (filters.revisit && lead.outcome !== "REVISIT" && lead.outcome !== "NOT_HOME" && lead.outcome !== "BILL_REQUESTED") return false;
  if (filters.minimumSystemKw != null && roof != null && roof < filters.minimumSystemKw) return false;
  if (filters.poolDetected && !hasDetectedVisualSignal(lead, "POOL")) return false;
  if (filters.largeRoof && !hasLargeRoofSignal(lead)) return false;
  if (filters.lowShade && !hasDetectedVisualSignal(lead, "LOW_SHADE")) return false;
  if (filters.largeLot && !hasDetectedVisualSignal(lead, "LARGE_LOT")) return false;
  if (filters.recentRoofPermit && !signals.includes("recent roof permit")) return false;
  if (filters.noDetectedSolar && lead.existingSolarStatus !== "NOT_DETECTED") return false;
  if (filters.largeProperty && !(reasons.includes("large roof") || (roof != null && roof >= 15))) return false;
  if (filters.highValueArea && !reasons.includes("high-value area")) return false;
  return true;
}

function hasDetectedVisualSignal(lead: TodayLeadCard, type: NonNullable<NonNullable<TodayLeadCard["visualSignals"]>[number]["type"]>): boolean {
  return lead.visualSignals?.some((signal) => signal.type === type && signal.status === "DETECTED") ?? false;
}

function hasLargeRoofSignal(lead: TodayLeadCard): boolean {
  const roof = lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw ?? null;
  if (roof != null && roof >= 15) {
    return true;
  }
  return hasDetectedVisualSignal(lead, "LARGE_ROOF");
}

function navigateToLead(lead: TodayLeadCard) {
  if (lead.latitude != null && lead.longitude != null) {
    openDirections(lead.latitude, lead.longitude);
    return;
  }
  openProperty(lead);
}

function openProperty(lead: TodayLeadCard) {
  router.push(`/properties/${lead.propertyId ?? encodeURIComponent(lead.address)}`);
}

function toggleLead(lead: TodayLeadCard) {
  hunt.selectLead(lead.propertyId ?? lead.id);
}

async function markNotHome(lead: TodayLeadCard) {
  const propertyId = lead.propertyId ?? encodeURIComponent(lead.address);
  await updateOutcome(propertyId, "NOT_HOME");
  await syncAndLoad();
}
</script>
