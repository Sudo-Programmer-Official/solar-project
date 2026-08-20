<template>
  <article
    class="page-surface overflow-hidden shadow-card"
    :class="compact ? 'cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300' : ''"
    :role="compact ? 'button' : undefined"
    :tabindex="compact ? 0 : undefined"
    @click="compact && $emit('open')"
    @keydown.enter.prevent="compact && $emit('open')"
    @keydown.space.prevent="compact && $emit('open')"
  >
    <div class="grid md:grid-cols-[35%_65%]">
      <SatelliteImagePanel
        class="aspect-[16/9] rounded-none border-0 border-b border-slate-200 md:border-b-0 md:border-r"
        :property-id="lead.propertyId ?? null"
        :latitude="lead.latitude ?? null"
        :longitude="lead.longitude ?? null"
        :address="fullAddress"
        :subtitle="locationLabel"
        compact
        :show-street-preview="false"
      />

      <div class="px-4 py-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <OpportunityScore :score="lead.opportunityScore" />
              <WhaleBadge v-if="lead.whaleScore >= 60" :isWhale="true" />
            </div>

            <div>
              <div class="flex items-start gap-2">
                <h3 class="text-lg font-semibold text-slate-900">{{ streetLabel }}</h3>
                <button
                  v-if="!compact"
                  class="touch-target mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-primary-200 hover:text-primary-500"
                  type="button"
                  aria-label="Copy address"
                  title="Copy address"
                  @click.stop="copyAddress"
                >
                  <el-icon :size="16">
                    <CopyDocument />
                  </el-icon>
                </button>
              </div>
              <p class="mt-1 text-sm text-slate-500">{{ locationLabel }} · {{ distanceLabel }}</p>
            </div>
          </div>
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

        <div v-if="highValueSignalLabel" class="mt-4">
          <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {{ highValueSignalLabel }}
          </span>
        </div>

        <div v-if="!compact" class="mt-4 grid grid-cols-3 gap-2">
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click.stop="$emit('navigate')">
            Navigate
          </button>
          <button
            class="touch-target rounded-2xl border px-3 py-3 text-sm font-semibold shadow-sm"
            :class="selected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'"
            @click.stop="$emit('toggle')"
          >
            {{ selected ? "Added ✓" : "Add to Route" }}
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click.stop="$emit('open')">
            Open
          </button>
        </div>
        <div v-else class="mt-4 grid grid-cols-2 gap-2">
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click.stop="$emit('navigate')">
            Navigate
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" @click.stop="$emit('open')">
            Open
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TodayLeadCard } from "@solar/contracts";
import { ElIcon, ElMessage } from "element-plus";
import { CopyDocument } from "@element-plus/icons-vue";
import SatelliteImagePanel from "./SatelliteImagePanel.vue";
import OpportunityScore from "./OpportunityScore.vue";
import WhaleBadge from "./WhaleBadge.vue";

const props = defineProps<{
  lead: TodayLeadCard;
  selected?: boolean;
  compact?: boolean;
}>();

defineEmits<{
  navigate: [];
  toggle: [];
  open: [];
}>();

const streetLabel = computed(() => sanitizeText(props.lead.address) || "Address unavailable");
const locationLabel = computed(() => formatLocationLabel(props.lead.city, props.lead.state, props.lead.postalCode));
const fullAddress = computed(() => [streetLabel.value, locationLabel.value].filter((item) => item && item !== "Location unavailable").join(", "));
const distanceLabel = computed(() => (props.lead.distanceMiles == null ? "Distance unknown" : `${props.lead.distanceMiles.toFixed(1)} mi`));
const highValueSignalLabel = computed(() => {
  const signal = selectHighValueSignal(props.lead.visualSignals ?? []);
  if (!signal) return null;
  switch (signal.type) {
    case "POOL":
      return signal.origin === "HOMEOWNER_CONFIRMED" ? "🏊 Pool confirmed" : "🏊 Pool detected";
    case "EXISTING_SOLAR":
      return "☀️ Existing solar";
    case "LARGE_ROOF":
      return "📐 Large roof";
    case "LOW_SHADE":
      return "🌤 Low shade";
    case "HEAVY_SHADE":
      return "🌥 Heavy shade";
    case "DETACHED_GARAGE":
      return "🏠 Detached garage";
    case "LARGE_DRIVEWAY":
      return "🛣 Large driveway";
    case "LARGE_LOT":
      return "🌿 Large lot";
    default:
      return null;
  }
});

function formatNumber(value?: number | null) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatLocationLabel(city?: string | null, state?: string | null, postalCode?: string | null) {
  const cleanCity = sanitizeText(city);
  const cleanState = abbreviateState(state);
  const cleanPostalCode = sanitizeText(postalCode);
  const cityComponent = cleanCity && !isPlusCode(cleanCity) ? cleanCity : null;
  const line = cityComponent && cleanState ? `${cityComponent}, ${cleanState}${cleanPostalCode ? ` ${cleanPostalCode}` : ""}` : cityComponent ?? cleanPostalCode;
  return line || "Location unavailable";
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

function selectHighValueSignal(signals: NonNullable<TodayLeadCard["visualSignals"]>) {
  return (
    signals.find((signal) => signal.type === "POOL" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "EXISTING_SOLAR" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "LARGE_ROOF" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "LOW_SHADE" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "HEAVY_SHADE" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "DETACHED_GARAGE" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "LARGE_DRIVEWAY" && signal.status === "DETECTED") ??
    signals.find((signal) => signal.type === "LARGE_LOT" && signal.status === "DETECTED") ??
    null
  );
}

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(fullAddress.value || streetLabel.value);
    ElMessage.success("Address copied");
  } catch {
    ElMessage.error("Couldn't copy address");
  }
}
</script>
