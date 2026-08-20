<template>
  <div
    ref="root"
    class="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white"
    :class="compact ? 'min-h-[11rem]' : 'min-h-[15rem]'"
    :style="surfaceStyle"
  >
    <div v-if="!visible" class="absolute inset-0 animate-pulse bg-slate-100" />

    <template v-else>
      <div class="absolute inset-0" :style="backgroundStyle" />
      <div class="absolute inset-0 opacity-70" :class="mode === 'satellite' ? 'mix-blend-screen' : ''">
        <div
          v-for="band in roadBands"
          :key="band.key"
          class="absolute bg-white/10"
          :style="band.style"
        />
      </div>

      <div
        class="absolute left-1/2 top-1/2"
        :style="{ transform: 'translate(-50%, -50%)' }"
      >
        <div
          class="rounded-[26px] border border-slate-300"
          :class="mode === 'satellite' ? 'bg-white/40 shadow-[0_0_0_1px_rgba(148,163,184,0.22),0_18px_40px_rgba(15,23,42,0.12)]' : 'bg-white/70'"
          :style="propertyBoundaryStyle"
        >
          <div
            class="absolute inset-[10%] rounded-[22px] border border-slate-300"
            :class="mode === 'satellite' ? 'bg-slate-100/20' : 'bg-white/40'"
            :style="roofStyle"
          />
        </div>

        <div class="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2">
          <div class="absolute inset-0 animate-ping rounded-full bg-primary-300/30" />
          <div class="absolute inset-1 rounded-full border border-white/70 bg-primary-400 shadow-[0_0_0_6px_rgba(6,182,212,0.12)]" />
          <div class="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 rounded-full bg-primary-100/90" />
        </div>
      </div>

      <div
        v-for="point in positionedPoints"
        :key="point.id"
        class="absolute -translate-x-1/2 -translate-y-1/2"
        :style="{ left: point.left, top: point.top }"
      >
        <button
          class="group flex items-center justify-center rounded-full border text-[10px] font-semibold tracking-[0.08em] shadow-lift transition"
          :class="pointClass(point)"
          :style="pointStyle(point)"
          @click.stop="$emit('point-click', point.id)"
        >
          <span v-if="point.kind === 'cluster'">{{ point.count }}</span>
          <span v-else-if="point.kind === 'current'">You</span>
          <span v-else class="sr-only">{{ point.label ?? point.id }}</span>
        </button>
      </div>

      <div
        v-if="title || subtitle || providerLabel"
        class="absolute inset-x-0 bottom-0 px-4 pb-3 pt-12"
        :class="mode === 'satellite' ? 'bg-gradient-to-t from-white/96 via-white/76 to-transparent' : 'bg-gradient-to-t from-white/98 via-white/84 to-transparent'"
      >
        <div class="flex items-end justify-between gap-3">
          <div class="space-y-1">
            <p v-if="title" class="text-sm font-semibold text-slate-900">{{ title }}</p>
            <p v-if="subtitle" class="text-xs leading-5 text-slate-500">{{ subtitle }}</p>
          </div>
          <span v-if="providerLabel" class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-600">
            {{ providerLabel }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export interface PropertyVisualPoint {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  kind?: "lead" | "current" | "cluster";
  tone?: "gold" | "green" | "blue" | "purple" | "gray" | "red";
  label?: string;
  count?: number;
}

const props = withDefaults(defineProps<{
  mode: "satellite" | "map";
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  points?: PropertyVisualPoint[];
  title?: string;
  subtitle?: string;
  providerLabel?: string;
  compact?: boolean;
}>(), {
  centerLatitude: null,
  centerLongitude: null,
  points: () => [],
  title: undefined,
  subtitle: undefined,
  providerLabel: undefined,
  compact: false,
});

defineEmits<{
  "point-click": [id: string];
}>();

const root = ref<HTMLElement | null>(null);
const visible = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (!root.value || typeof IntersectionObserver === "undefined") {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      visible.value = true;
      observer?.disconnect();
      observer = null;
    }
  }, { rootMargin: "160px" });
  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

const seed = computed(() => hashSeed(`${props.mode}:${props.centerLatitude ?? 0}:${props.centerLongitude ?? 0}`));
const surfaceStyle = computed(() => ({
  "--scene-hue": `${seed.value % 360}`,
  "--scene-hue-2": `${(seed.value + 38) % 360}`,
  "--scene-hue-3": `${(seed.value + 92) % 360}`,
}) as Record<string, string>);

