<template>
  <section ref="root" class="overflow-hidden rounded-[28px] border border-slate-200 bg-white" :class="containerClasses">
    <div v-if="!visible" class="h-full animate-pulse bg-slate-100" aria-hidden="true" />

    <template v-else>
      <div class="border-b border-slate-200 bg-white p-2">
        <div class="grid grid-cols-2 gap-2" role="tablist" aria-label="Property imagery">
          <button
            class="min-h-touch rounded-2xl border px-3 py-2.5 text-sm font-semibold transition"
            :class="activeView === 'SATELLITE' ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-200 bg-slate-50 text-slate-600'"
            type="button"
            role="tab"
            :aria-selected="activeView === 'SATELLITE'"
            @click="setActiveView('SATELLITE')"
          >
            Satellite
          </button>
          <button
            class="min-h-touch rounded-2xl border px-3 py-2.5 text-sm font-semibold transition"
            :class="activeView === 'STREET' ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-200 bg-slate-50 text-slate-600'"
            type="button"
            role="tab"
            :aria-selected="activeView === 'STREET'"
            @click="setActiveView('STREET')"
          >
            Street View
          </button>
        </div>
      </div>

      <div class="relative bg-slate-100">
        <template v-if="activeView === 'SATELLITE'">
          <div v-if="satelliteLoading" class="aspect-[16/9] animate-pulse bg-slate-100" aria-label="Loading satellite imagery" />
          <button
            v-else-if="satelliteImage"
            class="group relative block aspect-[16/9] w-full overflow-hidden text-left"
            type="button"
            aria-label="Open satellite image"
            @click="openLightbox"
          >
            <img
              :src="satelliteImage.url"
              :alt="satelliteImage.alt"
              class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent px-4 pb-3 pt-12 text-white">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">Satellite</p>
                  <p class="mt-1 text-xs text-white/75">Roof layout, shading, and orientation</p>
                </div>
                <span class="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-800">Expand</span>
              </div>
            </div>
          </button>
          <div v-else class="flex aspect-[16/9] items-center justify-center bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(135deg,rgba(248,250,252,1),rgba(241,245,249,1))] p-6 text-center">
            <div>
              <p class="text-sm font-semibold text-slate-900">Satellite imagery unavailable</p>
              <p class="mt-2 text-sm leading-6 text-slate-500">Real property imagery is not available for this property.</p>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="streetLoading" class="aspect-[16/9] animate-pulse bg-slate-100" aria-label="Loading Street View imagery" />
          <button
            v-else-if="streetImage"
            class="group relative block aspect-[16/9] w-full overflow-hidden text-left"
            type="button"
            aria-label="Open Street View image"
            @click="openLightbox"
          >
            <img
              :src="streetImage.url"
              :alt="streetImage.alt"
              class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent px-4 pb-3 pt-12 text-white">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold">Street View</p>
                  <p class="mt-1 text-xs text-white/75">{{ streetCaptureLabel }}</p>
                </div>
                <span class="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-800">Expand</span>
              </div>
            </div>
          </button>
          <div v-else class="flex aspect-[16/9] items-center justify-center bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(135deg,rgba(248,250,252,1),rgba(241,245,249,1))] p-6 text-center">
            <div>
              <p class="text-sm font-semibold text-slate-900">Street View unavailable for this property</p>
              <p class="mt-2 text-sm leading-6 text-slate-500">Satellite view is still available for property verification.</p>
            </div>
          </div>
        </template>
      </div>

      <div v-if="activeView === 'SATELLITE'" class="border-t border-slate-200 bg-white p-3">
        <button
          v-if="streetImage"
          class="grid w-full grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left transition hover:border-primary-200 hover:bg-primary-50/30"
          type="button"
          @click="setActiveView('STREET')"
        >
          <img
            :src="streetImage.url"
            :alt="streetImage.alt"
            class="h-20 w-24 rounded-xl object-cover"
            loading="lazy"
            decoding="async"
          />
          <span class="flex min-w-0 flex-col justify-center">
            <span class="text-sm font-semibold text-slate-900">Street View</span>
            <span class="mt-1 text-xs text-slate-500">{{ streetCaptureLabel }}</span>
            <span class="mt-2 text-xs font-semibold text-primary-700">Open full view →</span>
          </span>
        </button>
        <div v-else-if="streetLoading" class="grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2" aria-label="Loading Street View preview">
          <div class="h-20 w-24 animate-pulse rounded-xl bg-slate-200" />
          <div class="flex flex-col justify-center gap-2">
            <div class="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
            <div class="h-3 w-36 max-w-full animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
          Street View unavailable for this property
        </div>
      </div>
    </template>

    <Transition name="media-lightbox">
      <div
        v-if="lightboxOpen && lightboxImage"
        class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 sm:p-8"
        role="presentation"
        tabindex="-1"
        @click.self="closeLightbox"
        @keydown.esc.stop="closeLightbox"
      >
        <div ref="lightboxPanel" class="flex max-h-full w-full max-w-6xl flex-col items-center" role="dialog" aria-modal="true" :aria-label="`${activeView === 'SATELLITE' ? 'Satellite' : 'Street View'} image viewer`" tabindex="-1">
          <div class="mb-3 flex w-full items-center justify-between gap-3 text-white">
            <div>
              <p class="text-sm font-semibold">{{ activeView === 'SATELLITE' ? 'Satellite' : 'Street View' }}</p>
              <p v-if="activeView === 'STREET'" class="mt-1 text-xs text-white/70">{{ streetCaptureLabel }}</p>
            </div>
            <button class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20" type="button" aria-label="Close image viewer" @click="closeLightbox">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <img
            :src="lightboxImage.url"
            :alt="lightboxImage.alt"
            class="max-h-[calc(100vh-8rem)] max-w-full rounded-2xl object-contain shadow-2xl"
            decoding="async"
          />
          <p class="mt-3 text-center text-xs text-white/70">Tap outside or close to return to the property.</p>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StreetViewMetadataResponse } from "@solar/contracts";
