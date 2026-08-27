<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="REPORTS" title="Operating report" subtitle="Counts are calculated from the canonical lead, appointment, and Sheet-sync records.">
      <template #action><button class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></template>
    </MobileHeader>
    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Report unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p></section>
    <template v-else-if="report"><section class="grid grid-cols-2 gap-3 sm:grid-cols-4"><div v-for="metric in metrics" :key="metric.label" class="page-surface p-4"><span class="text-xs text-slate-500">{{ metric.label }}</span><strong class="mt-2 block text-2xl text-slate-900">{{ metric.value }}</strong></div></section><section class="page-surface mt-4 p-4"><p class="field-label">APPOINTMENT STATUS</p><div class="mt-3 flex flex-wrap gap-2"><span v-for="item in report.byStatus" :key="item.status" class="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{{ item.status }} · {{ item.count }}</span></div></section><section class="page-surface mt-4 p-4"><p class="field-label">OUTCOMES + SHEET SYNC</p><div class="mt-3 flex flex-wrap gap-2"><span v-for="item in report.byOutcome" :key="item.outcome" class="rounded-full bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700">{{ item.outcome }} · {{ item.count }}</span></div><p class="mt-4 text-sm text-slate-500">{{ report.sync.pending }} pending · {{ report.sync.synced }} synced · {{ report.sync.failed }} failed sync jobs</p></section></template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { getFieldReport, type FieldReport } from "../services/api";
const report = ref<FieldReport | null>(null); const error = ref("");
const metrics = computed(() => report.value ? [{ label: "Leads", value: report.value.leadCount }, { label: "Appointments", value: report.value.appointmentCount }, { label: "Closed", value: report.value.byOutcome.find((item) => item.outcome === "CLOSED")?.count ?? 0 }, { label: "Pending sync", value: report.value.sync.pending }] : []);
useOperationalRefresh(load);
async function load() { error.value = ""; try { report.value = await getFieldReport(); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load report."; } }
</script>
