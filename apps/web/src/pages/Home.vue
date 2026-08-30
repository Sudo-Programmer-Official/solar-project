<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="HOME" :title="`Good ${greeting}, ${firstName}`" subtitle="Your field pipeline at a glance.">
      <template #action>
        <RouterLink v-if="user.can('lead:create')" to="/leads/new" class="touch-target inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold leading-5 text-white shadow-sm transition hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200">+ New lead</RouterLink>
      </template>
    </MobileHeader>

    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5">
      <p class="field-label text-amber-700">Field dashboard unavailable</p>
      <p class="mt-2 text-sm text-amber-900">{{ error }}</p>
      <button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button>
    </section>

    <template v-else>
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article v-for="metric in metrics" :key="metric.label" class="page-surface p-4">
          <p class="text-xs text-slate-500">{{ metric.label }}</p>
          <strong class="mt-2 block text-2xl tracking-tight text-slate-900">{{ metric.value }}</strong>
          <p class="mt-1 text-[11px] text-slate-500">{{ metric.note }}</p>
        </article>
      </section>

      <section class="page-surface mt-4 p-4">
        <div class="flex items-center justify-between gap-3">
          <div><p class="field-label">NEEDS ATTENTION</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Keep the pipeline moving</h2></div>
          <RouterLink to="/leads" class="text-xs font-semibold text-primary-700">View leads</RouterLink>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div class="rounded-2xl bg-amber-50 p-3"><span class="text-xs text-amber-800">Unassigned</span><strong class="mt-1 block text-lg text-amber-950">{{ unassignedCount }}</strong></div>
          <div class="rounded-2xl bg-rose-50 p-3"><span class="text-xs text-rose-800">Missing bills</span><strong class="mt-1 block text-lg text-rose-950">{{ missingBillCount }}</strong></div>
          <div class="rounded-2xl bg-cyan-50 p-3"><span class="text-xs text-cyan-800">Follow-ups</span><strong class="mt-1 block text-lg text-cyan-950">{{ followUpCount }}</strong></div>
        </div>
      </section>

      <section v-if="dueFollowUps.length" class="page-surface mt-4 p-4">
        <div class="flex items-center justify-between gap-3"><div><p class="field-label">NEEDS ATTENTION</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Follow-ups due today</h2></div><RouterLink to="/follow-ups" class="text-xs font-semibold text-primary-700">Open follow-ups</RouterLink></div>
        <div class="mt-3 grid gap-2"><RouterLink v-for="followUp in dueFollowUps.slice(0, 3)" :key="followUp.id" :to="`/leads/${followUp.leadId}`" class="rounded-2xl border border-slate-200 p-3"><p class="text-sm font-semibold text-slate-900">{{ followUp.homeownerName }}</p><p class="mt-1 text-xs text-slate-500">{{ followUp.reason }} · {{ followUp.note || "Reconnect with homeowner" }}</p></RouterLink></div>
      </section>

      <section class="page-surface mt-4 p-4">
        <div class="flex items-center justify-between gap-3"><div><p class="field-label">RECENT LEADS</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Your latest work</h2></div><RouterLink to="/leads" class="text-xs font-semibold text-primary-700">See all</RouterLink></div>
        <div v-if="leads.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No field leads yet.</div>
        <div v-else class="mt-3 divide-y divide-slate-100">
          <RouterLink v-for="lead in leads.slice(0, 5)" :key="lead.id" :to="`/leads/${lead.id}`" class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ lead.homeownerName }}</p><p class="mt-1 truncate text-xs text-slate-500">{{ lead.addressLine1 }}</p></div>
            <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ lead.status.replaceAll("_", " ") }}</span>
          </RouterLink>
        </div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { getFieldAppointments, getFieldFollowUps, getFieldLead, getFieldLeads, type FieldAppointment, type FieldFollowUp, type FieldLead } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const leads = ref<FieldLead[]>([]);
const appointments = ref<FieldAppointment[]>([]);
const followUps = ref<FieldFollowUp[]>([]);
const missingBillCount = ref(0);
const error = ref("");
const firstName = computed(() => user.displayName.split(" ")[0] || "operator");
const greeting = computed(() => {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
});
const unassignedCount = computed(() => appointments.value.filter((appointment) => appointment.status === "UNASSIGNED").length);
const dueFollowUps = computed(() => { const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0); const start = new Date(); start.setHours(0, 0, 0, 0); return followUps.value.filter((item) => (item.status === "OPEN" || item.status === "SNOOZED") && new Date(item.dueAt) >= start && new Date(item.dueAt) < tomorrow); });
const followUpCount = computed(() => dueFollowUps.value.length);
const closedCount = computed(() => leads.value.filter((lead) => lead.status === "CLOSED").length);
const metrics = computed(() => [
  { label: "Leads", value: leads.value.length, note: "visible pipeline" },
  { label: "Appointments", value: appointments.value.length, note: "visible queue" },
  { label: "Sits", value: appointments.value.filter((appointment) => ["CLOSED", "SAT_NOT_CLOSED", "CREDIT_FAIL", "DID_NOT_SIT"].includes(appointment.outcome ?? "")).length, note: "recorded results" },
  { label: "Closed", value: closedCount.value, note: "closed leads" },
]);

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const [leadResult, appointmentResult, followUpResult] = await Promise.allSettled([getFieldLeads(), getFieldAppointments(), getFieldFollowUps()]);
  if (leadResult.status === "fulfilled") leads.value = leadResult.value;
  if (appointmentResult.status === "fulfilled") appointments.value = appointmentResult.value;
  if (followUpResult.status === "fulfilled") followUps.value = followUpResult.value;
  if (leadResult.status === "rejected" && appointmentResult.status === "rejected") {
    error.value = "Unable to load live field data right now.";
    return;
  }
  const contexts = await Promise.all(leads.value.map((lead) => getFieldLead(lead.id).catch(() => null)));
  missingBillCount.value = contexts.filter((context) => context?.bills.length === 0).length;
}
</script>
