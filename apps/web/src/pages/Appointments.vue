<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="APPOINTMENTS" title="Your appointment queue" subtitle="Open the full lead context, record the outcome, and keep the setter loop current.">
      <template #action><div class="flex items-center gap-2"><RouterLink v-if="user.can('lead:create')" to="/leads/new" class="touch-target inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold leading-5 text-white shadow-sm transition hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200">+ New lead</RouterLink><span class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{{ appointments.length }} total</span></div></template>
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
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2"><label class="text-xs font-semibold text-slate-500">Filter <select v-model="statusFilter" class="ml-1 min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"><option value="ACTIVE">Active</option><option value="UNASSIGNED">Unassigned</option><option value="CANCELLED">Cancelled</option><option value="RESCHEDULED">Rescheduled</option><option value="COMPLETED">Completed</option><option value="ALL">All</option></select></label><span class="text-xs text-slate-500">{{ visibleAppointments.length }} shown · {{ appointments.length }} total</span></div>
      <div v-if="visibleAppointments.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No appointments match this filter.</div>
      <div v-else class="mt-4 grid gap-3">
        <article v-for="appointment in visibleAppointments" :key="appointment.id" class="rounded-2xl border border-slate-200 p-4">
          <button class="w-full text-left" type="button" @click="openAppointment(appointment.id)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ leadName(appointment.leadId) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p></div>
              <span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.outcome ?? appointment.status }}</span>
            </div>
          </button>
          <p class="mt-2 text-xs text-slate-500">{{ appointment.closerId ? `Closer: ${closerName(appointment.closerId)}` : "UNASSIGNED · waiting for manager" }}<span v-if="appointment.isOverflow"> · Overflow</span><span v-if="appointment.cancelReason"> · {{ appointment.cancelReason }}</span></p>
          <div v-if="(user.can('appointment:cancel') || user.can('appointment:reschedule')) && !['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(appointment.status)" class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><template v-if="user.can('appointment:cancel')"><input v-model="cancelReason[appointment.id]" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 px-3 text-xs" placeholder="Cancellation reason" /><button class="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50" :disabled="!cancelReason[appointment.id]?.trim()" type="button" @click="cancel(appointment)">Cancel</button></template><button v-if="user.can('appointment:reschedule')" class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="rescheduleTarget = rescheduleTarget === appointment.id ? '' : appointment.id">Reschedule</button></div>
          <div v-if="rescheduleTarget === appointment.id" class="mt-3 rounded-2xl border border-primary-200 bg-primary-50 p-4"><OperationalSlotPicker v-model="rescheduleSlot[appointment.id]" v-model:allow-overflow="rescheduleOverflow[appointment.id]" :slots="operationalSlots" :sticky="false" cta-verb="Move to" @confirm="reschedule(appointment)" /></div>
          <div v-if="user.can('appointment:assign') && (appointment.status === 'UNASSIGNED' || (['ASSIGNED', 'RESCHEDULED'].includes(appointment.status) && user.can('appointment:reassign')) )" class="mt-3 flex gap-2">
            <select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="">{{ appointment.status === 'UNASSIGNED' ? 'Assign available closer' : 'Reassign available closer' }}</option><option v-for="closer in availableClosers[appointment.id] ?? []" :key="closer.id" :value="closer.id">{{ closer.displayName }} · {{ closer.appointmentsToday }} today</option></select>
            <button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id]" type="button" @click="assign(appointment)">{{ appointment.status === 'UNASSIGNED' ? 'Assign' : 'Reassign' }}</button>
          </div>
          <div v-if="user.can('appointment:update-outcome') && appointment.closerId === user.id && ['ASSIGNED', 'STARTED', 'RESCHEDULED'].includes(appointment.status)" class="mt-3 rounded-2xl bg-primary-50 p-3">
            <p class="field-label text-primary-700">CLOSER RESULT</p>
            <div class="mt-2 flex flex-wrap gap-2"><button v-for="outcome in outcomes" :key="outcome" class="rounded-full border px-3 py-2 text-xs font-semibold" :class="selectedOutcome === outcome ? 'border-primary-600 bg-primary-600 text-white' : 'border-primary-200 bg-white text-primary-700'" type="button" @click="selectedOutcome = outcome">{{ outcome.replaceAll('_', ' ') }}</button></div>
            <textarea v-model="closerNoteDraft" class="mt-3 min-h-20 w-full rounded-2xl border border-primary-200 bg-white p-3 text-sm" placeholder="What happened at the appointment?" />
            <button class="mt-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!selectedOutcome" type="button" @click="recordOutcome(appointment)">Save result</button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="selectedContext" class="page-surface mt-4 p-4">
      <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">LEAD CONTEXT</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ selectedContext.context.lead.homeownerName }}</h2><p class="mt-1 text-sm text-slate-500">{{ selectedContext.context.lead.addressLine1 }}</p></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="selectedContext = null">Close</button></div>
      <div class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Lead</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.lead.status }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Bills</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.bills.length }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Notes</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.notes.length }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Sheet</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.sheetSync?.status ?? "—" }}</strong></div></div>
      <div class="mt-4 grid gap-3">
        <div><p class="field-label">SETTER NOTES</p><div v-for="note in selectedContext.context.notes.filter((note) => !isCloserNote(note))" :key="note.id" class="mt-2 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700"><p>{{ note.body }}</p><p class="mt-1 text-[11px] text-slate-400">{{ note.authorName || 'Setter' }} · {{ formatDate(note.createdAt) }}</p></div><p v-if="selectedContext.context.notes.filter((note) => !isCloserNote(note)).length === 0" class="mt-2 text-sm text-slate-500">No setter notes.</p></div>
        <div><p class="field-label">CLOSER NOTES</p><div v-for="note in selectedContext.context.notes.filter(isCloserNote)" :key="note.id" class="mt-2 rounded-2xl border border-primary-200 bg-primary-50 p-3 text-sm text-slate-700"><p>{{ note.body }}</p><p class="mt-1 text-[11px] text-slate-500">{{ note.authorName || 'Closer' }} · {{ formatDate(note.createdAt) }}</p></div><p v-if="selectedContext.context.notes.filter(isCloserNote).length === 0" class="mt-2 text-sm text-slate-500">No closer notes.</p></div>
        <div><p class="field-label">ACTIVITY</p><div v-for="activity in selectedContext.context.activities.slice(0, 8)" :key="activity.id" class="text-xs text-slate-500">{{ activity.eventType.replaceAll('_', ' ') }} · {{ activity.actorName || 'System' }} · {{ formatDate(activity.createdAt) }}</div></div>
      </div>
      <form v-if="user.can('lead:update-own') || user.can('lead:update-all')" class="mt-4 flex gap-2" @submit.prevent="addNote"><input v-model="noteDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Add a note" required /><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="submit">Add note</button></form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import OperationalSlotPicker from "../components/OperationalSlotPicker.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldNote, assignFieldAppointment, cancelFieldAppointment, getAvailableFieldClosers, getFieldAppointment, getFieldAppointments, getFieldLeads, getFieldOperationalSlots, rescheduleFieldAppointment, updateFieldOutcome, type AvailableCloser, type FieldAppointment, type FieldLead, type FieldLeadContext, type FieldOperationalSlot } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const appointments = ref<FieldAppointment[]>([]);
