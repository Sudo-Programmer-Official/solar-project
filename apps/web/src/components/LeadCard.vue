<template>
  <article class="page-surface overflow-hidden shadow-card">
    <div class="grid md:grid-cols-[35%_65%]">
      <SatelliteImagePanel
        class="aspect-[16/9] rounded-none border-0 border-b border-slate-200 md:border-b-0 md:border-r"
        :property-id="lead.propertyId ?? null"
        :latitude="lead.latitude ?? null"
        :longitude="lead.longitude ?? null"
        :address="displayTitle"
        :subtitle="locationLabel"
        compact
        :show-street-preview="false"
        @action="verifyOnGoogleMaps"
      />

      <div class="px-4 pb-4 pt-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <OpportunityScore :score="lead.opportunityScore" />
              <WhaleBadge :isWhale="lead.whaleScore >= 60" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-900">{{ displayTitle }}</h3>
              <p class="mt-1 text-sm text-slate-500">{{ locationLabel }}</p>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <LocationMatchBadge :verification="lead.locationVerification ?? null" />
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Distance</span>
            <strong class="mt-1 block text-slate-900">{{ distanceLabel }}</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Max capacity</span>
            <strong class="mt-1 block text-slate-900">{{ formatNumber(lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw) }} kW</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Annual production</span>
            <strong class="mt-1 block text-slate-900">{{ formatNumber(lead.estimatedAnnualProductionKwh) }} kWh</strong>
          </div>
          <div class="rounded-2xl bg-slate-50 p-3">
            <span class="text-slate-500">Confidence</span>
            <strong class="mt-1 block text-slate-900">{{ lead.confidence }}%</strong>
          </div>
        </div>

        <div class="mt-4">
          <p class="field-label">Why this lead</p>
          <div class="mt-2 flex flex-wrap gap-2">
          <SignalChip v-for="signal in displaySignals" :key="signal" :label="signal" />
        </div>
      </div>

      <div class="mt-4">
          <NextBestActionCard :action="lead.nextBestAction ?? actionModel" />
        </div>

        <details class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <summary class="cursor-pointer list-none text-sm font-semibold text-slate-900">Why this score?</summary>
          <div class="mt-3 space-y-2 text-sm text-slate-500">
            <p v-for="reason in lead.reasons.slice(0, 3)" :key="reason">
              {{ reason }}
            </p>
          </div>
        </details>

        <div class="mt-4 grid grid-cols-3 gap-2">
          <button class="touch-target rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700" @click="verifyOnGoogleMaps">
            Verify on Google Maps
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700" @click="$emit('navigate')">
            Navigate
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700" @click="$emit('open')">
            Open
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { NextBestAction as NextBestActionModel, OpportunitySignal, TodayLeadCard } from "@solar/contracts";
import SatelliteImagePanel from "./SatelliteImagePanel.vue";
import LocationMatchBadge from "./LocationMatchBadge.vue";
import OpportunityScore from "./OpportunityScore.vue";
import WhaleBadge from "./WhaleBadge.vue";
import SignalChip from "./SignalChip.vue";
import NextBestActionCard from "./NextBestAction.vue";
import { buildGoogleMapsSearchUrl } from "../services/imagery";

const props = defineProps<{
  lead: TodayLeadCard;
  selected?: boolean;
}>();

defineEmits<{ navigate: []; open: [] }>();

const actionModel = computed<NextBestActionModel>(() => ({
  code: props.lead.nextAction === "GET BILL" ? "GET_BILL" : "NO_ACTION",
  label: props.lead.nextAction,
  reason: props.lead.signals[0] ?? "Priority lead",
  priority: props.lead.whaleScore >= 60 ? "HIGH" : "MEDIUM",
  tone: "sales",
}));

const displayTitle = computed(() => formatLeadTitle(props.lead.address, props.lead.city, props.lead.state, props.lead.postalCode));
const locationLabel = computed(() => formatLocationLabel(props.lead.city, props.lead.state, props.lead.postalCode));
const distanceLabel = computed(() => (props.lead.distanceMiles == null ? "Distance pending" : `${props.lead.distanceMiles.toFixed(1)} mi`));
const displaySignals = computed(() => {
  if (props.lead.opportunitySignals?.length) {
    return props.lead.opportunitySignals.slice(0, 3).map(formatOpportunitySignal);
  }
  return props.lead.reasons.slice(0, 3);
});

function formatNumber(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatOpportunitySignal(signal: OpportunitySignal) {
  const value = signal.value == null ? "" : ` ${formatSignalValue(signal.value)}${signal.unit ? ` ${signal.unit}` : ""}`;
  return `${signal.label}${value}`.trim();
}

function formatSignalValue(value: OpportunitySignal["value"]) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function formatLocationLabel(city?: string | null, state?: string | null, postalCode?: string | null) {
  const cleanCity = sanitizeText(city);
  const cleanState = abbreviateState(state);
  const cleanPostalCode = sanitizeText(postalCode);
  const cityComponent = cleanCity && !isPlusCode(cleanCity) ? cleanCity : null;
  const line = cityComponent && cleanState ? `${cityComponent}, ${cleanState}${cleanPostalCode ? ` ${cleanPostalCode}` : ""}` : cityComponent ?? cleanPostalCode;
  return line || "Location unavailable";
}

function formatLeadTitle(address?: string | null, city?: string | null, state?: string | null, postalCode?: string | null) {
  const cleanAddress = sanitizeText(address);
  if (cleanAddress && !isPlusCode(cleanAddress)) {
    return cleanAddress;
  }
  const location = formatLocationLabel(city, state, postalCode);
  return location === "Location unavailable" ? "Address unavailable" : location;
}

function abbreviateState(state?: string | null) {
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

function sanitizeText(value?: string | null) {
  const cleaned = value?.trim() ?? "";
  return cleaned.length > 0 ? cleaned : null;
}

function isPlusCode(value: string) {
  return /(?:^|\s)[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s|$)/i.test(value);
}

function verifyOnGoogleMaps() {
  if (props.lead.latitude == null || props.lead.longitude == null) return;
  window.open(buildGoogleMapsSearchUrl(props.lead.latitude, props.lead.longitude), "_blank", "noopener,noreferrer");
}
</script>
