<template>
  <main class="px-3 pb-4 sm:px-4">
    <MobileHeader eyebrow="BLACKOPS FIELD · OPPORTUNITY ROUTE" title="Hood Navigator" subtitle="Plan the pocket before you knock the first door.">
      <template #action>
        <button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm" type="button" @click="goToHunt">
          Hunt results
        </button>
      </template>
    </MobileHeader>

    <section class="page-surface mt-3 p-3 sm:p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="field-label">Current hood</p>
          <h1 class="mt-1 truncate text-base font-semibold text-slate-900">{{ contextLabel }}</h1>
          <p class="mt-1 text-xs text-slate-500">{{ leads.length }} mapped discovery results · cluster-first planning</p>
        </div>
        <button class="touch-target shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="refreshRepLocation">
          {{ locationLoading ? "Locating…" : "Use my location" }}
        </button>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-2xl bg-slate-50 p-3"><span class="text-[11px] text-slate-500">Hood score</span><strong class="mt-1 block text-xl text-slate-900">{{ hoodScore }}</strong></div>
        <div class="rounded-2xl bg-slate-50 p-3"><span class="text-[11px] text-slate-500">Strong leads</span><strong class="mt-1 block text-xl text-slate-900">{{ strongLeadCount }}</strong></div>
        <div class="rounded-2xl bg-slate-50 p-3"><span class="text-[11px] text-slate-500">Whale candidates</span><strong class="mt-1 block text-xl text-slate-900">{{ whaleCount }}</strong></div>
        <div class="rounded-2xl bg-slate-50 p-3"><span class="text-[11px] text-slate-500">Good clusters</span><strong class="mt-1 block text-xl text-slate-900">{{ goodClusterCount }}</strong></div>
      </div>
      <p class="mt-3 text-xs text-slate-500">{{ lowEfficiencyZoneCount }} low-efficiency zone{{ lowEfficiencyZoneCount === 1 ? "" : "s" }} · operational labels only</p>
    </section>

    <section v-if="leads.length > 0" class="mt-3">
      <OpportunityRouteMap
        :current-location="repLocation"
        :leads="mapLeads"
        :clusters="mapClusters"
        :zones="mapZones"
        :route="mapRoute"
        :selected-id="selectedId"
        @select-cluster="selectCluster"
        @select-lead="selectLead"
      />
    </section>

    <section v-else class="page-surface mt-3 p-6 text-center">
      <p class="text-base font-semibold text-slate-900">Run a discovery scan to open the hood.</p>
      <p class="mt-2 text-sm leading-6 text-slate-500">Hood Navigator sits on top of discovery results, so it only uses the properties and clusters already returned by Hunt.</p>
      <button class="touch-target mt-5 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm" type="button" @click="goToHunt">Find opportunities in Hunt</button>
    </section>

    <section v-if="leads.length > 0" class="mt-3">
      <div class="mb-2 flex items-end justify-between gap-3 px-1">
        <div><p class="field-label">Route options</p><p class="mt-1 text-sm text-slate-500">Simple cluster-first nearest-neighbor heuristic</p></div>
        <span class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500">door time {{ doorTimeMinutes.toFixed(1) }} min</span>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <button v-for="route in routes" :key="route.mode" class="page-surface p-4 text-left transition" :class="route.mode === selectedMode ? 'border-primary-300 ring-2 ring-primary-100' : 'hover:border-slate-300'" type="button" @click="selectedMode = route.mode">
          <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-900">{{ route.label }}</p><p class="mt-1 text-xs leading-5 text-slate-500">{{ route.description }}</p></div><span class="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-800">{{ route.expectedOpportunityPerRepHour }}/hr</span></div>
          <div class="mt-4 grid grid-cols-4 gap-2 text-xs"><div><span class="block text-slate-400">Homes</span><strong class="mt-1 block text-slate-800">{{ route.stops.length }}</strong></div><div><span class="block text-slate-400">Miles</span><strong class="mt-1 block text-slate-800">{{ route.distanceMiles.toFixed(1) }}</strong></div><div><span class="block text-slate-400">Time</span><strong class="mt-1 block text-slate-800">{{ route.estimatedMinutes }}m</strong></div><div><span class="block text-slate-400">Priority</span><strong class="mt-1 block text-slate-800">{{ route.highPriorityCount }}</strong></div></div>
          <p class="mt-3 text-xs font-semibold text-slate-500">{{ route.whaleCount }} whale candidate{{ route.whaleCount === 1 ? "" : "s" }}</p>
          <span class="mt-4 inline-flex min-h-touch items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{{ route.mode === selectedMode ? "Selected route" : "Select route" }}</span>
        </button>
      </div>
    </section>

    <section v-if="leads.length > 0" class="page-surface mt-3 p-4">
      <div class="flex items-center justify-between gap-3"><div><p class="field-label">Clusters worth working</p><p class="mt-1 text-sm text-slate-500">Start with the best pocket, then work properties inside it.</p></div><span class="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{{ clusters.length }} pockets</span></div>
      <div class="mt-3 grid gap-2">
        <button v-for="cluster in sortedClusters" :key="cluster.clusterId" class="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary-300" type="button" @click="selectCluster(cluster.clusterId)">
          <div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-900">{{ cluster.propertyCount }} homes · {{ clusterLabel(cluster) }}</p><p class="mt-1 text-xs text-slate-500">{{ cluster.strongLeadCount }} strong · {{ cluster.whaleCount }} whales · avg {{ formatCapacity(cluster.averageCapacityKw) }} kW</p></div><span class="rounded-full px-2 py-1 text-[10px] font-bold" :class="efficiencyTone(cluster.fieldEfficiencyScore)">{{ cluster.fieldEfficiencyScore }} efficiency</span></div>
          <div class="mt-3 flex flex-wrap gap-1.5"><span v-for="label in cluster.lowEfficiencyZones ?? []" :key="label" class="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">{{ label.replaceAll("_", " ") }}</span><span v-if="(cluster.lowEfficiencyZones ?? []).length === 0" class="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Good field fit</span></div>
        </button>
      </div>
    </section>

    <section v-if="activeRoute && activeStop" class="fixed inset-x-0 bottom-[5.25rem] z-40 px-3 sm:px-4">
      <div class="page-surface mx-auto max-w-2xl p-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label">Stop {{ activeStop.sequence }} · {{ activeRoute.label }}</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ activeStop.lead.address }}</h2><p class="mt-1 text-sm text-slate-500">{{ activeStop.distanceMilesFromPrevious.toFixed(1) }} mi · score {{ activeStop.lead.opportunityScore }} · {{ activeRoute.stops.length }} remaining</p></div><button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="stopRoute">Stop</button></div>
        <div class="mt-3 grid grid-cols-3 gap-2"><button class="touch-target rounded-2xl bg-primary-500 px-3 py-3 text-sm font-semibold text-white" type="button" @click="navigateToActiveStop">Navigate</button><button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700" type="button" @click="completeActiveStop('NOT_HOME')">Outcome</button><button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700" type="button" @click="skipActiveStop">Skip</button></div>
      </div>
    </section>

    <section v-if="selectedCluster || selectedLead" class="fixed inset-x-0 bottom-[5.25rem] z-30 px-3 sm:px-4" :class="activeRoute ? 'pb-28' : ''">
      <div class="page-surface mx-auto max-w-2xl p-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label">{{ selectedCluster ? "Selected cluster" : "Selected property" }}</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ selectedCluster ? clusterLabel(selectedCluster) : selectedLead?.address }}</h2><p class="mt-1 text-sm text-slate-500">{{ selectedCluster ? `${selectedCluster.propertyCount} homes · ${selectedCluster.estimatedMinutes} min estimated` : `Score ${selectedLead?.opportunityScore ?? "--"} · ${selectedLead?.maxRoofSolarCapacityKw?.toFixed(1) ?? "--"} kW potential` }}</p></div><button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="clearSelection">Close</button></div>
        <div v-if="selectedCluster" class="mt-3 grid grid-cols-4 gap-2 text-xs"><div class="rounded-xl bg-slate-50 p-2"><span class="block text-slate-400">Homes</span><strong class="mt-1 block">{{ selectedCluster.propertyCount }}</strong></div><div class="rounded-xl bg-slate-50 p-2"><span class="block text-slate-400">Strong</span><strong class="mt-1 block">{{ selectedCluster.strongLeadCount }}</strong></div><div class="rounded-xl bg-slate-50 p-2"><span class="block text-slate-400">Whales</span><strong class="mt-1 block">{{ selectedCluster.whaleCount }}</strong></div><div class="rounded-xl bg-slate-50 p-2"><span class="block text-slate-400">Avg kW</span><strong class="mt-1 block">{{ formatCapacity(selectedCluster.averageCapacityKw) }}</strong></div></div>
        <p v-if="selectedCluster" class="mt-3 text-xs leading-5 text-slate-500">Field efficiency {{ selectedCluster.fieldEfficiencyScore }}/100 · terrain {{ selectedCluster.terrainScore }}/100 · {{ selectedCluster.estimatedMinutes }} minutes estimated with {{ doorTimeMinutes.toFixed(1) }} minutes per attempted door.</p>
        <div v-if="selectedLead" class="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
          <span v-if="selectedDetailLoading">Loading property detail…</span>
          <span v-else-if="selectedDetail">{{ selectedDetail.stage.replaceAll("_", " ") }} · {{ selectedDetail.billSummary }}</span>
          <span v-else>Property detail is unavailable; the mapped lead summary remains available.</span>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2"><button v-if="selectedCluster" class="touch-target rounded-2xl bg-primary-500 px-3 py-3 text-sm font-semibold text-white" type="button" @click="startAtCluster(selectedCluster.clusterId)">Start here</button><button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700" type="button" @click="startSelectedRoute">{{ selectedCluster ? "Add to route" : "Start route" }}</button><button v-if="selectedLead" class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700" type="button" @click="navigateToLead(selectedLead)">Navigate</button><button v-else class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700" type="button" @click="clearSelection">Keep map</button></div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { DealBrief, DiscoveryScanLead, LeadOutcome } from "@solar/contracts";