const leads = ref<FieldLead[]>([]);
const operationalSlots = ref<FieldOperationalSlot[]>([]);
const availableClosers = ref<Record<string, AvailableCloser[]>>({});
const selectedContext = ref<{ context: FieldLeadContext; appointment: FieldAppointment } | null>(null);
const assignmentDraft = ref<Record<string, string>>({});
const noteDraft = ref("");
const closerNoteDraft = ref("");
const selectedOutcome = ref("");
const cancelReason = ref<Record<string, string>>({});
const rescheduleTarget = ref("");
const rescheduleSlot = ref<Record<string, string>>({});
const rescheduleOverflow = ref<Record<string, boolean>>({});
const statusFilter = ref<"ACTIVE" | "UNASSIGNED" | "CANCELLED" | "RESCHEDULED" | "COMPLETED" | "ALL">("ACTIVE");
const error = ref("");
const outcomes = ["CLOSED", "SAT_NOT_CLOSED", "DID_NOT_SIT", "CREDIT_FAIL", "NO_SHOW", "NOT_QUALIFIED", "FOLLOW_UP", "RESCHEDULED", "CANCELLED"] as const;
const visibleAppointments = computed(() => appointments.value.filter((appointment) => {
  if (statusFilter.value === "ALL") return true;
  if (statusFilter.value === "ACTIVE") return !["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status);
  if (statusFilter.value === "COMPLETED") return appointment.status === "COMPLETED" || appointment.status === "NO_SHOW";
  return appointment.status === statusFilter.value;
}));

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const [appointmentResult, leadResult, slotResult] = await Promise.allSettled([getFieldAppointments(), getFieldLeads(), getFieldOperationalSlots()]);
  if (appointmentResult.status === "fulfilled") appointments.value = appointmentResult.value;
  if (leadResult.status === "fulfilled") leads.value = leadResult.value;
  if (slotResult.status === "fulfilled") operationalSlots.value = slotResult.value;
  if (appointmentResult.status === "rejected") error.value = "The appointment queue could not be loaded.";
  if (appointmentResult.status === "fulfilled" && user.can("appointment:assign")) {
    const candidates = await Promise.all(appointmentResult.value.filter((appointment) => appointment.status === "UNASSIGNED" || (["ASSIGNED", "RESCHEDULED"].includes(appointment.status) && user.can("appointment:reassign"))).map(async (appointment) => [appointment.id, await getAvailableFieldClosers(appointment.id).catch(() => [])] as const));
    availableClosers.value = Object.fromEntries(candidates);
  }
}

