<template>
  <article class="page-surface overflow-hidden shadow-card">
    <SatelliteImagePanel
      class="aspect-[16/9] rounded-none border-0 border-b border-slate-200"
      :property-id="lead.propertyId ?? null"
      :latitude="lead.latitude ?? null"
      :longitude="lead.longitude ?? null"
      :address="displayTitle"
      :subtitle="visualSubtitle"
      compact
      :show-street-preview="false"
    />

    <div class="px-4 pb-4 pt-3">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <OpportunityScore :score="lead.opportunityScore" />
            <WhaleBadge :isWhale="lead.whaleScore >= 60" />
            <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-slate-600">
              {{ lead.analysisStatus }}
            </span>
          </div>
          <div class="flex items-start gap-2">
            <h3 class="text-lg font-semibold text-slate-900">{{ displayTitle }}</h3>
            <button
              class="touch-target mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-primary-200 hover:text-primary-500"
              type="button"
              aria-label="Copy address"
              title="Copy address"
              @click="copyAddress"
            >
              <el-icon :size="16">
                <CopyDocument />
              </el-icon>
            </button>
          </div>
          <p class="text-sm text-slate-500">{{ locationLabel }} · {{ formatDistance(lead.distanceMiles) }}</p>
        </div>
        <button
          class="touch-target rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.08em]"
          :class="selected ? 'border-primary-200 bg-primary-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600'"
          @click="$emit('toggle')"
        >
          {{ selected ? "Selected" : "Add to Route" }}
        </button>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Distance</span>
          <strong class="mt-1 block text-slate-900">{{ formatDistance(lead.distanceMiles) }}</strong>
        </div>
        <div class="rounded-2xl bg-slate-50 p-3">
          <span class="text-slate-500">Max capacity</span>
          <strong class="mt-1 block text-slate-900">{{ formatNumber(lead.maxRoofSolarCapacityKw) }} kW</strong>
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
        <p class="field-label">Important signals</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <SignalChip v-for="signal in displaySignals" :key="signal" :label="signal" />
        </div>
      </div>

      <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p class="field-label">Next best action</p>
        <p class="mt-2 text-sm font-semibold text-slate-900">{{ lead.nextBestAction.label }}</p>
        <p class="mt-1 text-sm leading-6 text-slate-500">{{ lead.nextBestAction.reason }}</p>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="$emit('navigate')">
          Navigate
        </button>
        <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="$emit('toggle')">
          {{ selected ? "Remove" : "Add to Route" }}
        </button>
        <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click="$emit('open')">
          Open
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DiscoveryScanLead, OpportunitySignal } from "@solar/contracts";
import { ElIcon, ElMessage } from "element-plus";
import { CopyDocument } from "@element-plus/icons-vue";
import SatelliteImagePanel from "./SatelliteImagePanel.vue";
import OpportunityScore from "./OpportunityScore.vue";
import WhaleBadge from "./WhaleBadge.vue";
import SignalChip from "./SignalChip.vue";

const props = defineProps<{
  lead: DiscoveryScanLead;
  selected: boolean;
}>();

defineEmits<{
  navigate: [];
  toggle: [];
  open: [];
}>();

const displaySignals = computed(() => {
  if (props.lead.opportunitySignals?.length) {
    return props.lead.opportunitySignals.slice(0, 3).map(formatOpportunitySignal);
  }
  return props.lead.reasons.slice(0, 3);
});

const displayTitle = computed(() => formatLeadTitle(props.lead.address, props.lead.city, props.lead.state, props.lead.postalCode));
const locationLabel = computed(() => formatLocationLabel(props.lead.city, props.lead.state, props.lead.postalCode));

function formatNumber(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDistance(value?: number | null) {
  if (value == null) return "Distance unknown";
  return `${value.toFixed(1)} mi away`;
}

const visualSubtitle = "Satellite view";

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

async function copyAddress() {
  const address = displayTitle.value;
  try {
    await navigator.clipboard.writeText(address);
    ElMessage.success("Address copied");
  } catch {
    ElMessage.error("Couldn't copy address");
  }
}

function isPlusCode(value: string) {
  return /(?:^|\s)[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:\s|$)/i.test(value);
}
</script>
