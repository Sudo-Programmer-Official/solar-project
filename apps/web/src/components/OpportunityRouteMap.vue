<template>
  <div class="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[#eaf2f7] shadow-inner">
    <svg
      class="block h-[min(62vh,520px)] min-h-[360px] w-full"
      viewBox="0 0 1000 620"
      role="img"
      aria-label="Hood Navigator opportunity map"
    >
      <defs>
        <linearGradient id="hood-map-surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eff7f4" />
          <stop offset="52%" stop-color="#dcebf1" />
          <stop offset="100%" stop-color="#edf1e9" />
        </linearGradient>
        <filter id="hood-map-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.18" />
        </filter>
      </defs>

      <rect width="1000" height="620" fill="url(#hood-map-surface)" />
      <path
        v-for="road in roads"
        :key="road.id"
        :d="road.path"
        fill="none"
        :stroke="road.major ? '#ffffff' : '#c8dce2'"
        :stroke-width="road.major ? 12 : 6"
        stroke-linecap="round"
        opacity="0.9"
      />
      <path
        v-for="road in roads"
        :key="`${road.id}-inner`"
        :d="road.path"
        fill="none"
        :stroke="road.major ? '#d6e3e7' : '#d5e5e9'"
        :stroke-width="road.major ? 2 : 1"
        stroke-linecap="round"
      />

      <g v-for="zone in zones" :key="zone.id">
        <circle
          :cx="project(zone).x"
          :cy="project(zone).y"
          :r="zoneRadius(zone)"
          fill="#fb7185"
          fill-opacity="0.14"
          stroke="#fb7185"
          stroke-dasharray="7 7"
          stroke-width="2"
        />
        <text
          :x="project(zone).x"
          :y="project(zone).y - zoneRadius(zone) - 8"
          text-anchor="middle"
          class="fill-rose-700 text-[13px] font-semibold"
        >
          {{ zone.label.replaceAll("_", " ") }}
        </text>
      </g>

      <polyline
        v-if="routePath.length > 1"
        :points="routePath.map((point) => `${point.x},${point.y}`).join(' ')"
        fill="none"
        stroke="#0891b2"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="12 9"
        opacity="0.9"
      />

      <g v-for="lead in leads" :key="lead.id">
        <circle
          :cx="project(lead).x"
          :cy="project(lead).y"
          :r="leadRadius(lead)"
          :fill="leadColor(lead)"
          :stroke="selectedId === lead.id ? '#0f172a' : '#ffffff'"
          :stroke-width="selectedId === lead.id ? 4 : 2"
          class="cursor-pointer transition"
          @click="$emit('select-lead', lead.id)"
        />
        <text
          v-if="lead.opportunityScore >= 85"
          :x="project(lead).x"
          :y="project(lead).y - 12"
          text-anchor="middle"
          class="pointer-events-none fill-slate-700 text-[11px] font-bold"
        >
          {{ lead.opportunityScore }}
        </text>
      </g>

      <g v-for="cluster in clusters" :key="cluster.id" class="cursor-pointer" @click="$emit('select-cluster', cluster.id)">
        <circle
          :cx="project(cluster).x"
          :cy="project(cluster).y"
          :r="clusterRadius(cluster)"
          :fill="cluster.id === selectedId ? '#083344' : '#ffffff'"
          :stroke="cluster.id === selectedId ? '#083344' : '#0e7490'"
          stroke-width="4"
          filter="url(#hood-map-shadow)"
        />
        <text
          :x="project(cluster).x"
          :y="project(cluster).y + 5"
          text-anchor="middle"
          :fill="cluster.id === selectedId ? '#ffffff' : '#164e63'"
          class="text-[19px] font-bold"
        >
          {{ cluster.propertyCount }}
        </text>
        <text
          :x="project(cluster).x"
          :y="project(cluster).y + clusterRadius(cluster) + 17"
          text-anchor="middle"
          class="pointer-events-none fill-cyan-900 text-[11px] font-semibold tracking-[0.12em]"
        >
          HOT POCKET
        </text>
      </g>

      <g v-if="currentLocation" :transform="`translate(${project(currentLocation).x} ${project(currentLocation).y})`">
        <circle r="21" fill="#67e8f9" fill-opacity="0.35" class="animate-pulse" />
        <circle r="9" fill="#0e7490" stroke="#ffffff" stroke-width="4" />
        <text x="0" y="-29" text-anchor="middle" class="fill-cyan-950 text-[12px] font-bold">YOU</text>
      </g>
    </svg>

    <div class="pointer-events-none absolute left-3 top-3 rounded-2xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
      <p class="text-[10px] font-bold tracking-[0.14em] text-cyan-800">HOOD NAVIGATOR</p>
      <p class="mt-1 text-xs text-slate-600">Opportunity + field efficiency</p>
    </div>
    <div class="pointer-events-none absolute bottom-3 right-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur">
      <span class="mr-3 inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-400" /> priority</span>
      <span class="mr-3 inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-rose-400" /> lower efficiency</span>
      <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-cyan-700" /> route</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Point {
  latitude: number;
  longitude: number;
}

