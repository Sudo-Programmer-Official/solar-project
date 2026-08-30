<template>
  <main class="px-4 pb-4">
    <MobileHeader
      eyebrow="BLACKOPS FIELD"
      title="Insights"
      subtitle="A quick view of territory performance and where to deploy next."
    />

    <section v-if="fieldReport" class="page-surface mb-4 border-cyan-200 bg-cyan-50 p-5">
      <p class="field-label text-cyan-700">CANONICAL FIELD REPORT</p>
      <div class="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div class="rounded-2xl bg-white/80 p-3"><span class="text-slate-500">Leads</span><strong class="mt-1 block text-slate-900">{{ fieldReport.leadCount }}</strong></div>
        <div class="rounded-2xl bg-white/80 p-3"><span class="text-slate-500">Appointments</span><strong class="mt-1 block text-slate-900">{{ fieldReport.appointmentCount }}</strong></div>
        <div class="rounded-2xl bg-white/80 p-3"><span class="text-slate-500">Pending assign</span><strong class="mt-1 block text-slate-900">{{ fieldStatusCount("UNASSIGNED") }}</strong></div>
        <div class="rounded-2xl bg-white/80 p-3"><span class="text-slate-500">Sheet sync</span><strong class="mt-1 block text-slate-900">{{ fieldReport.sync.pending }} pending</strong></div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2"><span v-for="item in fieldReport.byOutcome" :key="item.outcome" class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{{ item.outcome.replaceAll("_", " ") }} · {{ item.count }}</span></div>
    </section>

    <section v-if="error && !dashboard" class="page-surface border-amber-200 bg-amber-50 p-5">
      <p class="field-label text-amber-700">Insights unavailable</p>
      <p class="mt-2 text-sm leading-6 text-amber-900">{{ error }}</p>
      <button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="loadDashboard">
        Try again
      </button>
    </section>

    <template v-else-if="dashboard">
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <article v-for="metric in metrics" :key="metric.label" class="page-surface p-4">
          <p class="text-xs text-slate-500">{{ metric.label }}</p>
          <strong class="mt-2 block text-2xl tracking-tight text-slate-900">{{ metric.value }}</strong>
          <p class="mt-1 text-[11px] text-slate-500">{{ metric.note }}</p>
        </article>
      </section>

      <section class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="field-label">Deployment plan</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">Where to send reps next</h2>
          </div>
          <span class="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">{{ dashboard.anchorDate ?? "Current" }}</span>
        </div>

        <div v-if="dashboard.deploymentPlan.recommendations.length" class="mt-4 grid gap-3">
          <article v-for="(recommendation, index) in dashboard.deploymentPlan.recommendations" :key="recommendation.territory.key" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold tracking-[0.08em] text-slate-400">0{{ index + 1 }} · {{ recommendation.confidence }}</p>
                <h3 class="mt-1 text-base font-semibold text-slate-900">{{ areaLabel(recommendation.territory) }}</h3>
                <p class="mt-1 text-sm text-slate-500">{{ recommendation.suggestedReps }} rep{{ recommendation.suggestedReps === 1 ? "" : "s" }} · {{ recommendation.recentTrend.replaceAll("_", " ") }}</p>
              </div>
              <span class="rounded-2xl bg-white px-3 py-2 text-lg font-bold text-slate-900">{{ recommendation.territory.opportunityScore }}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <span v-for="reason in recommendation.reasons" :key="reason" class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">{{ reason }}</span>
            </div>
          </article>
        </div>
        <p v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No territory meets the current confidence threshold.</p>
      </section>

      <section class="page-surface mt-4 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="field-label">Territory ranking</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">Observed performance</h2>
          </div>
          <span class="text-xs font-semibold text-slate-400">{{ dashboard.ranking.length }} areas</span>
        </div>
        <div class="mt-4 grid gap-2">
          <article v-for="territory in dashboard.ranking.slice(0, 8)" :key="territory.key" class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ areaLabel(territory) }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ territory.totalSets }} sets · {{ territory.sits }} sits · {{ territory.closes }} closes</p>
            </div>
            <div class="text-right">
              <strong class="block text-sm text-slate-900">{{ territory.opportunityScore }}</strong>
              <span class="text-[11px] text-slate-500">{{ territory.closeRatePct.toFixed(1) }}% close</span>
            </div>
          </article>
        </div>
      </section>
    </template>

    <section v-else-if="!canViewIntelligence" class="page-surface p-6 text-center">
      <p class="text-base font-semibold text-slate-900">Field reports are available here.</p>
      <p class="mt-2 text-sm text-slate-500">Territory intelligence is limited to managers and administrators.</p>
    </section>

    <section v-else class="page-surface p-6 text-center">
      <p class="text-base font-semibold text-slate-900">Loading insights…</p>
      <p class="mt-2 text-sm text-slate-500">Reading the normalized appointment facts.</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { IntelligenceDashboard, TerritorySummary } from "@solar/analytics-contracts";
import MobileHeader from "../components/MobileHeader.vue";
import { getFieldReport, getIntelligenceDashboard, type FieldReport } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const canViewIntelligence = computed(() => user.can("analytics:view") || user.can("territory:view"));
const dashboard = ref<IntelligenceDashboard | null>(null);
const fieldReport = ref<FieldReport | null>(null);
const error = ref("");

const metrics = computed(() => dashboard.value ? [
  { label: "Total sets", value: dashboard.value.metrics.totalSets.toLocaleString(), note: "normalized records" },
  { label: "Sits", value: dashboard.value.metrics.sits.toLocaleString(), note: "completed appointments" },
  { label: "Closes", value: dashboard.value.metrics.closes.toLocaleString(), note: `${dashboard.value.metrics.sitToClosePct.toFixed(1)}% of sits` },
  { label: "Set → close", value: `${dashboard.value.metrics.setToClosePct.toFixed(1)}%`, note: "overall conversion" },
  { label: "Confirmed", value: dashboard.value.metrics.confirmed.toLocaleString(), note: "explicitly confirmed" },
  { label: "Cancel / DQ", value: dashboard.value.metrics.cancellationDq.toLocaleString(), note: "field leakage" },
] : []);

onMounted(() => { void Promise.all([canViewIntelligence.value ? loadDashboard() : Promise.resolve(), loadFieldReport()]); });

async function loadDashboard() {
  error.value = "";
  try {
    dashboard.value = await getIntelligenceDashboard();
    if (!dashboard.value) throw new Error("Territory intelligence is not available.");
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Territory intelligence is not available.";
  }
}

async function loadFieldReport() {
  try {
    fieldReport.value = await getFieldReport();
  } catch {
    fieldReport.value = null;
  }
}

function fieldStatusCount(status: string) {
  return fieldReport.value?.byStatus.find((item) => item.status === status)?.count ?? 0;
}

function areaLabel(territory: TerritorySummary) {
  return territory.hood && territory.hood !== territory.city ? `${territory.city} · ${territory.hood}` : territory.city;
}
</script>