import MobileHeader from "../components/MobileHeader.vue";
import OpportunityRouteMap, { type OpportunityMapCluster, type OpportunityMapLead, type OpportunityMapZone } from "../components/OpportunityRouteMap.vue";
import { useCurrentLocation } from "../composables/useCurrentLocation";
import { useLeadActions } from "../composables/useLeadActions";
import { buildNavigatorClusters, buildNavigatorRoutes, type NavigatorCluster, type NavigatorRoute, type OpportunityRouteMode } from "../features/hood-navigator";
import { useHuntStore } from "../stores/hunt.store";
import { useSearchContextStore } from "../stores/search-context.store";
import { getPropertyBrief } from "../services/api";

const router = useRouter();
const hunt = useHuntStore();
const searchStore = useSearchContextStore();
const currentLocation = useCurrentLocation();
const { openDirections, updateOutcome } = useLeadActions();
const { scanResults: scanResultsRef, scan: scanRef, lastLatitude, lastLongitude } = storeToRefs(hunt);

const selectedId = ref<string | null>(null);
const selectedMode = ref<OpportunityRouteMode>("BEST_OVERALL");
const routeStarted = ref(false);
const preferredClusterId = ref<string | null>(null);
const completedIds = ref(new Set<string>());
const skippedIds = ref(new Set<string>());
const routeOrigin = ref<{ latitude: number; longitude: number } | null>(null);
const selectedDetail = ref<DealBrief | null>(null);
const selectedDetailLoading = ref(false);
const doorTimeMinutes = 2.5;

