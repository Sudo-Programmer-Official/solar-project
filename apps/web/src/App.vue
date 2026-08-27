<template>
  <div v-if="user.isHydrating" class="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-semibold text-white">
    Restoring your session…
  </div>
  <Login v-else-if="user.authRequired && !user.isAuthenticated && !isInviteRoute" />
  <router-view v-else-if="isInviteRoute" />
  <ChangePassword v-else-if="user.mustChangePassword" />
  <div v-else class="app-shell">
    <div class="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-1.5 text-[10px] font-semibold tracking-[0.1em] text-white/80">
      <span>SOLAR OPERATIONS PLATFORM</span>
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-white/10 px-2 py-1 text-white">{{ user.roleLabel }}</span>
        <button class="rounded-full bg-white/10 px-2 py-1 text-white/80" type="button" @click="user.logout">Log out</button>
      </div>
    </div>
    <div class="lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <DesktopNavigation />
      <div class="min-w-0">
        <div v-if="user.hasModule('LABS')" class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
          <GlobalSearchBar />
        </div>
        <div v-if="user.hasModule('LABS') && showScanProgress" class="border-b border-slate-200 bg-white">
          <div class="mx-auto max-w-6xl px-4 pt-3">
            <ScanProgressPanel
              :location-label="scanLocationLabel"
              :stage="hunt.scanStatus"
              :is-scanning="hunt.isScanning"
              :is-complete="hunt.isComplete"
              :discovered-count="hunt.discoveredCount"
              :strong-lead-count="hunt.strongLeadCount"
              :solar-analyzed-count="hunt.solarAnalyzedCount"
              :solar-analysis-target="hunt.solarAnalysisTarget"
              :error="scanError"
              @retry="retryScan"
            />
          </div>
        </div>
        <router-view />
      </div>
    </div>
    <BottomNavigation />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BottomNavigation from "./components/BottomNavigation.vue";
import DesktopNavigation from "./components/DesktopNavigation.vue";
import GlobalSearchBar from "./components/GlobalSearchBar.vue";
import ScanProgressPanel from "./components/ScanProgressPanel.vue";
import Login from "./pages/Login.vue";
import ChangePassword from "./pages/ChangePassword.vue";
import { useHuntStore } from "./stores/hunt.store";
import { useSearchContextStore } from "./stores/search-context.store";
import { useUserStore } from "./stores/user.store";

const hunt = useHuntStore();
const searchStore = useSearchContextStore();
const user = useUserStore();
const route = useRoute();
const router = useRouter();
const isInviteRoute = computed(() => route.path === "/invite");

if (route.path === "/invite") {
  user.isHydrating = false;
} else {
  void user.hydrate();
}

watch([() => user.isHydrating, () => user.isAuthenticated], ([hydrating, authenticated]) => {
  if (hydrating || !authenticated || isInviteRoute.value) return;
  if (route.path === "/" || route.name === "legacy-today" || (route.meta.module && !user.hasModule(route.meta.module))) {
    void router.replace(user.primaryLandingPath);
  }
});

const showScanProgress = computed(() => Boolean(hunt.scanStatus || hunt.isScanning || hunt.error));
const scanLocationLabel = computed(() => searchStore.contextLabel || "selected location");
const scanError = computed(() => {
  if (hunt.scan?.error) return formatDiscoveryScanError(hunt.scan.error);
  if (hunt.error) return hunt.error;
  if (hunt.scanStatus === "FAILED" || hunt.scanStatus === "DISCOVERY_FAILED") {
    return "We couldn't finish this scan.";
  }
  return null;
});

async function retryScan() {
  if (hunt.lastLatitude == null || hunt.lastLongitude == null) {
    return;
  }
  await hunt.runScan({ latitude: hunt.lastLatitude, longitude: hunt.lastLongitude }, {
    radiusMiles: searchStore.radiusMiles,
    filters: searchStore.filters,
  });
}

function formatDiscoveryScanError(error: { code: string; message: string } | null): string | null {
  if (!error) {
    return null;
  }
  switch (error.code) {
    case "DATA_COVERAGE_UNAVAILABLE":
      return "No residential data is available for this area yet.";
    case "PROVIDER_TEMPORARY_FAILURE":
      return "One of our data providers is temporarily unavailable.";
    case "PROVIDER_TIMEOUT":
    case "PROPERTY_DISCOVERY_TIMEOUT":
      return "Property discovery took too long, so the available leads are shown.";
    case "DATABASE_UNAVAILABLE":
    case "DATABASE_SCHEMA_MISMATCH":
    case "DATABASE_WRITE_FAILED":
    case "PERSISTENCE_FAILED":
      return "We couldn't access lead data right now.";
    case "GEOCODING_REQUEST_FAILED":
      return "We couldn't resolve that location.";
    case "GOOGLE_SOLAR_REQUEST_FAILED":
      return "Solar enrichment could not complete.";
    case "DISCOVERY_PROVIDER_FAILED":
      return "Residential data discovery could not complete.";
    default:
      return error.message;
  }
}
</script>
