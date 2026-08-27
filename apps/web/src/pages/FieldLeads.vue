<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="LEADS" title="Field pipeline" subtitle="The canonical lead list shared by setters, closers, managers, and reports.">
      <template #action><RouterLink v-if="user.can('lead:create')" to="/leads/new" class="touch-target rounded-2xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white">+ New lead</RouterLink></template>
    </MobileHeader>
    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Leads unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p><button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button></section>
    <section v-else class="page-surface p-4">
      <div class="flex items-center justify-between gap-3"><div><p class="field-label">VISIBLE PIPELINE</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ leads.length }} lead{{ leads.length === 1 ? "" : "s" }}</h2></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></div>
      <div v-if="leads.length === 0" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"><p class="text-sm text-slate-500">No leads yet.</p><RouterLink v-if="user.can('lead:create')" to="/leads/new" class="rounded-2xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white">+ New Lead</RouterLink></div>
      <div v-else class="mt-4 grid gap-2">
        <RouterLink v-for="lead in leads" :key="lead.id" :to="`/leads/${lead.id}`" class="rounded-2xl border border-slate-200 p-4 transition hover:border-primary-300 hover:bg-primary-50/30"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="truncate text-sm font-semibold text-slate-900">{{ lead.homeownerName }}</h3><p class="mt-1 truncate text-xs text-slate-500">{{ addressLabel(lead) }}</p></div><span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ lead.status.replaceAll("_", " ") }}</span></div><p class="mt-2 text-xs text-slate-400">Updated {{ formatDate(lead.updatedAt) }}<span v-if="lead.currentCloserId"> · closer assigned</span></p></RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { getFieldLeads, type FieldLead } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const leads = ref<FieldLead[]>([]);
const error = ref("");
useOperationalRefresh(load);
async function load() { error.value = ""; try { leads.value = await getFieldLeads(); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load leads."; } }
function addressLabel(lead: FieldLead) { return [lead.addressLine1, lead.city, lead.state, lead.postalCode].filter(Boolean).join(", "); }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
</script>