export interface OpportunityMapLead extends Point {
  id: string;
  opportunityScore: number;
  status?: string | null;
}

export interface OpportunityMapCluster extends Point {
  id: string;
  propertyCount: number;
  fieldPriorityScore: number;
}

export interface OpportunityMapZone extends Point {
  id: string;
  label: string;
  radiusMiles?: number;
}

const props = withDefaults(defineProps<{
  currentLocation?: Point | null;
  leads?: OpportunityMapLead[];
  clusters?: OpportunityMapCluster[];
  zones?: OpportunityMapZone[];
  route?: Point[];
  selectedId?: string | null;
}>(), {
  currentLocation: null,
  leads: () => [],
  clusters: () => [],
  zones: () => [],
  route: () => [],
  selectedId: null,
});

defineEmits<{
  "select-lead": [id: string];
  "select-cluster": [id: string];
}>();

const allPoints = computed<Point[]>(() => [
  ...props.leads,
  ...props.clusters,
  ...props.zones,
  ...(props.currentLocation ? [props.currentLocation] : []),
  ...props.route,
]);

const bounds = computed(() => {
  const fallback = props.currentLocation ?? props.clusters[0] ?? { latitude: 40.2108, longitude: -79.7665 };
  const points = allPoints.value.length > 0 ? allPoints.value : [fallback];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const latitudeSpan = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.006);
  const longitudeSpan = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.008);
  return {
    minLat: Math.min(...latitudes) - latitudeSpan * 0.16,
    maxLat: Math.max(...latitudes) + latitudeSpan * 0.16,
    minLng: Math.min(...longitudes) - longitudeSpan * 0.16,
    maxLng: Math.max(...longitudes) + longitudeSpan * 0.16,
  };
});

const roads = computed(() => {
  const { minLat, maxLat, minLng, maxLng } = bounds.value;
  const paths = [];
  for (let index = 1; index <= 6; index += 1) {
    const fraction = index / 7;
    const lat = minLat + (maxLat - minLat) * fraction;
    paths.push({ id: `horizontal-${index}`, major: index === 3 || index === 5, path: `M 0 ${project({ latitude: lat, longitude: minLng }).y} C 260 ${180 + index * 8}, 620 ${400 - index * 12}, 1000 ${project({ latitude: lat, longitude: maxLng }).y}` });
  }
  for (let index = 1; index <= 5; index += 1) {
    const fraction = index / 6;
    const lng = minLng + (maxLng - minLng) * fraction;
    paths.push({ id: `vertical-${index}`, major: index === 2, path: `M ${project({ latitude: minLat, longitude: lng }).x} 0 C ${160 + index * 12} 180, ${760 - index * 9} 420, ${project({ latitude: maxLat, longitude: lng }).x} 620` });
  }
  return paths;
});

const routePath = computed(() => props.route.map(project));

function project(point: Point) {
  const { minLat, maxLat, minLng, maxLng } = bounds.value;
  return {
    x: clamp(((point.longitude - minLng) / Math.max(maxLng - minLng, 0.0001)) * 1000, 28, 972),
    y: clamp(620 - ((point.latitude - minLat) / Math.max(maxLat - minLat, 0.0001)) * 620, 28, 592),
  };
}

function leadRadius(lead: OpportunityMapLead) {
  return lead.opportunityScore >= 85 ? 8 : lead.opportunityScore >= 70 ? 6 : 4;
}

function leadColor(lead: OpportunityMapLead) {
  if (lead.opportunityScore >= 85) return "#fbbf24";
  if (lead.opportunityScore >= 70) return "#34d399";
  return "#94a3b8";
}

function clusterRadius(cluster: OpportunityMapCluster) {
  return Math.min(38, Math.max(28, 23 + Math.sqrt(cluster.propertyCount) * 3));
}

function zoneRadius(zone: OpportunityMapZone) {
  const miles = zone.radiusMiles ?? 0.18;
  return Math.min(150, Math.max(46, miles * 160));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
</script>
