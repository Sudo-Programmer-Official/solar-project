<template>
  <Transition name="feedback-toast">
    <div
      v-if="feedback.toast"
      class="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[90] flex w-[min(calc(100%-2rem),22rem)] items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl lg:bottom-6"
      :class="feedback.toast.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'"
      :role="feedback.toast.tone === 'error' ? 'alert' : 'status'"
      aria-live="polite"
    >
      <span class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black" :class="feedback.toast.tone === 'success' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'" aria-hidden="true">{{ feedback.toast.tone === "success" ? "✓" : "!" }}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold leading-5">{{ feedback.toast.message }}</p>
        <RouterLink
          v-if="feedback.toast.action"
          :to="feedback.toast.action.route"
          class="mt-2 inline-flex min-h-8 items-center rounded-lg bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200"
          @click="feedback.dismiss"
        >
          {{ feedback.toast.action.label }}
        </RouterLink>
      </div>
      <button class="min-h-5 min-w-5 shrink-0 rounded-full px-1 text-lg leading-4 opacity-60 transition hover:opacity-100" type="button" aria-label="Dismiss notification" @click="feedback.dismiss">×</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useFeedbackStore } from "../stores/feedback.store";

const feedback = useFeedbackStore();
</script>
