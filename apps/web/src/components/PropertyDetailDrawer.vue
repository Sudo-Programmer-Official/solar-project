<template>
  <Transition name="drawer-fade">
    <button
      v-if="propertyId"
      class="fixed inset-0 z-[90] cursor-default bg-slate-950/45 backdrop-blur-[1px]"
      type="button"
      aria-label="Close property details"
      @click="emit('close')"
    />
  </Transition>

  <Transition name="drawer-slide">
    <aside
      v-if="propertyId"
      class="fixed inset-y-0 right-0 z-[95] flex w-full max-w-[520px] flex-col border-l border-slate-200 bg-[#f7f9fc] shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Property details"
    >
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
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

      <div class="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        <PropertyDetail :key="propertyId" :property-id="propertyId" embedded @close="emit('close')" />
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import PropertyDetail from "../pages/PropertyDetail.vue";

withDefaults(defineProps<{
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
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow;
  document.removeEventListener("keydown", handleKeydown);
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
