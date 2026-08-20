<template>
  <div class="app-shell">
    <div class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <GlobalSearchBar />
    </div>
    <div v-if="showScanProgress" class="border-b border-slate-200 bg-white">
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
    <BottomNavigation />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BottomNavigation from "./components/BottomNavigation.vue";
import GlobalSearchBar from "./components/GlobalSearchBar.vue";
import ScanProgressPanel from "./components/ScanProgressPanel.vue";
import { useHuntStore } from "./stores/hunt.store";
import { useSearchContextStore } from "./stores/search-context.store";

const hunt = useHuntStore();
const searchStore = useSearchContextStore();

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
