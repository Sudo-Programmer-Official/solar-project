<template>
  <section class="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
    <div class="relative h-[24rem] overflow-hidden bg-slate-200 sm:h-[30rem]">
      <div v-if="mapPoints.length === 0" class="absolute inset-0 flex items-center justify-center p-6 text-center">
        <div>
          <p class="text-sm font-semibold text-slate-900">No mapped properties yet</p>
          <p class="mt-1 text-xs leading-5 text-slate-600">Properties need valid coordinates before they can appear on the map.</p>
        </div>
      </div>

      <div v-else class="absolute inset-0 flex items-center justify-center">
        <div class="relative h-full w-full">
          <img
            v-for="tile in tiles"
            :key="tile.key"
            class="pointer-events-none absolute h-full w-full object-cover"
            :src="tile.url"
            :style="tile.style"
            alt=""
            loading="lazy"
            crossorigin="use-credentials"
          />

          <div class="absolute inset-0 bg-white/10" />

          <svg class="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              v-if="routeCoordinates.length > 1"
              :points="routeCoordinates.map((point) => `${point.left},${point.top}`).join(' ')"
              fill="none"
              stroke="#0891b2"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="0.75"
              vector-effect="non-scaling-stroke"
            />
          </svg>

          <div
            v-for="point in positionedPoints"
            :key="point.id"
            class="absolute -translate-x-1/2 -translate-y-1/2"
            :style="{ left: `${point.left}%`, top: `${point.top}%` }"
          >
            <button
              class="group relative flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white px-1.5 text-[10px] font-bold shadow-lg transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
              :class="point.kind === 'current' ? 'bg-slate-950 text-white' : point.tone === 'gold' ? 'bg-amber-400 text-slate-950' : point.tone === 'green' ? 'bg-emerald-500 text-white' : 'bg-cyan-500 text-white'"
              type="button"
              :aria-label="point.label ?? `Property ${point.sequence ?? ''}`"
              @click="$emit('point-click', point.id)"
            >
              <span v-if="point.kind === 'current'">You</span>
              <span v-else>{{ point.sequence ?? '•' }}</span>
              <span class="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-max max-w-52 -translate-x-1/2 rounded-xl bg-slate-950 px-2.5 py-1.5 text-left text-[11px] font-medium leading-4 text-white group-hover:block group-focus:block">
                {{ point.label ?? "Mapped property" }}
              </span>
            </button>
          </div>

          <div class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
            <div class="rounded-2xl border border-white/70 bg-white/92 px-3 py-2 shadow-sm backdrop-blur">
              <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{{ title }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ mapPoints.length }} properties · {{ routeOriginLabel }}</p>
            </div>
            <span class="rounded-full border border-white/70 bg-white/92 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur">
              Live map
            </span>
          </div>

          <div class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/65 to-transparent px-3 pb-3 pt-12 text-white sm:px-4">
            <p class="text-[11px] leading-4 text-white/90">{{ routeDescription }}</p>
            <span class="shrink-0 text-[10px] text-white/80">© OpenStreetMap</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white px-3 py-2.5 text-[11px] text-slate-500 sm:px-4">
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-slate-950" />Start / current location</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-cyan-500" />Property stop</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-4 rounded-full bg-cyan-600" />Suggested order</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { buildMapTileUrl } from "../services/api";
import { calculateDistanceMiles, isValidCoordinate, type DistanceCoordinate } from "../../../../packages/geospatial/src/index";

export interface RealLeadMapPoint {
  id: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  label?: string;
  kind?: "property" | "current";
  tone?: "gold" | "green" | "blue";
}

interface PositionedPoint extends RealLeadMapPoint {
  left: number;
  top: number;
  sequence?: number;
}

const props = withDefaults(defineProps<{
  points: RealLeadMapPoint[];
  origin?: DistanceCoordinate | null;
  originLabel?: string;
  title?: string;
  routeOrder?: string[];
}>(), {
  origin: null,
  originLabel: "current location unavailable",
  title: "Lead route",
  routeOrder: undefined,
});

defineEmits<{
  "point-click": [id: string];
}>();

