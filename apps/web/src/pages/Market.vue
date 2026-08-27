<template>
  <main class="px-4 pb-4">
    <MobileHeader eyebrow="SolarScout" title="Market" subtitle="Where should our sales team work next?">
      <template #action>
        <DataQualityBadge label="Demo data" tone="warn" />
      </template>
    </MobileHeader>

    <section class="page-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">Shared context</p>
          <h2 class="mt-2 text-lg font-semibold text-slate-900">
            {{ searchContextStore.contextLabel || "Choose a location" }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ searchContextStore.radiusMiles }} mi radius · {{ days }} day activity
          </p>
        </div>
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Fixture/demo market signals
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="option in radiusOptions"
          :key="option"
          class="touch-target rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition"
          :class="searchContextStore.radiusMiles === option ? 'border-primary-300 bg-primary-50 text-slate-900' : 'border-slate-200 bg-white text-slate-700'"
          @click="setRadius(option)"
        >
          {{ option }} mi
        </button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="option in dayOptions"
          :key="option"
          class="touch-target rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition"
          :class="days === option ? 'border-primary-300 bg-primary-50 text-slate-900' : 'border-slate-200 bg-white text-slate-700'"
          @click="days = option"
        >
          {{ option }} day
        </button>
      </div>
    </section>

    <section class="mt-4">
      <PropertyVisual
        mode="map"
        :center-latitude="centerLatitude"
        :center-longitude="centerLongitude"
        :points="hotspotPoints"
        :title="selectedArea?.name ?? 'Hot areas'"
        :subtitle="selectedArea ? selectedArea.whyHot[0] : 'Tap a hotspot to see why it is hot.'"
        provider-label="Fixture demo"
        @point-click="selectArea"
      />
    </section>

    <section class="mt-4 page-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="field-label">Hot areas</p>
          <p class="mt-1 text-sm text-slate-500">Ranked by market score, activity, and data confidence.</p>
        </div>
        <span class="text-xs font-semibold tracking-[0.08em] text-slate-500">{{ hotspots.length }}</span>
      </div>

      <div v-if="loading" class="mt-4 grid gap-3">
        <LoadingCard v-for="item in 3" :key="item" />
      </div>

      <div v-else class="mt-4 grid gap-3">
        <article
          v-for="area in hotspots"
          :key="area.id"
          class="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
          :class="selectedAreaId === area.id ? 'ring-2 ring-primary-200' : ''"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="field-label">{{ area.geographyType.replaceAll("_", " ") }}</p>
              <h3 class="mt-1 text-lg font-semibold text-slate-900">{{ area.name }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ area.currentLocationLabel }}</p>
            </div>
            <div class="rounded-2xl border px-3 py-2 text-sm font-semibold" :class="scoreTone(area.marketScore)">
              {{ area.marketScore }}
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="reason in area.whyHot"
              :key="reason"
              class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {{ reason }}
            </span>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Roof permits</span>
              <strong class="mt-1 block text-slate-900">{{ area.counts.roofPermits }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Solar permits</span>
              <strong class="mt-1 block text-slate-900">{{ area.counts.solarPermits }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">New construction</span>
              <strong class="mt-1 block text-slate-900">{{ area.counts.newConstruction }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Large properties</span>
              <strong class="mt-1 block text-slate-900">{{ area.largePropertyCount }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Solar saturation</span>
              <strong class="mt-1 block text-slate-900">{{ area.solarSaturationScore }}/100</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Confidence</span>
              <strong class="mt-1 block text-slate-900">{{ area.coverage.confidence }}/100</strong>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <DataQualityBadge :label="area.coverage.level" :tone="coverageTone(area.coverage.level)" />
            <span class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Momentum {{ area.solarMomentumScore }}
            </span>
          </div>

          <div class="mt-4 flex gap-2">
            <button class="touch-target flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="focusMap(area.id)">
              View Map
            </button>
            <button class="touch-target flex-1 rounded-2xl bg-primary-500 px-3 py-3 text-sm font-semibold text-white shadow-sm" @click="huntArea(area.id)">
              Hunt Area
            </button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="selectedArea" class="mt-4 page-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">Area details</p>
          <h3 class="mt-2 text-lg font-semibold text-slate-900">{{ selectedArea.name }}</h3>
          <p class="mt-1 text-sm text-slate-500">{{ selectedArea.label }}</p>
        </div>
        <button
          class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-50"
          :disabled="eventsLoading || nextCursor == null"
          @click="loadMoreEvents"
        >
          {{ nextCursor == null ? "All activity loaded" : (eventsLoading ? "Loading..." : "More activity") }}
        </button>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Whale opportunities</span>
          <strong class="mt-1 block text-slate-900">{{ selectedArea.leadOpportunityCounts.whales }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">High priority</span>
          <strong class="mt-1 block text-slate-900">{{ selectedArea.leadOpportunityCounts.highPriority }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Data coverage</span>
          <strong class="mt-1 block text-slate-900">{{ selectedArea.coverage.level }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Signal confidence</span>
          <strong class="mt-1 block text-slate-900">{{ selectedArea.coverage.confidence }}/100</strong>
        </div>
      </div>

      <div class="mt-4">
        <p class="field-label">Score breakdown</p>
        <div class="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Roof activity</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.roofActivity }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Construction</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.constructionActivity }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Solar momentum</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.solarMomentum }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Solar saturation</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.solarSaturation }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Large-property density</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.largePropertyDensity }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">High-capacity roofs</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.highCapacityRoofDensity }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Property value</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.propertyValueSignal }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Electrical upgrades</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.electricalUpgradeActivity }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3 col-span-2">
            <span class="text-slate-500">Data confidence</span>
            <strong class="mt-1 block text-slate-900">{{ selectedArea.scoreBreakdown.dataConfidence }}/100</strong>
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <span
          v-for="signal in selectedArea.coverage.availableSignals"
          :key="signal"
          class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
        >
          {{ signal }}
        </span>
        <span
          v-for="signal in selectedArea.coverage.missingSignals"
          :key="signal"
          class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
        >
          Missing: {{ signal }}
        </span>
      </div>

      <div class="mt-4">
        <p class="field-label">Recent activity</p>
        <div class="mt-2 grid gap-2">
          <article v-for="event in recentEvents" :key="event.id" class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">{{ event.address ?? "Location unavailable" }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ event.type.replaceAll("_", " ") }} · {{ event.status ?? "UNKNOWN" }}</p>
              </div>
              <span class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-600">
                {{ event.estimatedValue != null ? `$${formatNumber(event.estimatedValue)}` : "N/A" }}
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import type { MarketAreaDetail, MarketAreaSummary, MarketEvent } from "@solar/contracts";
import { getMarketArea, getMarketEvents, getMarketHotspots } from "../services/api";
import { useSearchContextStore } from "../stores/search-context.store";
import { useHuntStore } from "../stores/hunt.store";
import MobileHeader from "../components/MobileHeader.vue";
import DataQualityBadge from "../components/DataQualityBadge.vue";
import LoadingCard from "../components/LoadingCard.vue";
import PropertyVisual, { type PropertyVisualPoint } from "../components/PropertyVisual.vue";

const router = useRouter();
const searchContextStore = useSearchContextStore();
const hunt = useHuntStore();

const radiusOptions = [5, 10, 20] as const;
const dayOptions = [30, 60, 90] as const;
const days = ref<(typeof dayOptions)[number]>(60);
const loading = ref(false);
const hotspots = ref<MarketAreaSummary[]>([]);
const selectedAreaId = ref<string | null>(null);
const selectedArea = ref<MarketAreaDetail | null>(null);
const recentEvents = ref<MarketEvent[]>([]);
const nextCursor = ref<string | null>(null);
const eventsLoading = ref(false);

const centerLatitude = computed(() => searchContextStore.context?.latitude ?? 40.2107);
const centerLongitude = computed(() => searchContextStore.context?.longitude ?? -79.7683);

const hotspotPoints = computed<PropertyVisualPoint[]>(() =>
  hotspots.value.map((area) => ({
    id: area.id,
    latitude: area.centerLatitude,
    longitude: area.centerLongitude,
    kind: "cluster",
    tone: toneFromScore(area.marketScore),
    count: Math.max(1, Math.round(area.marketScore)),
    label: area.name,
  })),
);

onMounted(() => {
  void loadHotspots();
});

watch(
  () => [searchContextStore.context?.latitude, searchContextStore.context?.longitude, searchContextStore.radiusMiles, days.value],
  () => {
    void loadHotspots();
  },
);

async function loadHotspots() {
  if (searchContextStore.context == null) {
    hotspots.value = [];
    selectedArea.value = null;
    selectedAreaId.value = null;
    recentEvents.value = [];
    return;
  }
  loading.value = true;
  try {
    const response = await getMarketHotspots({
      latitude: centerLatitude.value,
      longitude: centerLongitude.value,
      radiusMiles: searchContextStore.radiusMiles,
      days: days.value,
    });
    hotspots.value = response?.areas ?? [];
    if (!selectedAreaId.value || !hotspots.value.some((area) => area.id === selectedAreaId.value)) {
      selectedAreaId.value = hotspots.value[0]?.id ?? null;
    }
    if (selectedAreaId.value) {
      await loadArea(selectedAreaId.value, true);
    } else {
      selectedArea.value = null;
      recentEvents.value = [];
    }
  } catch {
    ElMessage.error("Unable to load market areas");
  } finally {
    loading.value = false;
  }
}

async function loadArea(id: string, resetEvents = true) {
  try {
    const area = await getMarketArea(id);
    if (!area) {
      return;
    }
    selectedArea.value = area;
    selectedAreaId.value = area.id;
    if (resetEvents) {
      recentEvents.value = area.recentActivity.slice(0, 4);
      nextCursor.value = recentEvents.value.length < area.recentActivity.length ? String(recentEvents.value.length) : null;
    }
  } catch {
    ElMessage.error("Unable to load market details");
  }
}

async function loadMoreEvents() {
  if (!selectedAreaId.value || eventsLoading.value || nextCursor.value == null) return;
  eventsLoading.value = true;
  try {
    const page = await getMarketEvents(selectedAreaId.value, nextCursor.value, 4);
    if (!page) {
      ElMessage.error("Unable to load activity");
      return;
    }
    recentEvents.value = [...recentEvents.value, ...page.results];
    nextCursor.value = page.nextCursor;
  } catch {
    ElMessage.error("Unable to load activity");
  } finally {
    eventsLoading.value = false;
  }
}

function selectArea(id: string) {
  selectedAreaId.value = id;
  void loadArea(id);
}

function focusMap(id: string) {
  selectArea(id);
}

async function huntArea(id: string) {
  const area = hotspots.value.find((item) => item.id === id);
  if (!area) return;
  searchContextStore.setContext({
    type: "AREA",
    label: area.label,
    latitude: area.centerLatitude,
    longitude: area.centerLongitude,
    placeId: area.id,
  });
  void hunt.runScan({ latitude: area.centerLatitude, longitude: area.centerLongitude }, { radiusMiles: searchContextStore.radiusMiles });
  await router.push("/labs/lead-finder");
}

function setRadius(value: 5 | 10 | 20) {
  searchContextStore.setRadiusMiles(value);
}

function scoreTone(score: number) {
  if (score >= 90) return "border-amber-200 bg-amber-50 text-amber-700";
  if (score >= 80) return "border-primary-200 bg-primary-50 text-primary-700";
  if (score >= 65) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function coverageTone(level: MarketAreaSummary["coverage"]["level"]) {
  if (level === "HIGH") return "good";
  if (level === "MEDIUM") return "warn";
  return "warn";
}

function toneFromScore(score: number): PropertyVisualPoint["tone"] {
  if (score >= 90) return "gold";
  if (score >= 80) return "green";
  if (score >= 65) return "blue";
  return "gray";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
</script>
