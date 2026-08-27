<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="LEAD DETAIL" :title="context?.lead.homeownerName ?? 'Lead detail'" :subtitle="context ? addressLabel(context.lead) : 'Loading canonical lead context.'">
      <template #action><RouterLink to="/leads" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Back</RouterLink></template>
    </MobileHeader>
    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Lead unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p><button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button></section>
    <template v-else-if="context">
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4"><div class="page-surface p-4"><span class="text-xs text-slate-500">Status</span><strong class="mt-1 block text-sm text-slate-900">{{ context.lead.status }}</strong></div><div class="page-surface p-4"><span class="text-xs text-slate-500">Appointments</span><strong class="mt-1 block text-sm text-slate-900">{{ context.appointments.length }}</strong></div><div class="page-surface p-4"><span class="text-xs text-slate-500">Bills</span><strong class="mt-1 block text-sm text-slate-900">{{ context.bills.length }}</strong></div><div class="page-surface p-4"><span class="text-xs text-slate-500">Sheet sync</span><strong class="mt-1 block text-sm text-slate-900">{{ context.sheetSync?.status ?? "—" }}</strong></div></section>
      <section class="page-surface mt-4 p-4"><p class="field-label">CONTACT</p><div class="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span class="text-slate-500">Phone:</span> <span class="font-semibold text-slate-900">{{ context.lead.phone || "—" }}</span></p><p><span class="text-slate-500">Email:</span> <span class="font-semibold text-slate-900">{{ context.lead.email || "—" }}</span></p><p><span class="text-slate-500">Monthly bill:</span> <span class="font-semibold text-slate-900">{{ context.lead.approximateMonthlyBill == null ? "—" : `$${context.lead.approximateMonthlyBill}` }}</span></p><p><span class="text-slate-500">Created:</span> <span class="font-semibold text-slate-900">{{ formatDate(context.lead.createdAt) }}</span></p></div></section>
      <section class="page-surface mt-4 p-4"><p class="field-label">APPOINTMENTS</p><div v-if="context.appointments.length === 0" class="mt-3 text-sm text-slate-500">No appointment has been set.</div><div v-else class="mt-3 grid gap-2"><div v-for="appointment in context.appointments" :key="appointment.id" class="rounded-2xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-3"><span class="text-sm font-semibold text-slate-900">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</span><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.outcome ?? appointment.status }}</span></div><p class="mt-1 text-xs text-slate-500">{{ appointment.closerId ? "Assigned closer" : "Waiting for manager assignment" }}<span v-if="appointment.outcomeNotes"> · {{ appointment.outcomeNotes }}</span></p></div></div></section>
      <section class="page-surface mt-4 p-4"><div class="flex items-center justify-between gap-3"><p class="field-label">NOTES + BILLS</p><span class="text-xs text-slate-400">{{ context.notes.length }} notes · {{ context.bills.length }} bills</span></div><div v-if="context.bills.length === 0" class="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Bill missing. Add a storage reference when the file is ready.</div><div v-for="bill in context.bills" :key="bill.id" class="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{{ bill.fileName }} · {{ bill.mimeType }}</div><div v-for="note in context.notes" :key="note.id" class="mt-2 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">{{ note.body }}</div><form v-if="user.can('lead:update-own') || user.can('lead:update-all')" class="mt-3 flex gap-2" @submit.prevent="saveNote"><input v-model="noteDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Add note" required /><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="submit">Add</button></form><form v-if="user.can('bill:upload')" class="mt-3 flex gap-2" @submit.prevent="saveBill"><input v-model="billDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Bill filename or storage key" required /><button class="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="submit">Attach bill</button></form></section>
      <section class="page-surface mt-4 p-4"><p class="field-label">ACTIVITY HISTORY</p><div class="mt-3 grid gap-2"><div v-for="activity in context.activities" :key="activity.id" class="flex items-center justify-between gap-3 text-xs text-slate-500"><span>{{ activity.eventType.replaceAll("_", " ") }}</span><span>{{ formatDate(activity.createdAt) }}</span></div><p v-if="context.activities.length === 0" class="text-sm text-slate-500">No activity recorded yet.</p></div></section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldBill, addFieldNote, getFieldLead, type FieldLeadContext } from "../services/api";
import { useUserStore } from "../stores/user.store";

const props = defineProps<{ id: string }>();
const user = useUserStore();
const context = ref<FieldLeadContext | null>(null);
const noteDraft = ref("");
const billDraft = ref("");
const error = ref("");
useOperationalRefresh(load);
watch(() => props.id, () => { void load(); });
async function load() { error.value = ""; try { context.value = await getFieldLead(props.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load lead."; } }
async function saveNote() { if (!context.value || !noteDraft.value.trim()) return; try { await addFieldNote(context.value.lead.id, noteDraft.value.trim()); noteDraft.value = ""; await load(); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to add note."; } }
async function saveBill() { if (!context.value || !billDraft.value.trim()) return; try { await addFieldBill(context.value.lead.id, { storageKey: billDraft.value.trim(), fileName: billDraft.value.trim(), mimeType: "application/pdf", fileSizeBytes: 0 }); billDraft.value = ""; await load(); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to attach bill."; } }
function addressLabel(lead: FieldLeadContext["lead"]) { return [lead.addressLine1, lead.city, lead.state, lead.postalCode].filter(Boolean).join(", "); }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
