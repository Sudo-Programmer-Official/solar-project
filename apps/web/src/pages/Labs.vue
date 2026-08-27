<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="LABS" title="Experimental workspace" subtitle="Discovery and experimental intelligence stay separate from daily field operations.">
      <template #action><RouterLink to="/overview" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Overview</RouterLink></template>
    </MobileHeader>
    <section class="page-surface p-4"><p class="field-label">AVAILABLE EXPERIMENTS</p><div class="mt-3 grid gap-3 sm:grid-cols-2"><RouterLink v-for="module in labModules" :key="module.id" :to="module.route" class="rounded-2xl border border-slate-200 p-4"><div class="flex items-center justify-between gap-3"><h2 class="text-base font-semibold text-slate-900">{{ module.label }}</h2><span class="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">LAB</span></div><p class="mt-2 text-sm text-slate-500">{{ description(module.id) }}</p></RouterLink></div><p v-if="labModules.length === 0" class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No Labs are enabled for this identity.</p></section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PLATFORM_MODULE_REGISTRY } from "@solar/contracts";
import MobileHeader from "../components/MobileHeader.vue";
import { useUserStore } from "../stores/user.store";
const user = useUserStore();
const labModules = computed(() => PLATFORM_MODULE_REGISTRY.filter((module) => module.parent === "LABS" && user.hasModule(module.id)));
function description(id: string) { return id === "LEAD_FINDER" ? "Location-based opportunity discovery for approved users." : id === "HOOD_NAVIGATOR" ? "Neighborhood exploration and territory clustering." : id === "INSTALLATION_SIGNALS" ? "Market signals for installation opportunity research." : "Experimental route planning."; }
</script>