const backgroundStyle = computed(() => {
  const hue = seed.value % 360;
  if (props.mode === "satellite") {
    return {
      backgroundImage: [
        `radial-gradient(circle at 22% 18%, hsla(${(hue + 18) % 360}, 45%, 34%, 0.75), transparent 30%)`,
        `radial-gradient(circle at 68% 22%, hsla(${(hue + 70) % 360}, 40%, 42%, 0.62), transparent 28%)`,
        `radial-gradient(circle at 32% 72%, hsla(${(hue + 128) % 360}, 45%, 27%, 0.5), transparent 32%)`,
        `linear-gradient(135deg, hsla(${hue}, 32%, 12%, 1), hsla(${(hue + 22) % 360}, 28%, 16%, 1))`,
      ].join(", "),
    };
  }
  return {
    backgroundImage: [
      "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(9,16,28,0.96))",
      `radial-gradient(circle at 18% 12%, hsla(${(hue + 60) % 360}, 38%, 25%, 0.65), transparent 32%)`,
      `radial-gradient(circle at 76% 78%, hsla(${(hue + 150) % 360}, 55%, 32%, 0.28), transparent 34%)`,
    ].join(", "),
  };
});

const roadBands = computed(() => {
  const count = props.mode === "map" ? 7 : 5;
  return Array.from({ length: count }, (_, index) => {
    const angle = (seed.value * 17 + index * 37) % 180;
    const isVertical = index % 2 === 0;
    const span = 18 + ((seed.value + index * 11) % 26);
    const offset = 10 + ((seed.value + index * 19) % 72);
    return {
      key: `${props.mode}-${index}`,
      style: isVertical
        ? {
            left: `${offset}%`,
            top: "0%",
            width: "1px",
            height: "100%",
            transform: `rotate(${angle}deg) scaleY(1.15)`,
            transformOrigin: "center",
            boxShadow: "0 0 18px rgba(255,255,255,0.14)",
          }
        : {
            left: "0%",
            top: `${offset}%`,
            width: "100%",
            height: "1px",
            transform: `rotate(${angle}deg) scaleX(${span / 18})`,
            transformOrigin: "center",
            boxShadow: "0 0 18px rgba(255,255,255,0.12)",
          },
    };
  });
});

const propertyBoundaryStyle = computed(() => {
  const width = 30 + (seed.value % 16);
  const height = 24 + (seed.value % 12);
  return {
    width: `${width}%`,
    height: `${height}%`,
    transform: `translate(-50%, -50%) rotate(${(seed.value % 8) - 4}deg)`,
  };
});

const roofStyle = computed(() => ({
  clipPath: roofPolygon(seed.value),
  opacity: props.mode === "satellite" ? 0.9 : 0.7,
}));

const positionedPoints = computed(() =>
  props.points
    .filter((point) => typeof point.latitude === "number" && typeof point.longitude === "number")
    .map((point) => {
      const position = projectPoint(
        props.centerLatitude ?? point.latitude ?? 0,
        props.centerLongitude ?? point.longitude ?? 0,
        point.latitude ?? 0,
        point.longitude ?? 0,
        props.mode,
      );
      return {
        ...point,
        left: position.left,
        top: position.top,
      };
    }),
);

function pointClass(point: PropertyVisualPoint) {
  if (point.kind === "current") return "border-primary-200 bg-primary-300 text-slate-950";
  if (point.kind === "cluster") return "border-slate-200 bg-white text-slate-700";
  switch (point.tone) {
    case "gold":
      return "border-whale-200 bg-whale-200 text-slate-950";
    case "green":
      return "border-emerald-200 bg-emerald-300 text-slate-950";
    case "blue":
      return "border-primary-200 bg-primary-300 text-slate-950";
    case "purple":
      return "border-violet-200 bg-violet-300 text-slate-950";
    case "red":
      return "border-rose-200 bg-rose-300 text-slate-950";
    default:
      return "border-slate-200 bg-slate-100 text-slate-900";
  }
}

function pointStyle(point: PropertyVisualPoint) {
  const size = point.kind === "cluster" ? 34 : point.kind === "current" ? 30 : 24;
  return {
    width: `${size}px`,
    height: `${size}px`,
    letterSpacing: point.kind === "cluster" ? "0.02em" : "0.16em",
  };
}

function projectPoint(centerLatitude: number, centerLongitude: number, latitude: number, longitude: number, mode: "satellite" | "map") {
  const milesPerLat = 69;
  const milesPerLng = Math.max(1, 69 * Math.cos((centerLatitude * Math.PI) / 180));
  const latMiles = (latitude - centerLatitude) * milesPerLat;
  const lngMiles = (longitude - centerLongitude) * milesPerLng;
  const radiusMiles = mode === "map" ? 1.75 : 0.9;
  const left = clamp(50 + (lngMiles / radiusMiles) * 30, 8, 92);
  const top = clamp(50 - (latMiles / radiusMiles) * 30, 8, 92);
  return { left: `${left}%`, top: `${top}%` };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function roofPolygon(seedValue: number) {
  const wobble = (seedValue % 7) + 1;
  const points = [
    [12 + wobble, 32 - wobble],
    [32 + wobble, 16 + wobble],
    [72 - wobble, 20 + wobble],
    [86 - wobble, 42 + wobble],
    [74 - wobble, 78 - wobble],
    [38 + wobble, 84 - wobble],
    [18 + wobble, 60 - wobble],
  ];
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
}
</script>