async function openAppointment(id: string) {
  try { selectedContext.value = await getFieldAppointment(id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load appointment context."; }
}

async function assign(appointment: FieldAppointment) {
  const closerId = assignmentDraft.value[appointment.id];
  if (!closerId) return;
  try { const updated = await assignFieldAppointment(appointment.id, closerId); replaceAppointment(updated); assignmentDraft.value[appointment.id] = ""; availableClosers.value[appointment.id] = await getAvailableFieldClosers(updated.id).catch(() => []); await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to assign appointment."; }
}

async function recordOutcome(appointment: FieldAppointment) {
  if (!selectedOutcome.value) return;
  if (selectedOutcome.value === "CANCELLED" && !window.confirm("Cancel this appointment? This will release its slot capacity.")) return;
  try { const updated = await updateFieldOutcome(appointment.id, selectedOutcome.value, closerNoteDraft.value.trim() || undefined); replaceAppointment(updated); selectedOutcome.value = ""; closerNoteDraft.value = ""; await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to record outcome."; }
}

async function cancel(appointment: FieldAppointment) {
  const reason = cancelReason.value[appointment.id]?.trim();
  if (!reason) return;
  if (!window.confirm(`Cancel the appointment for ${leadName(appointment.leadId)}? This will release its slot capacity.`)) return;
  try { const updated = await cancelFieldAppointment(appointment.id, reason); replaceAppointment(updated); cancelReason.value[appointment.id] = ""; } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to cancel appointment."; }
}

async function reschedule(appointment: FieldAppointment) {
  const slotId = rescheduleSlot.value[appointment.id];
  if (!slotId) return;
  try { const updated = await rescheduleFieldAppointment(appointment.id, slotId, rescheduleOverflow.value[appointment.id] === true); replaceAppointment(updated); rescheduleTarget.value = ""; rescheduleSlot.value[appointment.id] = ""; rescheduleOverflow.value[appointment.id] = false; operationalSlots.value = await getFieldOperationalSlots(); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to reschedule appointment."; }
}

async function addNote() {
  if (!selectedContext.value || !noteDraft.value.trim()) return;
  try { await addFieldNote(selectedContext.value.context.lead.id, noteDraft.value.trim(), selectedContext.value.appointment.id); noteDraft.value = ""; await openAppointment(selectedContext.value.appointment.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to add note."; }
}

function replaceAppointment(updated: FieldAppointment) { appointments.value = appointments.value.map((item) => item.id === updated.id ? updated : item); }
function leadName(id: string) { return leads.value.find((lead) => lead.id === id)?.homeownerName ?? `Lead ${id.slice(0, 8)}`; }
function closerName(id: string) { return availableClosers.value[selectedContext.value?.appointment.id ?? ""]?.find((closer) => closer.id === id)?.displayName ?? `Closer ${id.slice(0, 8)}`; }
function isCloserNote(note: FieldLeadContext["notes"][number]) {
  const appointment = selectedContext.value?.appointment;
  return note.authorRole === "CLOSER" || (Boolean(appointment?.closerId) && note.appointmentId === appointment?.id && note.authorId === appointment?.closerId);
}
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
