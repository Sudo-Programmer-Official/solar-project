<template>
  <main class="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
    <MobileHeader
      eyebrow="LABS · LEAD FINDER"
      title="Route"
      subtitle="Keep the properties you want to work together in one shared field route."
    >
      <template #action>
        <RouterLink
          to="/labs/lead-finder"
          class="inline-flex min-h-touch items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          Lead Finder
        </RouterLink>
      </template>
    </MobileHeader>

    <section class="page-surface overflow-hidden border-cyan-100 bg-[linear-gradient(135deg,#ffffff_0%,#f0fbff_100%)] p-4 shadow-card sm:p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="field-label">SAVED FIELD ROUTE</p>
          <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{{ items.length }} {{ items.length === 1 ? "property" : "properties" }}</h2>
          <p class="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Add properties from Lead Finder, then review the run here before you head out.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="touch-target rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            :disabled="items.length === 0 || routeLoading"
            @click="startRoute"
          >
            {{ routeLoading ? "Starting…" : "Start route" }}
          </button>
          <button
            class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            :disabled="items.length === 0 || clearing"
            @click="clearRoute"
          >
            {{ clearing ? "Clearing…" : "Clear route" }}
          </button>
        </div>
      </div>

      <div v-if="route?.startingLatitude != null && route?.startingLongitude != null" class="mt-4 inline-flex rounded-full bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80">
        Distance is measured from the scan location
      </div>
    </section>

    <PageSkeleton v-if="savedRouteLoading" class="mt-4" variant="table" />

    <EmptyState
      v-else-if="savedRouteError"
      class="mt-4"
      title="Couldn't load your route."
      :message="savedRouteError"
      action-label="Retry"
      @action="loadRoute"
    />

    <EmptyState
      v-else-if="items.length === 0"
      class="mt-4"
      title="No properties in your route yet."
      message="Add properties from Lead Finder. Your route is saved across refreshes and devices."
      action-label="Open Lead Finder"
      @action="openFinder"
    />

    <template v-else>
      <section class="page-surface mt-4 overflow-hidden p-0">
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th class="px-4 py-3">Address</th>
                <th class="px-4 py-3">City</th>
                <th class="px-4 py-3">Distance</th>
                <th class="px-4 py-3">Score</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-for="item in items" :key="item.id" class="transition hover:bg-cyan-50/40">
                <td class="max-w-[320px] truncate px-4 py-4 font-semibold text-slate-900" :title="item.address">{{ item.address }}</td>
                <td class="px-4 py-4 text-slate-600">{{ locationLabel(item) }}</td>
                <td class="px-4 py-4 text-slate-600">{{ distanceLabel(item.distanceMiles) }}</td>
                <td class="px-4 py-4"><span class="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{{ item.opportunityScore }}</span></td>
                <td class="px-4 py-4"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{{ statusLabel(item.status) }}</span></td>
                <td class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700" type="button" @click="openProperty(item)">View</button>
                    <button class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700" type="button" @click="navigate(item)">Navigate</button>
                    <button class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50" type="button" @click="removeItem(item)">Remove</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="grid gap-3 p-3 md:hidden">
          <article v-for="item in items" :key="item.id" class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <button class="min-w-0 flex-1 text-left" type="button" @click="openProperty(item)">
                <h3 class="truncate text-base font-semibold text-slate-900">{{ item.address }}</h3>
                <p class="mt-1 truncate text-sm text-slate-500">{{ locationLabel(item) }} · {{ distanceLabel(item.distanceMiles) }}</p>
              </button>
              <span class="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{{ item.opportunityScore }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 text-xs">
              <span class="font-semibold uppercase tracking-[0.12em] text-slate-500">{{ statusLabel(item.status) }}</span>
              <span class="text-slate-500">Position {{ item.position + 1 }}</span>
            </div>
            <div class="mt-4 grid grid-cols-3 gap-2">
              <button class="min-h-touch rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700" type="button" @click="openProperty(item)">View</button>
              <button class="min-h-touch rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700" type="button" @click="navigate(item)">Navigate</button>
              <button class="min-h-touch rounded-xl border border-rose-200 bg-white px-2 py-2 text-sm font-semibold text-rose-700" type="button" @click="removeItem(item)">Remove</button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="routePlan" class="page-surface mt-4 border-emerald-100 bg-emerald-50/60 p-4">
        <p class="field-label text-emerald-700">ROUTE READY</p>
        <p class="mt-2 text-sm font-semibold text-slate-900">{{ routePlan.stops.length }} stops ordered from your current location.</p>
        <p class="mt-1 text-sm text-slate-600">Use the saved list above to view or navigate to any property.</p>
      </section>
    </template>

    <PropertyDetailDrawer
      v-if="selectedPropertyId"
      :property-id="selectedPropertyId"
      :lead-title="selectedTitle"
      :position="selectedPosition"
      :total="items.length"
      @close="selectedPropertyId = null"
      @previous="selectRelative(-1)"
      @next="selectRelative(1)"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { SavedRouteItem } from "@solar/contracts";