const validPropertyPoints = computed(() => props.points.filter((point) => point.kind !== "current" && isValidCoordinate(point)));
const mapPoints = computed(() => validPropertyPoints.value);
const allCoordinates = computed<DistanceCoordinate[]>(() => [
  ...(props.origin && isValidCoordinate(props.origin) ? [props.origin] : []),
  ...mapPoints.value.map((point) => ({ latitude: point.latitude as number, longitude: point.longitude as number })),
]);
const mapCenter = computed(() => {
  if (props.origin && isValidCoordinate(props.origin)) return props.origin;
  if (allCoordinates.value.length === 0) return { latitude: 40.2108, longitude: -79.7665 };
  return {
    latitude: allCoordinates.value.reduce((sum, point) => sum + point.latitude, 0) / allCoordinates.value.length,
    longitude: allCoordinates.value.reduce((sum, point) => sum + point.longitude, 0) / allCoordinates.value.length,
  };
});
const zoom = computed(() => {
  const latitudes = allCoordinates.value.map((point) => point.latitude);
  const longitudes = allCoordinates.value.map((point) => point.longitude);
  const latitudeSpan = Math.max(...latitudes, mapCenter.value.latitude) - Math.min(...latitudes, mapCenter.value.latitude);
  const longitudeSpan = Math.max(...longitudes, mapCenter.value.longitude) - Math.min(...longitudes, mapCenter.value.longitude);
  const milesSpan = Math.max(latitudeSpan * 69, longitudeSpan * 69 * Math.max(0.2, Math.cos((mapCenter.value.latitude * Math.PI) / 180)));
  if (milesSpan <= 1.5) return 15;
  if (milesSpan <= 3) return 14;
  if (milesSpan <= 7) return 13;
  return 12;
});
const tileGrid = computed(() => {
  const worldTiles = 2 ** zoom.value;
  const xValues = allCoordinates.value.map((point) => longitudeToTileX(point.longitude, zoom.value));
  const yValues = allCoordinates.value.map((point) => latitudeToTileY(point.latitude, zoom.value));
  const xStart = Math.max(0, Math.floor(Math.min(...xValues, longitudeToTileX(mapCenter.value.longitude, zoom.value))) - 1);
  const xEnd = Math.min(worldTiles - 1, Math.ceil(Math.max(...xValues, longitudeToTileX(mapCenter.value.longitude, zoom.value))) + 1);
  const yStart = Math.max(0, Math.floor(Math.min(...yValues, latitudeToTileY(mapCenter.value.latitude, zoom.value))) - 1);
  const yEnd = Math.min(worldTiles - 1, Math.ceil(Math.max(...yValues, latitudeToTileY(mapCenter.value.latitude, zoom.value))) + 1);
  return { xStart, xEnd, yStart, yEnd, columns: Math.max(1, xEnd - xStart + 1), rows: Math.max(1, yEnd - yStart + 1) };
});
const tiles = computed(() => {
  const grid = tileGrid.value;
  const result: Array<{ key: string; url: string; style: Record<string, string> }> = [];
  for (let y = grid.yStart; y <= grid.yEnd; y += 1) {
    for (let x = grid.xStart; x <= grid.xEnd; x += 1) {
      result.push({
        key: `${zoom.value}-${x}-${y}`,
        url: buildMapTileUrl(zoom.value, x, y),
        style: {
          left: `${((x - grid.xStart) / grid.columns) * 100}%`,
          top: `${((y - grid.yStart) / grid.rows) * 100}%`,
          width: `${100 / grid.columns}%`,
          height: `${100 / grid.rows}%`,
        },
      });
    }
  }
  return result;
});
const orderedPoints = computed(() => {
  const available = [...mapPoints.value];
  if (props.routeOrder?.length) {
    const byId = new Map(available.map((point) => [point.id, point]));
    return props.routeOrder.map((id) => byId.get(id)).filter((point): point is RealLeadMapPoint => Boolean(point));
  }
  const ordered: RealLeadMapPoint[] = [];
  let cursor = props.origin && isValidCoordinate(props.origin) ? props.origin : null;
  while (available.length > 0) {
    const nextIndex = cursor
      ? available.reduce((bestIndex, point, index) => {
        const best = available[bestIndex];
        const candidateDistance = calculateDistanceMiles(cursor!.latitude, cursor!.longitude, point.latitude as number, point.longitude as number) ?? Number.POSITIVE_INFINITY;
        const bestDistance = calculateDistanceMiles(cursor!.latitude, cursor!.longitude, best.latitude as number, best.longitude as number) ?? Number.POSITIVE_INFINITY;
        return candidateDistance < bestDistance ? index : bestIndex;
      }, 0)
      : 0;
    const [next] = available.splice(nextIndex, 1);
    if (!next) break;
    ordered.push(next);
    cursor = { latitude: next.latitude as number, longitude: next.longitude as number };
  }
  return ordered;
});
const positionedPoints = computed<PositionedPoint[]>(() => {
  const propertyPositions = new Map(orderedPoints.value.map((point, index) => [point.id, { ...point, sequence: index + 1, ...project(point.latitude as number, point.longitude as number) }]));
  const points: PositionedPoint[] = [...propertyPositions.values()];
  if (props.origin && isValidCoordinate(props.origin)) {
    const origin = project(props.origin.latitude, props.origin.longitude);
    points.unshift({ id: "current-location", ...props.origin, kind: "current", label: props.originLabel, ...origin });
  }
  return points;
});
const routeCoordinates = computed(() => {
  const coordinates = orderedPoints.value.map((point) => project(point.latitude as number, point.longitude as number));
  if (props.origin && isValidCoordinate(props.origin)) {
    coordinates.unshift(project(props.origin.latitude, props.origin.longitude));
  }
  return coordinates;
});
const routeOriginLabel = computed(() => props.origin ? props.originLabel : "search area");
const routeDescription = computed(() => props.origin
  ? `${props.routeOrder?.length ? "Saved stop order" : "Suggested nearest-stop order"} from ${props.originLabel.toLowerCase()}.`
  : "Suggested property order; enable location for a true start point.");

function project(latitude: number, longitude: number) {
  const grid = tileGrid.value;
  return {
    left: ((longitudeToTileX(longitude, zoom.value) - grid.xStart) / grid.columns) * 100,
    top: ((latitudeToTileY(latitude, zoom.value) - grid.yStart) / grid.rows) * 100,
  };
}

function longitudeToTileX(longitude: number, currentZoom: number) {
  return ((longitude + 180) / 360) * (2 ** currentZoom);
}

function latitudeToTileY(latitude: number, currentZoom: number) {
  const radians = (Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * (2 ** currentZoom);
}
</script>
