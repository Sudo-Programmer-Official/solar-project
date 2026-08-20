<template>
  <div ref="root" class="overflow-hidden rounded-[28px] border border-slate-200 bg-white" :class="containerClasses">
    <div v-if="!visible" class="h-full animate-pulse bg-slate-100" />

    <template v-else>
      <div class="relative">
        <div v-if="satelliteLoading" class="aspect-[16/9] animate-pulse bg-slate-100" />
        <img
          v-else-if="satelliteImage"
          :src="satelliteImage.url"
          :alt="satelliteImage.alt"
          class="aspect-[16/9] h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div v-else class="aspect-[16/9] bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(135deg,rgba(248,250,252,1),rgba(241,245,249,1))]">
          <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div class="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-600">
              Satellite imagery unavailable
            </div>
            <p class="max-w-[20rem] text-sm leading-6 text-slate-500">
              Real property imagery will appear here when a property id is available and the imagery API is configured.
            </p>
          </div>
        </div>

        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/96 via-white/72 to-transparent px-4 pb-3 pt-10">
          <div class="flex items-end justify-between gap-3">
            <div class="space-y-1">
              <p v-if="address" class="text-sm font-semibold text-slate-900">{{ address }}</p>
              <p v-if="subtitle" class="text-xs leading-5 text-slate-500">{{ subtitle }}</p>
            </div>
            <button
              v-if="actionLabel"
              class="touch-target rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold tracking-[0.08em] text-slate-700 shadow-sm"
              @click="$emit('action')"
            >
              {{ actionLabel }}
            </button>
          </div>
          <p v-if="satelliteImage?.attribution" class="mt-2 text-[10px] leading-4 text-slate-500">
            {{ satelliteImage.attribution }}
          </p>
        </div>
      </div>

      <div v-if="showStreetPreview" class="border-t border-slate-200 bg-white p-3">
        <div v-if="streetLoading" class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div class="h-16 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div v-else-if="streetImage" class="grid grid-cols-[96px_1fr] gap-3">
          <img
            :src="streetImage.url"
            :alt="streetImage.alt"
            class="h-20 w-24 rounded-2xl object-cover"
            loading="lazy"
            decoding="async"
          />
          <div class="flex flex-col justify-between">
            <div>
              <p class="text-sm font-semibold text-slate-900">Street View</p>
              <p class="mt-1 text-xs text-slate-400">
                {{ streetMetadata?.date ? `Captured ${streetMetadata.date}` : "Recent street-level context" }}
              </p>
            </div>
            <p class="text-[10px] leading-4 text-slate-500">
              {{ streetImage.attribution }}
            </p>
          </div>
        </div>
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          Street View unavailable
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { StreetViewMetadataResponse } from "@solar/contracts";
import {
  backendPropertyImageryProvider,
  noopPropertyImageryProvider,
  type PropertyImageryProvider,
  type PropertyImageryRequest,
  type PropertyImageryResult,
} from "../services/imagery";

const props = withDefaults(defineProps<{
  propertyId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  subtitle?: string;
  actionLabel?: string;
  provider?: PropertyImageryProvider;
  compact?: boolean;
  showStreetPreview?: boolean;
}>(), {
  propertyId: null,
  latitude: null,
  longitude: null,
  address: undefined,
  subtitle: undefined,
  actionLabel: undefined,
  provider: () => backendPropertyImageryProvider ?? noopPropertyImageryProvider,
  compact: false,
  showStreetPreview: true,
});

defineEmits<{ action: [] }>();

const root = ref<HTMLElement | null>(null);
const visible = ref(false);
const satelliteImage = ref<PropertyImageryResult | null>(null);
const streetImage = ref<PropertyImageryResult | null>(null);
const streetMetadata = ref<StreetViewMetadataResponse | null>(null);
const satelliteLoading = ref(false);
const streetLoading = ref(false);
let observer: IntersectionObserver | null = null;
let satelliteObjectUrl: string | null = null;
let streetObjectUrl: string | null = null;

const containerClasses = computed(() => (props.compact ? "min-h-[12rem]" : "min-h-[15rem]"));

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
  () => [props.propertyId, props.latitude, props.longitude, props.showStreetPreview],
  () => {
    if (visible.value) {
      void loadImagery();
    }
  },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  revokeObjectUrls();
});

async function loadImagery() {
  revokeObjectUrls();

  if (props.latitude == null || props.longitude == null) {
    satelliteImage.value = null;
    streetImage.value = null;
    streetMetadata.value = null;
    return;
  }

  const request: PropertyImageryRequest = {
    propertyId: props.propertyId,
    latitude: props.latitude,
    longitude: props.longitude,
    address: props.address,
  };

  satelliteLoading.value = true;
  satelliteImage.value = await loadImageResult(await props.provider.getSatelliteImage(request));
  satelliteLoading.value = false;

  if (!props.showStreetPreview) {
    streetImage.value = null;
    streetMetadata.value = null;
    return;
  }

  streetLoading.value = true;
  try {
    streetMetadata.value = await props.provider.getStreetViewMetadata(request);
    streetImage.value = streetMetadata.value?.available
      ? await loadImageResult(await props.provider.getStreetViewImage(request))
      : null;
  } finally {
    streetLoading.value = false;
  }
}

async function loadImageResult(result: PropertyImageryResult | null) {
  if (!result) {
    return null;
  }

  try {
    const response = await fetch(result.url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    if (result.attribution === "Google Street View") {
      if (streetObjectUrl) {
        URL.revokeObjectURL(streetObjectUrl);
      }
      streetObjectUrl = objectUrl;
    } else {
      if (satelliteObjectUrl) {
        URL.revokeObjectURL(satelliteObjectUrl);
      }
      satelliteObjectUrl = objectUrl;
    }

    return {
      ...result,
      url: objectUrl,
    };
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
</script>