const leads = computed(() => scanResultsRef.value.filter((lead) => lead.latitude != null && lead.longitude != null));
const contextLabel = computed(() => searchStore.contextLabel || "Selected discovery area");
const scanCenter = computed(() => ({ latitude: lastLatitude.value ?? searchStore.context?.latitude ?? scanRef.value?.center.latitude ?? 40.2108, longitude: lastLongitude.value ?? searchStore.context?.longitude ?? scanRef.value?.center.longitude ?? -79.7665 }));
const repLocation = computed(() => currentLocation.latitude.value != null && currentLocation.longitude.value != null ? { latitude: currentLocation.latitude.value, longitude: currentLocation.longitude.value } : scanCenter.value);
const clusters = computed<NavigatorCluster[]>(() => buildNavigatorClusters(leads.value, scanRef.value?.clusters, scanCenter.value));
const activeClusters = computed(() => clusters.value.map((cluster) => ({ ...cluster, leads: cluster.leads.filter((lead) => !completedIds.value.has(lead.propertyId ?? lead.id) && !skippedIds.value.has(lead.propertyId ?? lead.id)) })).filter((cluster) => cluster.leads.length > 0));
const routes = computed(() => buildNavigatorRoutes(activeClusters.value, routeOrigin.value ?? repLocation.value, doorTimeMinutes, preferredClusterId.value ?? undefined));
const activeRoute = computed<NavigatorRoute | null>(() => routeStarted.value ? routes.value.find((route) => route.mode === selectedMode.value) ?? null : null);
const activeStop = computed(() => activeRoute.value?.stops[0] ?? null);
const selectedCluster = computed(() => clusters.value.find((cluster) => cluster.clusterId === selectedId.value) ?? null);
const selectedLead = computed(() => leads.value.find((lead) => (lead.propertyId ?? lead.id) === selectedId.value) ?? null);
const sortedClusters = computed(() => [...clusters.value].sort((left, right) => right.fieldPriorityScore - left.fieldPriorityScore));
const strongLeadCount = computed(() => leads.value.filter((lead) => lead.opportunityScore >= 70).length);
const whaleCount = computed(() => leads.value.filter((lead) => lead.whaleScore >= 60).length);
const hoodScore = computed(() => Math.round(average(clusters.value.map((cluster) => cluster.fieldPriorityScore)) || average(leads.value.map((lead) => lead.opportunityScore))));
const goodClusterCount = computed(() => clusters.value.filter((cluster) => cluster.fieldPriorityScore >= 65 && cluster.fieldEfficiencyScore >= 55).length);
const lowEfficiencyZoneCount = computed(() => clusters.value.filter((cluster) => (cluster.lowEfficiencyZones ?? []).length > 0).length);
const locationLoading = computed(() => currentLocation.loading.value);

