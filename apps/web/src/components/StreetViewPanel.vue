<template>
  <div ref="root" class="overflow-hidden rounded-[28px] border border-slate-200 bg-white" :class="containerClasses">
    <div v-if="!visible" class="h-full animate-pulse bg-slate-100" />
    <template v-else>
      <div v-if="streetLoading" class="aspect-[16/9] animate-pulse bg-slate-100" />

      <div v-else-if="streetImage" class="relative">
        <img
          :src="streetImage.url"
          :alt="streetImage.alt"
          class="aspect-[16/9] h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/96 via-white/72 to-transparent px-4 pb-3 pt-10">
          <p v-if="address" class="text-sm font-semibold text-slate-900">{{ address }}</p>
          <p v-if="streetMetadata?.date" class="mt-1 text-xs text-slate-500">Captured {{ streetMetadata.date }}</p>
          <p class="mt-2 text-[10px] leading-4 text-slate-500">{{ streetImage.attribution }}</p>
        </div>
      </div>

      <div v-else class="flex aspect-[16/9] items-center justify-center bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.10),transparent_32%),linear-gradient(135deg,rgba(248,250,252,1),rgba(241,245,249,1))] p-6 text-center">
        <div>
          <p class="text-sm font-semibold text-slate-900">Street View unavailable</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">
            No valid Street View panorama was found for this property.
          </p>
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
  provider?: PropertyImageryProvider;
  compact?: boolean;
}>(), {
  propertyId: null,
  latitude: null,
  longitude: null,
  address: undefined,
  provider: () => backendPropertyImageryProvider ?? noopPropertyImageryProvider,
  compact: false,
});

const root = ref<HTMLElement | null>(null);
const visible = ref(false);
const streetImage = ref<PropertyImageryResult | null>(null);
const streetMetadata = ref<StreetViewMetadataResponse | null>(null);
const streetLoading = ref(false);
let observer: IntersectionObserver | null = null;
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
  () => [props.propertyId, props.latitude, props.longitude],
  () => {
    if (visible.value) {
      void loadImagery();
    }
  },
);

onBeforeUnmount(() => {
  observer?.disconnect();
  revokeObjectUrl();
});

async function loadImagery() {
  revokeObjectUrl();

  if (props.latitude == null || props.longitude == null) {
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
    streetObjectUrl = objectUrl;

    return {
      ...result,
      url: objectUrl,
    };
  } catch {
    return null;
  }
}

function revokeObjectUrl() {
  if (streetObjectUrl) {
    URL.revokeObjectURL(streetObjectUrl);
    streetObjectUrl = null;
  }
}
</script>
