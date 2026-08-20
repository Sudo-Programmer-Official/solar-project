<template>
  <section class="grid gap-4" data-testid="mobile-swipe-hunt">
    <div class="page-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">Swipe Hunt</p>
          <p class="mt-1 text-sm text-slate-500">{{ reviewLabel }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs font-semibold text-slate-600">
          <p>{{ remainingCount }} remaining</p>
          <p class="mt-0.5 text-slate-500">{{ savedCount }} saved</p>
        </div>
      </div>
    </div>

    <div
      class="grid gap-4 outline-none"
      tabindex="0"
      @keydown.left.prevent="swipeSkip"
      @keydown.right.prevent="swipeSave"
      @keydown.enter.prevent="emitOpen"
    >
      <template v-if="lead">
        <div
          class="touch-none"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @pointerleave="onPointerCancel"
        >
          <div
            class="transition-transform duration-200 ease-out will-change-transform"
            :style="cardStyle"
          >
            <LeadCard
              data-testid="swipe-card"
              :lead="lead"
              compact
              @navigate="emitNavigate"
              @open="emitOpen"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-rose-600 shadow-sm" type="button" data-testid="swipe-skip" @click="swipeSkip">
            X Skip
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm" type="button" data-testid="swipe-navigate" @click="emitNavigate">
            Navigate
          </button>
          <button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-emerald-700 shadow-sm" type="button" data-testid="swipe-save" @click="swipeSave">
            ♥ Save
          </button>
        </div>
      </template>

      <div v-else class="page-surface p-6 text-center">
        <p class="text-base font-semibold text-slate-900">{{ emptyTitle }}</p>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ emptyMessage }}</p>
        <div class="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            v-if="savedCount > 0"
            class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
            type="button"
            @click="$emit('build-route')"
          >
            Build Route
          </button>
          <button
            v-if="hasMore"
            class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            type="button"
            :disabled="loadingMore"
            data-testid="swipe-load-more"
            @click="$emit('load-more')"
          >
            {{ loadingMore ? "Loading..." : "Load more leads" }}
          </button>
          <button
            v-if="nextRadiusSuggestion != null"
            class="touch-target rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            type="button"
            data-testid="swipe-expand-radius"
            @click="$emit('expand-radius')"
          >
            Expand to {{ nextRadiusSuggestion }} mi
          </button>
        </div>
      </div>
    </div>

    <div v-if="lead && isScanning" class="page-surface flex items-center gap-3 p-4">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" class="opacity-20" stroke="currentColor" stroke-width="3" />
          <path d="M21 12a9 9 0 0 0-9-9" class="opacity-90" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
        </svg>
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900">More leads are still being analyzed</p>
        <p class="mt-1 text-sm text-slate-500">The deck will keep filling as the scan completes.</p>
      </div>
    </div>
  </section>

  <template v-if="preloadLeads.length > 0">
    <img
      v-for="item in preloadLeads"
      :key="item.propertyId ?? item.id"
      class="hidden"
      :src="preloadedSrc(item)"
      alt=""
      aria-hidden="true"
    />
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { DiscoveryScanLead } from "@solar/contracts";
import { buildPropertySatelliteImageUrl } from "../services/imagery";
import LeadCard from "./LeadCard.vue";

const props = withDefaults(defineProps<{
  lead: DiscoveryScanLead | null;
  preloadLeads?: DiscoveryScanLead[];
  reviewLabel: string;
  savedCount: number;
  remainingCount: number;
  hasMore: boolean;
  isScanning: boolean;
  loadingMore?: boolean;
  emptyTitle: string;
  emptyMessage: string;
  nextRadiusSuggestion?: 10 | 20 | null;
}>(), {
  preloadLeads: () => [],
  loadingMore: false,
  nextRadiusSuggestion: null,
});

const emit = defineEmits<{
  save: [];
  skip: [];
  navigate: [];
  open: [];
  "build-route": [];
  "load-more": [];
  "expand-radius": [];
}>();

const dragX = ref(0);
const dragY = ref(0);
const dragActive = ref(false);
const isDismissing = ref(false);
const pointerId = ref<number | null>(null);
const pointerStart = ref<{ x: number; y: number } | null>(null);
const swipeDistance = 96;
const preloaded = new Set<string>();

const cardStyle = computed(() => {
  const rotation = Math.max(-12, Math.min(12, dragX.value / 18));
  const scale = dragActive.value ? 0.995 : 1;
  return {
    transform: `translate3d(${dragX.value}px, ${dragY.value}px, 0) rotate(${rotation}deg) scale(${scale})`,
    opacity: isDismissing.value ? 0.95 : 1,
  };
});

watch(
  () => props.lead?.propertyId ?? props.lead?.id ?? null,
  () => {
    resetDrag();
  },
);

watch(
  () => props.preloadLeads.map((lead) => lead.propertyId ?? lead.id).join("|"),
  () => {
    for (const lead of props.preloadLeads.slice(0, 2)) {
      preloadedSrc(lead);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  pointerStart.value = null;
});

function onPointerDown(event: PointerEvent) {
  if (!props.lead || isDismissing.value) return;
  pointerId.value = event.pointerId;
  pointerStart.value = { x: event.clientX, y: event.clientY };
  dragActive.value = true;
}

function onPointerMove(event: PointerEvent) {
  if (!dragActive.value || pointerId.value !== event.pointerId || !pointerStart.value || isDismissing.value) {
    return;
  }
  dragX.value = event.clientX - pointerStart.value.x;
  dragY.value = event.clientY - pointerStart.value.y;
}

function onPointerUp(event: PointerEvent) {
  if (pointerId.value !== event.pointerId) {
    return;
  }
  if (Math.abs(dragX.value) > swipeDistance && Math.abs(dragX.value) > Math.abs(dragY.value) * 1.15) {
    void triggerSwipe(dragX.value > 0 ? "save" : "skip");
  } else {
    resetDrag();
  }
}

function onPointerCancel(event: PointerEvent) {
  if (pointerId.value !== event.pointerId) {
    return;
  }
  resetDrag();
}

async function triggerSwipe(direction: "save" | "skip") {
  if (!props.lead || isDismissing.value) {
    return;
  }
  isDismissing.value = true;
  dragActive.value = false;
  dragX.value = direction === "save" ? Math.max(window.innerWidth * 0.9, 280) : -Math.max(window.innerWidth * 0.9, 280);
  dragY.value = 0;
  window.setTimeout(() => {
    if (direction === "save") {
      emit("save");
    } else {
      emit("skip");
    }
    resetDrag();
  }, 180);
}

function swipeSave() {
  void triggerSwipe("save");
}

function swipeSkip() {
  void triggerSwipe("skip");
}

function emitNavigate() {
  emit("navigate");
}

function emitOpen() {
  emit("open");
}

function resetDrag() {
  dragX.value = 0;
  dragY.value = 0;
  dragActive.value = false;
  isDismissing.value = false;
  pointerId.value = null;
  pointerStart.value = null;
}

function preloadedSrc(lead: DiscoveryScanLead) {
  const propertyId = lead.propertyId ?? null;
  if (!propertyId) {
    return "";
  }
  if (!preloaded.has(propertyId)) {
    preloaded.add(propertyId);
    const image = new Image();
    image.src = buildPropertySatelliteImageUrl(propertyId);
  }
  return buildPropertySatelliteImageUrl(propertyId);
}
</script>