const mapLeads = computed<OpportunityMapLead[]>(() => leads.value.map((lead) => ({ id: lead.propertyId ?? lead.id, latitude: lead.latitude ?? 0, longitude: lead.longitude ?? 0, opportunityScore: lead.opportunityScore, status: lead.outcome })));
const mapClusters = computed<OpportunityMapCluster[]>(() => clusters.value.map((cluster) => ({ id: cluster.clusterId, latitude: cluster.center.latitude, longitude: cluster.center.longitude, propertyCount: cluster.propertyCount, fieldPriorityScore: cluster.fieldPriorityScore })));
const mapZones = computed<OpportunityMapZone[]>(() => clusters.value.flatMap((cluster) => (cluster.lowEfficiencyZones ?? []).map((label, index) => ({ id: `${cluster.clusterId}-${label}-${index}`, label, latitude: cluster.center.latitude, longitude: cluster.center.longitude, radiusMiles: 0.14 + index * 0.04 }))));
const mapRoute = computed(() => activeRoute.value ? [repLocation.value, ...activeRoute.value.stops.map((stop) => ({ latitude: stop.lead.latitude ?? 0, longitude: stop.lead.longitude ?? 0 }))] : []);

onMounted(() => searchStore.hydrate());

function selectCluster(clusterId: string) { selectedId.value = clusterId; }
function selectLead(leadId: string) { selectedId.value = leadId; void loadLeadDetail(leadId); }
function clearSelection() { selectedId.value = null; }
function startSelectedRoute() { preferredClusterId.value = null; routeOrigin.value = repLocation.value; routeStarted.value = true; selectedId.value = null; }
function startAtCluster(clusterId: string) { preferredClusterId.value = clusterId; routeOrigin.value = repLocation.value; routeStarted.value = true; selectedId.value = null; }
function stopRoute() { routeStarted.value = false; preferredClusterId.value = null; completedIds.value = new Set(); skippedIds.value = new Set(); routeOrigin.value = null; }
function navigateToActiveStop() { if (activeStop.value) navigateToLead(activeStop.value.lead); }
function navigateToLead(lead: DiscoveryScanLead) { openDirections(lead.latitude, lead.longitude); }

async function loadLeadDetail(leadId: string) {
  const lead = leads.value.find((item) => (item.propertyId ?? item.id) === leadId);
  const propertyId = lead?.propertyId ?? lead?.id;
  selectedDetail.value = null;
  if (!propertyId) return;
  selectedDetailLoading.value = true;
  try { selectedDetail.value = await getPropertyBrief(propertyId); } catch { selectedDetail.value = null; } finally { selectedDetailLoading.value = false; }
}

async function completeActiveStop(outcome: LeadOutcome["outcome"]) {
  const stop = activeStop.value;
  if (!stop) return;
  const propertyId = stop.lead.propertyId ?? stop.lead.id;
  completedIds.value = new Set([...completedIds.value, propertyId]);
  routeOrigin.value = { latitude: stop.lead.latitude ?? repLocation.value.latitude, longitude: stop.lead.longitude ?? repLocation.value.longitude };
  await persistOutcome(propertyId, outcome, stop.lead);
}

async function skipActiveStop() {
  const stop = activeStop.value;
  if (!stop) return;
  const propertyId = stop.lead.propertyId ?? stop.lead.id;
  skippedIds.value = new Set([...skippedIds.value, propertyId]);
  routeOrigin.value = { latitude: stop.lead.latitude ?? repLocation.value.latitude, longitude: stop.lead.longitude ?? repLocation.value.longitude };
  await persistOutcome(propertyId, "SKIPPED", stop.lead);
}

async function persistOutcome(propertyId: string, outcome: LeadOutcome["outcome"], lead: DiscoveryScanLead) {
  try { await updateOutcome(propertyId, outcome, { ...lead, updatedAt: new Date().toISOString() }); } catch { /* local route still advances if the network is unavailable */ }
}

function refreshRepLocation() { void currentLocation.refresh(); }
function goToHunt() { router.push("/labs/lead-finder"); }
function clusterLabel(cluster: NavigatorCluster) { return `Pocket ${cluster.clusterId.slice(-4).toUpperCase()}`; }
function formatCapacity(value: number | null) { return value == null ? "--" : value.toFixed(1); }
function efficiencyTone(score: number) { return score >= 70 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"; }
function average(values: number[]) { return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
</script>