import {
  backendPropertyImageryProvider,
  noopPropertyImageryProvider,
  type PropertyImageryProvider,
  type PropertyImageryRequest,
  type PropertyImageryResult,
} from "../services/imagery";

type MediaView = "SATELLITE" | "STREET";

const props = withDefaults(defineProps<{
  propertyId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  compact?: boolean;
  provider?: PropertyImageryProvider;
}>(), {
  propertyId: null,
  latitude: null,
  longitude: null,
  address: undefined,
  compact: false,
  provider: () => backendPropertyImageryProvider ?? noopPropertyImageryProvider,
});

const root = ref<HTMLElement | null>(null);
const lightboxPanel = ref<HTMLElement | null>(null);
const visible = ref(false);
const activeView = ref<MediaView>("SATELLITE");
const satelliteImage = ref<PropertyImageryResult | null>(null);
const streetImage = ref<PropertyImageryResult | null>(null);
const streetMetadata = ref<StreetViewMetadataResponse | null>(null);
const satelliteLoading = ref(false);
const streetLoading = ref(false);
const lightboxOpen = ref(false);
let observer: IntersectionObserver | null = null;
let satelliteObjectUrl: string | null = null;
let streetObjectUrl: string | null = null;
let loadRequestId = 0;
let previousBodyOverflow: string | null = null;

const containerClasses = computed(() => (props.compact ? "min-h-[12rem]" : "min-h-[15rem]"));
const lightboxImage = computed(() => activeView.value === "SATELLITE" ? satelliteImage.value : streetImage.value);
const streetCaptureLabel = computed(() => streetMetadata.value?.date ? `Captured ${formatCaptureDate(streetMetadata.value.date)}` : "Capture date unavailable");