import { useHuntStore } from "../stores/hunt.store";
import { useLeadActions } from "../composables/useLeadActions";
import { useFeedbackStore } from "../stores/feedback.store";
import EmptyState from "../components/EmptyState.vue";
import MobileHeader from "../components/MobileHeader.vue";
import PageSkeleton from "../components/PageSkeleton.vue";
import PropertyDetailDrawer from "../components/PropertyDetailDrawer.vue";

const router = useRouter();
const hunt = useHuntStore();
const feedback = useFeedbackStore();
const { openDirections } = useLeadActions();

const route = computed(() => hunt.savedRoute);
const items = computed(() => hunt.savedRouteItems);
const savedRouteLoading = computed(() => hunt.savedRouteLoading);
const savedRouteError = computed(() => hunt.savedRouteError);
const routeLoading = ref(false);
const clearing = ref(false);
const selectedPropertyId = ref<string | null>(null);
const selectedPosition = computed(() => {
  const index = items.value.findIndex((item) => item.propertyId === selectedPropertyId.value);
  return index >= 0 ? index + 1 : 1;
});
const selectedTitle = computed(() => items.value.find((item) => item.propertyId === selectedPropertyId.value)?.address ?? null);
const routePlan = computed(() => hunt.routePlan);

onMounted(() => {
  void loadRoute();
});

async function loadRoute() {
  await hunt.loadSavedRoute();
}

function openFinder() {
  void router.push("/labs/lead-finder");
}

async function startRoute() {
  if (items.value.length === 0 || routeLoading.value) return;
  routeLoading.value = true;
  try {
    const first = route.value;
    await hunt.generateRoute(
      items.value.map((item) => item.propertyId),
      first?.startingLatitude != null && first?.startingLongitude != null
        ? { latitude: first.startingLatitude, longitude: first.startingLongitude }
        : undefined,
    );
    feedback.success("Route ordered and ready");
  } catch (cause) {
    feedback.failure(cause instanceof Error ? cause.message : "Route could not be started.");
  } finally {
    routeLoading.value = false;
  }
}

async function clearRoute() {
  if (items.value.length === 0 || clearing.value) return;
  if (typeof window !== "undefined" && !window.confirm("Clear every property from this route?")) return;
  clearing.value = true;
  try {
    await hunt.clearSavedRoute();
    feedback.success("Route cleared");
  } catch (cause) {
    feedback.failure(cause instanceof Error ? cause.message : "Route could not be cleared.");
  } finally {
    clearing.value = false;
  }
}

async function removeItem(item: SavedRouteItem) {
  if (typeof window !== "undefined" && !window.confirm("Remove this property from your route?")) return;
  try {
    await hunt.toggleSavedRouteItem(item.propertyId);
  } catch {
    // Shared store surfaces the error toast.
  }
}

function openProperty(item: SavedRouteItem) {
  selectedPropertyId.value = item.propertyId;
}

function selectRelative(offset: -1 | 1) {
  const index = items.value.findIndex((item) => item.propertyId === selectedPropertyId.value);
  const next = items.value[index + offset];
  if (next) selectedPropertyId.value = next.propertyId;
}

function navigate(item: SavedRouteItem) {
  if (item.latitude != null && item.longitude != null) {
    openDirections(item.latitude, item.longitude);
    return;
  }
  openProperty(item);
}

function locationLabel(item: SavedRouteItem) {
  return [item.city, item.state, item.postalCode].filter(Boolean).join(", ") || "Location unavailable";
}

function distanceLabel(value: number | null) {
  return value == null ? "Distance unknown" : value.toFixed(1) + " mi";
}

function statusLabel(value: SavedRouteItem["status"]) {
  return value.replaceAll("_", " ");
}
</script>
