<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="APPOINTMENTS" title="Your appointment queue" subtitle="Open the full lead context, record the outcome, and keep the setter loop current.">
      <template #action><div class="flex items-center gap-2"><RouterLink v-if="user.can('lead:create')" to="/leads/new" class="rounded-2xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white">+ New lead</RouterLink><span class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{{ appointments.length }} total</span></div></template>
    </MobileHeader>

    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5">
      <p class="field-label text-amber-700">Appointments unavailable</p>
      <p class="mt-2 text-sm text-amber-900">{{ error }}</p>
      <button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button>
    </section>

    <section v-else class="page-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <div><p class="field-label">FIELD QUEUE</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Appointments</h2></div>
        <button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button>
      </div>
      <div v-if="appointments.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No appointments are visible for this account.</div>
      <div v-else class="mt-4 grid gap-3">
        <article v-for="appointment in appointments" :key="appointment.id" class="rounded-2xl border border-slate-200 p-4">
          <button class="w-full text-left" type="button" @click="openAppointment(appointment.id)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ leadName(appointment.leadId) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p></div>
              <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.outcome ?? appointment.status }}</span>
            </div>
          </button>
          <p class="mt-2 text-xs text-slate-500">{{ appointment.closerId ? `Closer: ${closerName(appointment.closerId)}` : "UNASSIGNED · waiting for manager" }}</p>
          <div v-if="user.can('appointment:assign') && ['UNASSIGNED', 'ASSIGNED'].includes(appointment.status)" class="mt-3 flex gap-2">
            <select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="">Assign eligible closer</option><option v-for="closer in closers" :key="closer.id" :value="closer.id">{{ closer.displayName }}</option></select>
            <button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id]" type="button" @click="assign(appointment)">Assign</button>
          </div>
          <div v-if="user.can('appointment:update-outcome') && appointment.closerId === user.id && ['ASSIGNED', 'STARTED'].includes(appointment.status)" class="mt-3 flex flex-wrap gap-2">
            <button v-for="outcome in outcomes" :key="outcome" class="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700" type="button" @click="recordOutcome(appointment, outcome)">{{ outcome.replaceAll('_', ' ') }}</button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="selectedContext" class="page-surface mt-4 p-4">
      <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">LEAD CONTEXT</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ selectedContext.context.lead.homeownerName }}</h2><p class="mt-1 text-sm text-slate-500">{{ selectedContext.context.lead.addressLine1 }}</p></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="selectedContext = null">Close</button></div>
      <div class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Lead</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.lead.status }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Bills</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.bills.length }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Notes</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.notes.length }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Sheet</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.sheetSync?.status ?? "—" }}</strong></div></div>
      <div class="mt-4 grid gap-2"><p class="field-label">Notes and activity</p><div v-if="selectedContext.context.bills.length === 0" class="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">No bill attached yet.</div><div v-for="bill in selectedContext.context.bills" :key="bill.id" class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{{ bill.fileName }} · {{ bill.mimeType }}</div><div v-for="note in selectedContext.context.notes" :key="note.id" class="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">{{ note.body }}</div><div v-for="activity in selectedContext.context.activities.slice(0, 8)" :key="activity.id" class="text-xs text-slate-500">{{ activity.eventType }} · {{ formatDate(activity.createdAt) }}</div></div>
      <form v-if="user.can('lead:update-own') || user.can('lead:update-all')" class="mt-4 flex gap-2" @submit.prevent="addNote"><input v-model="noteDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Add a note" required /><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="submit">Add note</button></form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldNote, assignFieldAppointment, getFieldAppointment, getFieldAppointments, getFieldClosers, getFieldLeads, updateFieldOutcome, type FieldAppointment, type FieldLead, type FieldLeadContext } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const appointments = ref<FieldAppointment[]>([]);
const leads = ref<FieldLead[]>([]);
const closers = ref<Array<{ id: string; displayName: string; teamIds: string[] }>>([]);
const selectedContext = ref<{ context: FieldLeadContext; appointment: FieldAppointment } | null>(null);
const assignmentDraft = ref<Record<string, string>>({});
const noteDraft = ref("");
const error = ref("");
const outcomes = ["SAT", "PROPOSAL", "CLOSED", "FOLLOW_UP", "NO_SHOW", "NOT_QUALIFIED", "NOT_INTERESTED", "CANCELLED"] as const;

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const [appointmentResult, leadResult, closerResult] = await Promise.allSettled([getFieldAppointments(), getFieldLeads(), user.can("appointment:assign") ? getFieldClosers() : Promise.resolve([])]);
  if (appointmentResult.status === "fulfilled") appointments.value = appointmentResult.value;
  if (leadResult.status === "fulfilled") leads.value = leadResult.value;
  if (closerResult.status === "fulfilled") closers.value = closerResult.value;
  if (appointmentResult.status === "rejected") error.value = "The appointment queue could not be loaded.";
}

async function openAppointment(id: string) {
  try { selectedContext.value = await getFieldAppointment(id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load appointment context."; }
}

async function assign(appointment: FieldAppointment) {
  const closerId = assignmentDraft.value[appointment.id];
  if (!closerId) return;
  try { const updated = await assignFieldAppointment(appointment.id, closerId); replaceAppointment(updated); assignmentDraft.value[appointment.id] = ""; await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to assign appointment."; }
}

async function recordOutcome(appointment: FieldAppointment, outcome: string) {
  try { const updated = await updateFieldOutcome(appointment.id, outcome); replaceAppointment(updated); await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to record outcome."; }
}

async function addNote() {
  if (!selectedContext.value || !noteDraft.value.trim()) return;
  try { await addFieldNote(selectedContext.value.context.lead.id, noteDraft.value.trim(), selectedContext.value.appointment.id); noteDraft.value = ""; await openAppointment(selectedContext.value.appointment.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to add note."; }
}

function replaceAppointment(updated: FieldAppointment) { appointments.value = appointments.value.map((item) => item.id === updated.id ? updated : item); }
function leadName(id: string) { return leads.value.find((lead) => lead.id === id)?.homeownerName ?? `Lead ${id.slice(0, 8)}`; }
function closerName(id: string) { return closers.value.find((closer) => closer.id === id)?.displayName ?? `Closer ${id.slice(0, 8)}`; }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
