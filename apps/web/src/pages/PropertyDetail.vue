<template>
  <main class="px-4 pb-6">
    <MobileHeader eyebrow="SolarScout" title="Property Detail" subtitle="Verify the house before you knock.">
      <template #action>
        <button class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold tracking-[0.08em] text-slate-700 shadow-sm" @click="reload">
          Reload
        </button>
      </template>
    </MobileHeader>

    <LoadingCard v-if="loading && !detail" />

    <EmptyState
      v-else-if="!detail"
      title="Property not found"
      message="This property could not be loaded."
      action-label="Back to Today"
      @action="goBack"
    />

    <template v-else>
      <section class="page-surface overflow-hidden">
        <SatelliteImagePanel
          class="rounded-none border-0 border-b border-slate-200"
          :property-id="detail.property.id"
          :latitude="detail.property.latitude ?? null"
          :longitude="detail.property.longitude ?? null"
          :address="displayAddress"
          :subtitle="locationLabel"
          :show-street-preview="true"
          @action="verifyOnGoogleMaps"
        />

        <div class="p-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <OpportunityScore :score="detail.opportunityAssessment.overallOpportunityScore" />
                <WhaleBadge :isWhale="detail.whaleScore.whaleScore >= 60" />
              </div>
              <div>
                <h1 class="text-xl font-semibold text-slate-900">{{ displayAddress }}</h1>
                <p class="mt-1 text-sm text-slate-500">{{ locationLabel }}</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="verifyOnGoogleMaps">
                Verify on Google Maps
              </button>
              <button class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="navigateToProperty">
                Navigate
              </button>
            </div>
          </div>

          <div class="mt-4">
            <LocationMatchBadge :verification="detail.locationVerification ?? null" />
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Max capacity</span>
              <strong class="mt-1 block text-slate-900">{{ formatNumber(detail.maxRoofSolarCapacityKw) }} kW</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Annual production</span>
              <strong class="mt-1 block text-slate-900">{{ formatNumber(detail.solarAssessment.estimatedAnnualProductionKwh) }} kWh</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Confidence</span>
              <strong class="mt-1 block text-slate-900">{{ detail.opportunityAssessment.confidence }}%</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Whale score</span>
              <strong class="mt-1 block text-slate-900">{{ detail.whaleScore.whaleScore }}/100</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-4 page-surface p-2">
        <div class="grid gap-2" :class="capabilities?.imagery.streetView ? 'grid-cols-3' : 'grid-cols-2'">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="touch-target rounded-2xl px-4 py-3 text-sm font-semibold transition"
            :class="activeTab === tab.key ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'bg-slate-50 text-slate-600 border border-slate-200'"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
      </section>

      <section v-if="activeTab === 'SATELLITE'" class="mt-4 grid gap-4">
        <div class="page-surface p-4">
          <p class="field-label">Satellite verification</p>
          <p class="mt-2 text-sm text-slate-500">
            Centered on the property coordinates with the marker placed at the target house.
          </p>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Address</span>
              <strong class="mt-1 block text-slate-900">{{ displayAddress }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Coordinates</span>
              <strong class="mt-1 block text-slate-900">{{ coordinateLabel }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Building center</span>
              <strong class="mt-1 block text-slate-900">{{ buildingCenterLabel }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Match</span>
              <strong class="mt-1 block text-slate-900">{{ locationMatchLabel }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="activeTab === 'STREET' && capabilities?.imagery.streetView" class="mt-4">
        <StreetViewPanel
          :property-id="detail.property.id"
          :latitude="detail.property.latitude ?? null"
          :longitude="detail.property.longitude ?? null"
          :address="displayAddress"
        />
      </section>

      <section v-else-if="activeTab === 'STREET'" class="mt-4 page-surface p-4">
        <p class="text-sm font-semibold text-slate-900">Street View unavailable</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">
          Street View is not enabled for this property yet.
        </p>
      </section>

      <section v-else class="mt-4 grid gap-4">
        <div class="page-surface p-4">
          <p class="field-label">Next best action</p>
          <div class="mt-2">
            <NextBestActionCard :action="nextBestAction" />
          </div>
        </div>

        <div class="page-surface p-4">
          <p class="field-label">Property intelligence</p>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Solar fit</span>
              <strong class="mt-1 block text-slate-900">{{ detail.solarAssessment.solarFitScore }}/100</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Fit confidence</span>
              <strong class="mt-1 block text-slate-900">{{ detail.solarAssessment.solarFitConfidence }}%</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Existing solar</span>
              <strong class="mt-1 block text-slate-900">{{ detail.solarAssessment.existingSolarStatus }}</strong>
            </div>
            <div class="rounded-2xl bg-slate-50 p-3">
              <span class="text-slate-500">Data quality</span>
              <strong class="mt-1 block text-slate-900">{{ detail.dataQuality.grade }} / {{ detail.dataQuality.confidence }}%</strong>
            </div>
          </div>
        </div>

        <div class="page-surface p-4">
          <p class="field-label">Opportunity signals</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <SignalChip
              v-for="signal in detail.opportunitySignals?.slice(0, 8) ?? []"
              :key="signal.code"
              :label="formatOpportunitySignal(signal)"
            />
          </div>
        </div>

        <div class="page-surface p-4">
          <p class="field-label">Available signals</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <SignalChip v-for="signal in detail.dataQuality.availableSignals" :key="signal" :label="signal" />
          </div>
        </div>

        <div class="page-surface p-4">
          <p class="field-label">Unknown data</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <SignalChip v-for="signal in detail.dataQuality.missingSignals" :key="signal" :label="signal" />
          </div>
          <div v-if="detail.dataQuality.warnings.length" class="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            <p v-for="warning in detail.dataQuality.warnings" :key="warning">
              {{ warning }}
            </p>
          </div>
        </div>

        <div class="page-surface p-4">
          <p class="field-label">Why this score?</p>
          <div class="mt-3 space-y-2 text-sm text-slate-500">
            <p v-for="reason in detail.reasons" :key="reason">{{ reason }}</p>
          </div>
        </div>

        <div class="page-surface p-4">
          <p class="field-label">Lead history</p>
          <div class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <p class="text-slate-900">Current outcome: {{ formatOutcome(detail.leadOutcome.outcome) }}</p>
            <p class="mt-1 text-slate-500">{{ detail.leadOutcome.notes || "No notes captured yet." }}</p>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            <button
              v-for="item in outcomeButtons"
              :key="item.label"
              class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              :disabled="savingOutcome"
              @click="saveOutcome(item.outcome)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { LeadOutcome, NextBestAction } from "@solar/contracts";
import MobileHeader from "../components/MobileHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import LoadingCard from "../components/LoadingCard.vue";
import SatelliteImagePanel from "../components/SatelliteImagePanel.vue";
import StreetViewPanel from "../components/StreetViewPanel.vue";
import LocationMatchBadge from "../components/LocationMatchBadge.vue";
import OpportunityScore from "../components/OpportunityScore.vue";
import WhaleBadge from "../components/WhaleBadge.vue";
import SignalChip from "../components/SignalChip.vue";
import NextBestActionCard from "../components/NextBestAction.vue";
import { useLeadStore } from "../stores/lead.store";
import { useLeadActions } from "../composables/useLeadActions";
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl } from "../services/imagery";
import { getCapabilities } from "../services/api";

const route = useRoute();
const router = useRouter();
const leadStore = useLeadStore();
const { leadDetail, loading } = storeToRefs(leadStore);
const { updateOutcome } = useLeadActions();

const activeTab = ref<"SATELLITE" | "STREET" | "DETAILS">("SATELLITE");
const savingOutcome = ref(false);
const capabilities = ref<{ imagery: { satellite: boolean; streetView: boolean } } | null>(null);

type PropertyDetailTabKey = "SATELLITE" | "STREET" | "DETAILS";

interface PropertyDetailTab {
  key: PropertyDetailTabKey;
  label: string;
}

const tabs = computed<PropertyDetailTab[]>(() => {
  const baseTabs: PropertyDetailTab[] = [
    { key: "SATELLITE", label: "Satellite" } as PropertyDetailTab,
    { key: "DETAILS", label: "Details" } as PropertyDetailTab,
  ];

  if (capabilities.value?.imagery.streetView) {
    return [baseTabs[0], { key: "STREET", label: "Street View" } as PropertyDetailTab, baseTabs[1]];
  }

  return baseTabs;
});

const outcomeButtons = [
  { label: "NOT HOME", outcome: "NOT_HOME" },
  { label: "CONVERSATION", outcome: "CONVERSATION" },
  { label: "BILL REQUESTED", outcome: "BILL_REQUESTED" },
  { label: "BILL RECEIVED", outcome: "BILL_RECEIVED" },
  { label: "APPOINTMENT", outcome: "APPOINTMENT_BOOKED" },
  { label: "SKIP", outcome: "NOT_INTERESTED" },
] as const satisfies ReadonlyArray<{ label: string; outcome: LeadOutcome["outcome"] }>;

const detail = computed(() => leadDetail.value);
const displayAddress = computed(() => formatLeadAddress(detail.value?.property.street ?? null, detail.value?.property.normalizedAddress ?? null, detail.value?.property.city ?? null, detail.value?.property.state ?? null, detail.value?.property.municipality ?? null));
const locationLabel = computed(() => formatLocationLabel(detail.value?.property.city ?? null, detail.value?.property.state ?? null, detail.value?.property.municipality ?? null));
const coordinateLabel = computed(() => {
  if (detail.value?.property.latitude == null || detail.value?.property.longitude == null) return "Unknown";
  return `${detail.value.property.latitude.toFixed(6)}, ${detail.value.property.longitude.toFixed(6)}`;
});
const buildingCenterLabel = computed(() => {
  const verification = detail.value?.locationVerification;
  if (verification?.solarBuildingCenterLatitude == null || verification.solarBuildingCenterLongitude == null) return "Unknown";
  return `${verification.solarBuildingCenterLatitude.toFixed(6)}, ${verification.solarBuildingCenterLongitude.toFixed(6)}`;
});
const locationMatchLabel = computed(() => {
  const meters = detail.value?.locationVerification?.distanceMeters;
  return meters == null ? "Unknown" : `${meters} m`;
});
const nextBestAction = computed<NextBestAction>(() => {
  if (!detail.value) {
    return { code: "NO_ACTION", label: "No action", reason: "Property details are not loaded.", priority: "LOW", tone: "ops" };
  }
  return detail.value.whaleScore.reasons.length > 0
    ? { code: "GET_BILL", label: "GET BILL", reason: detail.value.whaleScore.reasons[0], priority: "HIGH", tone: "sales" }
    : { code: "NO_ACTION", label: "REVIEW", reason: "Review the property signals before knocking.", priority: "MEDIUM", tone: "ops" };
});

onMounted(() => {
  void reload();
  void loadCapabilities();
});

watch(
  () => route.params.id,
  () => {
    void reload();
    void loadCapabilities();
  },
);

async function reload() {
  await leadStore.loadLead(String(route.params.id));
}

async function loadCapabilities() {
  capabilities.value = await getCapabilities();
  if (!capabilities.value?.imagery.streetView && activeTab.value === "STREET") {
    activeTab.value = "SATELLITE";
  }
}

function goBack() {
  router.push("/today");
}

function verifyOnGoogleMaps() {
  if (detail.value?.property.latitude == null || detail.value?.property.longitude == null) return;
  window.open(buildGoogleMapsSearchUrl(detail.value.property.latitude, detail.value.property.longitude), "_blank", "noopener,noreferrer");
}

function navigateToProperty() {
  if (detail.value?.property.latitude == null || detail.value?.property.longitude == null) return;
  window.open(buildGoogleMapsDirectionsUrl(detail.value.property.latitude, detail.value.property.longitude), "_blank", "noopener,noreferrer");
}

function formatLeadAddress(
  street: string | null,
  fallbackAddress: string | null,
  city: string | null,
  state: string | null,
  municipality: string | null,
) {
  const cleanStreet = sanitizeText(street);
  const cleanFallback = sanitizeText(fallbackAddress);
  if (cleanStreet && !isPlusCode(cleanStreet)) {
    return cleanStreet;
  }
  if (cleanFallback && !isPlusCode(cleanFallback)) {
    return cleanFallback;
  }
  const location = formatLocationLabel(city, state, municipality);
  return location === "Unknown location" ? "Address unavailable" : location;
}

function formatLocationLabel(city: string | null, state: string | null, municipality: string | null) {
  const stateLabel = abbreviateState(state);
  const cleanCity = sanitizeText(city);
  const cityComponent = cleanCity && !isPlusCode(cleanCity) ? cleanCity : null;
  const line = cityComponent && stateLabel ? `${cityComponent}, ${stateLabel}` : cityComponent;
  return line || municipality || "Unknown location";
}

function abbreviateState(state: string | null) {
  if (!state) return null;
  const cleaned = state.trim().toUpperCase();
  const map: Record<string, string> = {
    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
  };
  return map[cleaned] ?? cleaned;
}

function sanitizeText(value: string | null) {
  const cleaned = value?.trim() ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

function isPlusCode(value: string) {
  return /(?:^|\s)[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s|$)/i.test(value);
}

async function saveOutcome(outcome: LeadOutcome["outcome"]) {
  if (!detail.value) return;
  savingOutcome.value = true;
  try {
    await updateOutcome(detail.value.property.id, outcome);
    await reload();
  } finally {
    savingOutcome.value = false;
  }
}

function formatOutcome(outcome: LeadOutcome["outcome"]) {
  return outcome.replaceAll("_", " ");
}

function formatNumber(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatOpportunitySignal(signal: { label: string; value: string | number | boolean | null; unit?: string | null }) {
  const value = signal.value == null ? "" : ` ${formatSignalValue(signal.value)}${signal.unit ? ` ${signal.unit}` : ""}`;
  return `${signal.label}${value}`.trim();
}

function formatSignalValue(value: string | number | boolean | null) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return value ?? "";
}
</script>
