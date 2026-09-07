<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="PLATFORM OVERVIEW" title="Command center" subtitle="System-level visibility across the one canonical operations platform.">
      <template #action><button class="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 disabled:opacity-50" :disabled="loading" type="button" @click="load">{{ loading ? "Refreshing…" : "Refresh" }}</button></template>
    </MobileHeader>
    <PageSkeleton v-if="showLoading && !hasLoaded" variant="metrics" />
    <template v-else>
      <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Overview partially unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p><button class="touch-target mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button></section>
      <section v-if="report" class="grid grid-cols-2 gap-3 sm:grid-cols-4"><div v-for="metric in metrics" :key="metric.label" class="page-surface p-4"><span class="text-xs text-slate-500">{{ metric.label }}</span><strong class="mt-2 block text-2xl text-slate-900">{{ metric.value }}</strong></div></section>
      <section class="page-surface mt-4 p-4"><p class="field-label">ADMINISTRATION</p><div class="mt-3 grid gap-2 sm:grid-cols-3"><RouterLink v-for="link in links" :key="link.route" :to="link.route" class="rounded-2xl border border-slate-200 p-3"><p class="text-sm font-semibold text-slate-900">{{ link.label }}</p><p class="mt-1 text-xs text-slate-500">{{ link.description }}</p></RouterLink></div><p class="mt-4 text-sm text-slate-500">{{ teamCount }} active team record{{ teamCount === 1 ? "" : "s" }} loaded.</p></section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import PageSkeleton from "../components/PageSkeleton.vue";
import { useDelayedLoading } from "../composables/useDelayedLoading";
import { getFieldReport, getTeamMembers, type FieldReport } from "../services/api";
const report = ref<FieldReport | null>(null); const teamCount = ref(0); const error = ref(""); const loading = ref(false); const hasLoaded = ref(false);
const showLoading = useDelayedLoading(loading);
const metrics = computed(() => report.value ? [{ label: "Leads", value: report.value.leadCount }, { label: "Appointments", value: report.value.appointmentCount }, { label: "Closed", value: report.value.byOutcome.find((item) => item.outcome === "CLOSED")?.count ?? 0 }, { label: "Sync pending", value: report.value.sync.pending }] : []);
const links = [{ label: "Operations", description: "Assignments and field queue", route: "/operations" }, { label: "Team", description: "Users and role membership", route: "/team" }, { label: "System", description: "Protected access controls", route: "/system" }, { label: "Labs", description: "Experimental tools", route: "/labs" }];
onMounted(() => { void load(); });
async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    const results = await Promise.allSettled([getFieldReport(), getTeamMembers()]);
    if (results[0].status === "fulfilled") report.value = results[0].value;
    if (results[1].status === "fulfilled") teamCount.value = results[1].value.filter((member) => member.active).length;
    if (results.every((result) => result.status === "rejected")) error.value = "Platform services could not be reached.";
  } finally {
    hasLoaded.value = true;
    loading.value = false;
  }
}
</script>
