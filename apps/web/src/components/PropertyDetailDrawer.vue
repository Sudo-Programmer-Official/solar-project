<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <button
        v-if="propertyId"
        class="fixed inset-0 z-40 cursor-default bg-slate-950/45 backdrop-blur-[1px]"
        type="button"
        aria-label="Close property details"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="drawer-slide">
      <aside
        v-if="propertyId"
        class="fixed right-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-[520px] flex-col border-l border-slate-200 bg-[#f7f9fc] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Property details"
      >
        <header class="sticky top-0 z-[60] flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <div class="min-w-0">
            <p class="field-label">PROPERTY REVIEW</p>
            <p class="mt-1 truncate text-sm font-semibold text-slate-900">{{ leadTitle || "Loading property" }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              aria-label="Previous property"
              :disabled="position <= 1"
              @click="emit('previous')"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span class="min-w-[58px] text-center text-xs font-semibold text-slate-500">{{ position }} of {{ total }}</span>
            <button
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              aria-label="Next property"
              :disabled="position >= total"
              @click="emit('next')"
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-slate-950"
              type="button"
              aria-label="Close property details"
              @click="emit('close')"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div ref="drawerBody" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <PropertyDetail :key="propertyId" :property-id="propertyId" embedded @close="emit('close')" />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import PropertyDetail from "../pages/PropertyDetail.vue";

const props = withDefaults(defineProps<{
  propertyId: string | null;
  leadTitle?: string | null;
  position: number;
  total: number;
}>(), {
  leadTitle: null,
});

const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
}>();

let previousBodyOverflow = "";
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyLeft = "";
let previousBodyRight = "";
let previousBodyWidth = "";
let previousScrollY = 0;
const drawerBody = ref<HTMLElement | null>(null);

watch(() => props.propertyId, () => {
  void nextTick(() => drawerBody.value?.scrollTo({ top: 0, behavior: "auto" }));
});

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    emit("previous");
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    emit("next");
  }
}

onMounted(() => {
  previousScrollY = window.scrollY;
  previousBodyOverflow = document.body.style.overflow;
  previousBodyPosition = document.body.style.position;
  previousBodyTop = document.body.style.top;
  previousBodyLeft = document.body.style.left;
  previousBodyRight = document.body.style.right;
  previousBodyWidth = document.body.style.width;
  document.body.style.position = "fixed";
  document.body.style.top = `-${previousScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  document.body.style.position = previousBodyPosition;
  document.body.style.top = previousBodyTop;
  document.body.style.left = previousBodyLeft;
  document.body.style.right = previousBodyRight;
  document.body.style.width = previousBodyWidth;
  document.removeEventListener("keydown", handleKeydown);
  window.scrollTo(0, previousScrollY);
});
</script>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 180ms ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 220ms ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
