<template>
  <main class="px-4 pb-4">
    <MobileHeader eyebrow="WHALE HUNTER" title="Hunt Route" subtitle="One stop at a time, no dense tables.">
      <template #action>
        <button class="touch-target rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm" @click="goBack">
          Back
        </button>
      </template>
    </MobileHeader>

    <section class="page-surface mb-4 p-4">
      <p class="field-label">Current context</p>
      <p class="mt-2 text-sm text-slate-900">{{ currentContextLabel }}</p>
    </section>

    <EmptyState
      v-if="!route"
      title="No route yet"
      message="Scan around you and add leads to a route first."
      action-label="Go to Scan"
      @action="router.push('/labs/lead-finder')"
    />

    <template v-else>
      <section class="page-surface p-4">
        <div class="grid grid-cols-3 gap-2 text-sm">
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Current stop</span>
            <strong class="mt-1 block text-slate-900">{{ route.current?.address ?? "Done" }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Next stop</span>
            <strong class="mt-1 block text-slate-900">{{ route.next?.address ?? "None" }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Remaining</span>
            <strong class="mt-1 block text-slate-900">{{ route.remaining }}</strong>
          </div>
        </div>
      </section>

      <section v-if="route.current" class="mt-4 page-surface p-4">
        <p class="field-label">Current stop</p>
        <p class="mt-2 text-xl font-semibold text-slate-900">{{ route.current.address }}</p>
        <p class="mt-1 text-sm text-slate-500">{{ route.current.neighborhood }}</p>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Opportunity</span>
            <strong class="mt-1 block text-slate-900">{{ route.current.opportunityScore }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Whale score</span>
            <strong class="mt-1 block text-slate-900">{{ route.current.whaleScore }}/100</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Distance</span>
            <strong class="mt-1 block text-slate-900">{{ formatMiles(route.current.distanceMilesFromPrevious) }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Priority</span>
            <strong class="mt-1 block text-slate-900">#{{ route.current.priorityIndex }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3 col-span-2">
            <span class="text-slate-500">Coordinates</span>
            <strong class="mt-1 block text-slate-900">{{ coordinateLabel(route.current.propertyId) }}</strong>
          </div>
        </div>
        <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p class="field-label">Reason for priority</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ route.current.reason }}</p>
          <p class="mt-3 text-xs font-semibold tracking-[0.08em] text-slate-500">{{ route.current.nextBestAction.label }}</p>
        </div>
      </section>

      <section v-if="route.next" class="mt-4 page-surface p-4">
        <p class="field-label">Next stop</p>
        <p class="mt-2 text-lg font-semibold text-slate-900">{{ route.next.address }}</p>
        <p class="mt-1 text-sm text-slate-500">{{ route.next.reason }}</p>
        <p class="mt-3 text-sm text-slate-500">Coordinates: <span class="font-semibold text-slate-900">{{ coordinateLabel(route.next.propertyId) }}</span></p>
      </section>

      <section class="mt-4 page-surface p-4">
        <p class="field-label">Outcome</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button v-for="outcome in outcomes" :key="outcome.value" class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="setOutcome(outcome.value)">
            {{ outcome.label }}
          </button>
        </div>
        <button class="touch-target mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="skipCurrent">
          Skip
        </button>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import MobileHeader from "../components/MobileHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import { useHuntStore } from "../stores/hunt.store";
import { useSearchContextStore } from "../stores/search-context.store";
import type { LeadOutcome } from "@solar/contracts";

const router = useRouter();
const hunt = useHuntStore();
const searchContextStore = useSearchContextStore();
const { scanResults } = storeToRefs(hunt);

const route = computed(() => {
  const source = hunt.routeProgress?.route ?? hunt.routePlan;
  if (!source) return null;
  const completed = new Set([
    ...source.completedPropertyIds,
    ...hunt.skippedPropertyIds,
  ]);
  const stops = source.stops.filter((stop) => !completed.has(stop.propertyId));
  return {
    ...source,
    current: stops[0] ?? null,
    next: stops[1] ?? null,
    remaining: stops.length,
  };
});

const outcomes: Array<{ label: string; value: LeadOutcome["outcome"] }> = [
  { label: "Not Home", value: "NOT_HOME" },
  { label: "Conversation", value: "CONVERSATION" },
  { label: "Bill Requested", value: "BILL_REQUESTED" },
  { label: "Bill Received", value: "BILL_RECEIVED" },
  { label: "Appointment", value: "APPOINTMENT_BOOKED" },
];
const currentContextLabel = computed(() => searchContextStore.contextLabel || "No search context selected");
const scanResultsByPropertyId = computed(() => {
  const map = new Map<string, { latitude?: number | null; longitude?: number | null }>();
  for (const lead of scanResults.value) {
    const key = lead.propertyId ?? lead.id;
    map.set(key, { latitude: lead.latitude, longitude: lead.longitude });
  }
  return map;
});

onMounted(() => {
  void hunt.refreshRoute();
});

watch(() => hunt.routePlan?.id, () => {
  void hunt.refreshRoute();
});

function goBack() {
  router.back();
}

async function setOutcome(outcome: LeadOutcome["outcome"]) {
  const current = route.value?.current;
  if (!current) return;
  await hunt.recordOutcome(current.propertyId, outcome, null);
}

function skipCurrent() {
  hunt.skipCurrentStop();
}

function formatMiles(value: number) {
  return `${value.toFixed(1)} mi`;
}

function coordinateLabel(propertyId: string) {
  const coords = scanResultsByPropertyId.value.get(propertyId);
  if (!coords || coords.latitude == null || coords.longitude == null) {
    return "Unavailable";
  }
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
}
</script>
