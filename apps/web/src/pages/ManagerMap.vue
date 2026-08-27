<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="MAP" title="Team map" subtitle="A shared location view of canonical field leads. Lead discovery remains isolated in Labs.">
      <template #action><button class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></template>
    </MobileHeader>
    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Team map unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p></section>
    <section v-else class="page-surface p-4"><p class="field-label">FIELD LOCATIONS</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ leads.length }} lead locations</h2><div v-if="leads.length === 0" class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No lead locations are available.</div><div v-else class="mt-4 grid gap-2"> <RouterLink v-for="lead in leads" :key="lead.id" :to="`/leads/${lead.id}`" class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"><div><p class="text-sm font-semibold text-slate-900">{{ lead.homeownerName }}</p><p class="mt-1 text-xs text-slate-500">{{ addressLabel(lead) }}</p></div><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ lead.status }}</span></RouterLink></div></section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { getFieldLeads, type FieldLead } from "../services/api";
const leads = ref<FieldLead[]>([]); const error = ref("");
onMounted(() => { void load(); });
async function load() { try { leads.value = await getFieldLeads(); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load team locations."; } }
function addressLabel(lead: FieldLead) { return [lead.addressLine1, lead.city, lead.state, lead.postalCode].filter(Boolean).join(", "); }
</script>