onMounted(() => {
  if (!root.value || typeof IntersectionObserver === "undefined") {
    visible.value = true;
    void loadImagery();
    return;
  }

  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      visible.value = true;
      void loadImagery();
      observer?.disconnect();
      observer = null;
    }
  }, { rootMargin: "180px" });
  observer.observe(root.value);
});

watch(
  () => [props.propertyId, props.latitude, props.longitude],
  () => {
    if (visible.value) {
      void loadImagery();
    }
  },
);

watch(lightboxOpen, async (open) => {
  if (open) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    await nextTick();
    lightboxPanel.value?.focus();
    return;
  }

  if (previousBodyOverflow != null) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  closeLightbox();
  if (previousBodyOverflow != null) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }
  revokeObjectUrls();
});

function setActiveView(view: MediaView) {
  activeView.value = view;
}

function openLightbox() {
  if (lightboxImage.value) {
    lightboxOpen.value = true;
  }
}

function closeLightbox() {
  lightboxOpen.value = false;
}

async function loadImagery() {
  const requestId = ++loadRequestId;
  activeView.value = "SATELLITE";
  closeLightbox();
  revokeObjectUrls();
  satelliteImage.value = null;
  streetImage.value = null;
  streetMetadata.value = null;

  if (props.latitude == null || props.longitude == null) {
    satelliteLoading.value = false;
    streetLoading.value = false;
    return;
  }

  const request: PropertyImageryRequest = {
    propertyId: props.propertyId,
    latitude: props.latitude,
    longitude: props.longitude,
    address: props.address,
  };

  satelliteLoading.value = true;
  streetLoading.value = true;

  try {
    const result = await props.provider.getSatelliteImage(request);
    const image = await loadImageResult(result, "SATELLITE", requestId);
    if (requestId === loadRequestId) {
      satelliteImage.value = image;
    }
  } catch {
    if (requestId === loadRequestId) satelliteImage.value = null;
  } finally {
    if (requestId === loadRequestId) satelliteLoading.value = false;
  }

  if (requestId !== loadRequestId) return;

  try {
    const metadata = await props.provider.getStreetViewMetadata(request);
    if (requestId !== loadRequestId) return;
    streetMetadata.value = metadata;

    if (metadata?.available) {
      streetImage.value = await loadImageResult(await props.provider.getStreetViewImage(request), "STREET", requestId);
    }
  } catch {
    if (requestId === loadRequestId) {
      streetMetadata.value = null;
      streetImage.value = null;
    }
  } finally {
    if (requestId === loadRequestId) streetLoading.value = false;
  }
}

async function loadImageResult(result: PropertyImageryResult | null, view: MediaView, requestId: number) {
  if (!result) return null;

  try {
    const response = await fetch(result.url, { cache: "no-store" });
    if (!response.ok) return null;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (requestId !== loadRequestId) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    if (view === "STREET") {
      if (streetObjectUrl) URL.revokeObjectURL(streetObjectUrl);
      streetObjectUrl = objectUrl;
    } else {
      if (satelliteObjectUrl) URL.revokeObjectURL(satelliteObjectUrl);
      satelliteObjectUrl = objectUrl;
    }

    return { ...result, url: objectUrl };
  } catch {
    return null;
  }
}

function revokeObjectUrls() {
  if (satelliteObjectUrl) {
    URL.revokeObjectURL(satelliteObjectUrl);
    satelliteObjectUrl = null;
  }
  if (streetObjectUrl) {
    URL.revokeObjectURL(streetObjectUrl);
    streetObjectUrl = null;
  }
}

function formatCaptureDate(date: string) {
  const normalizedDate = /^\d{4}-\d{2}$/.test(date) ? `${date}-01T00:00:00` : date;
  const parsed = new Date(normalizedDate);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parsed);
}
</script>

<style scoped>
.media-lightbox-enter-active,
.media-lightbox-leave-active {
  transition: opacity 180ms ease;
}

.media-lightbox-enter-from,
.media-lightbox-leave-to {
  opacity: 0;
}
</style>
