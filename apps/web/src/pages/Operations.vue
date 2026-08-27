<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="OPERATIONS" title="Field control center" subtitle="Capture, schedule, assign, and close the work from one canonical appointment record.">
      <template #action><span class="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800">{{ user.roleLabel }}</span></template>
    </MobileHeader>

    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5">
      <p class="field-label text-amber-700">Operations unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p>
      <button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button>
    </section>

    <template v-else>
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article v-for="metric in metrics" :key="metric.label" class="page-surface p-4"><p class="text-xs text-slate-500">{{ metric.label }}</p><strong class="mt-2 block text-2xl tracking-tight text-slate-900">{{ metric.value }}</strong><p class="mt-1 text-[11px] text-slate-500">{{ metric.note }}</p></article>
      </section>

      <section v-if="user.can('lead:create')" class="page-surface mt-4 p-4">
        <p class="field-label text-primary-600">SETTER WORKFLOW</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Create a field lead</h2>
        <form class="mt-4 grid gap-2 sm:grid-cols-2" @submit.prevent="createLead">
          <input v-model="leadDraft.homeownerName" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm sm:col-span-2" placeholder="Homeowner name" required />
          <input v-model="leadDraft.phone" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Phone" type="tel" />
          <input v-model="leadDraft.email" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Email" type="email" />
          <input v-model="leadDraft.addressLine1" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm sm:col-span-2" placeholder="Street address" required />
          <input v-model="leadDraft.city" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="City" />
          <input v-model="leadDraft.state" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="State" />
          <input v-model="leadDraft.postalCode" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="ZIP" />
          <input v-model.number="leadDraft.approximateMonthlyBill" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" min="0" placeholder="Approx. monthly bill" type="number" />
          <button class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2" :disabled="saving" type="submit">{{ saving ? "Saving…" : "Save lead and view capacity" }}</button>
        </form>
        <p v-if="message" class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{{ message }}</p>
      </section>

      <section v-if="selectedLeadId && slots.length > 0" class="page-surface mt-4 p-4">
        <p class="field-label text-primary-600">AVAILABLE TEAM CAPACITY</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Choose a slot</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button v-for="slot in slots" :key="slot.id" class="rounded-2xl border p-3 text-left transition" :class="selectedSlotId === slot.id ? 'border-primary-400 bg-primary-50' : 'border-slate-200 bg-white'" type="button" @click="selectedSlotId = slot.id">
            <span class="block text-sm font-semibold text-slate-900">{{ formatDate(slot.slotStart) }} · {{ formatTime(slot.slotStart) }}</span><span class="mt-1 block text-xs text-slate-500">{{ slot.closerName }} · {{ slot.bookedCount }}/{{ slot.capacity }} capacity</span>
          </button>
        </div>
        <button class="touch-target mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="!selectedSlotId || saving" type="button" @click="bookAppointment">{{ saving ? "Booking…" : "Create UNASSIGNED appointment" }}</button>
      </section>
      <section v-else-if="selectedLeadId && user.can('lead:create')" class="page-surface mt-4 border-dashed p-4 text-sm text-slate-500">No open team-capacity slots are available in the next 14 days.</section>

      <section v-if="user.can('appointment:assign')" class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">MANAGER CAPACITY</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Add closer availability</h2></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></div>
        <form class="mt-4 grid gap-2 sm:grid-cols-2" @submit.prevent="createAvailability">
          <select v-model="availabilityDraft.closerId" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm" required><option value="">Select closer</option><option v-for="closer in closers" :key="closer.id" :value="closer.id">{{ closer.displayName }}</option></select>
          <input v-model="availabilityDraft.capacity" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" min="1" placeholder="Capacity" type="number" />
          <input v-model="availabilityDraft.slotStart" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" type="datetime-local" required />
          <input v-model="availabilityDraft.slotEnd" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" type="datetime-local" required />
          <button class="touch-target rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:col-span-2" type="submit">Publish availability</button>
        </form>
      </section>

      <section class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label">CANONICAL APPOINTMENTS</p><h2 class="mt-1 text-lg font-semibold text-slate-900">The field queue</h2></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></div>
        <div v-if="appointments.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No field appointments are visible for this account.</div>
        <div v-else class="mt-4 grid gap-3">
          <article v-for="appointment in appointments" :key="appointment.id" class="rounded-2xl border border-slate-200 p-4">
            <button class="w-full text-left" type="button" @click="openAppointment(appointment.id)"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-900">{{ leadName(appointment.leadId) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p></div><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.status }}</span></div></button>
            <p class="mt-2 text-xs text-slate-500">{{ appointment.closerId ? `Closer assigned: ${closerName(appointment.closerId)}` : "Waiting for manager assignment" }}<span v-if="appointment.outcome"> · {{ appointment.outcome }}</span></p>
            <div v-if="user.can('appointment:assign') && (appointment.status === 'UNASSIGNED' || appointment.status === 'ASSIGNED')" class="mt-3 flex gap-2"><select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="">Assign eligible closer</option><option v-for="closer in closers" :key="closer.id" :value="closer.id">{{ closer.displayName }}</option></select><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id]" type="button" @click="assign(appointment)">Assign</button></div>
            <div v-if="user.can('appointment:update-outcome') && appointment.closerId === user.id && ['ASSIGNED', 'STARTED'].includes(appointment.status)" class="mt-3 flex flex-wrap gap-2"><button v-for="outcome in outcomes" :key="outcome" class="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700" type="button" @click="recordOutcome(appointment, outcome)">{{ outcome.replaceAll('_', ' ') }}</button></div>
          </article>
        </div>
      </section>

      <section v-if="selectedContext" class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">LEAD / BILL / NOTES CONTEXT</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ selectedContext.context.lead.homeownerName }}</h2><p class="mt-1 text-sm text-slate-500">{{ selectedContext.context.lead.addressLine1 }}</p></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="selectedContext = null">Close</button></div>
        <div class="mt-4 grid gap-2 text-sm sm:grid-cols-3"><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Lead status</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.lead.status }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Bills</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.bills.length }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Sheet sync</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.sheetSync?.status ?? 'NOT QUEUED' }}</strong></div></div>
        <div class="mt-4 grid gap-2"><p class="field-label">Bills, notes, and activity</p><div v-for="bill in selectedContext.context.bills" :key="bill.id" class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Bill: {{ bill.fileName }} · {{ bill.mimeType }}</div><div v-for="note in selectedContext.context.notes" :key="note.id" class="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">{{ note.body }}</div><div v-for="activity in selectedContext.context.activities.slice(0, 8)" :key="activity.id" class="text-xs text-slate-500">{{ activity.eventType }} · {{ formatDate(activity.createdAt) }}</div></div>
        <form v-if="user.can('lead:update-own') || user.can('lead:update-all')" class="mt-4 flex gap-2" @submit.prevent="addNote"><input v-model="noteDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Add a note" required /><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="submit">Add note</button></form>
        <form v-if="user.can('bill:upload')" class="mt-3 flex gap-2" @submit.prevent="addBill"><input v-model="billDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Bill file name / storage reference" required /><button class="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="submit">Attach bill</button></form>
      </section>

      <section v-if="report" class="page-surface mt-4 p-4"><p class="field-label">REPORTS + SHEET PROJECTION</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Canonical operating totals</h2><div class="mt-3 flex flex-wrap gap-2"><span v-for="item in report.byStatus" :key="item.status" class="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{{ item.status }} · {{ item.count }}</span></div><p class="mt-3 text-xs text-slate-500">{{ report.sync.pending }} pending · {{ report.sync.synced }} synced · {{ report.sync.failed }} failed Sheet projections</p></section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { RevenueCommandCenter, TodayDashboard } from "@solar/contracts";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldBill, addFieldNote, assignFieldAppointment, createFieldAppointment, createFieldAvailability, createFieldLead, getCommandCenter, getFieldAppointment, getFieldAppointments, getFieldAvailability, getFieldClosers, getFieldLeads, getFieldReport, getTopLeads, updateFieldOutcome, type FieldAppointment, type FieldLead, type FieldLeadContext, type FieldReport, type FieldAvailabilitySlot } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const dashboard = ref<TodayDashboard | null>(null);
const commandCenter = ref<RevenueCommandCenter | null>(null);
const leads = ref<FieldLead[]>([]);
const appointments = ref<FieldAppointment[]>([]);
const slots = ref<FieldAvailabilitySlot[]>([]);
const closers = ref<Array<{ id: string; displayName: string; teamIds: string[] }>>([]);
const report = ref<FieldReport | null>(null);
const selectedLeadId = ref<string | null>(null);
const selectedSlotId = ref("");
const selectedContext = ref<{ context: FieldLeadContext; appointment: FieldAppointment } | null>(null);
const assignmentDraft = ref<Record<string, string>>({});
const noteDraft = ref("");
const billDraft = ref("");
const error = ref("");
const message = ref("");
const saving = ref(false);
const leadDraft = ref({ homeownerName: "", phone: "", email: "", addressLine1: "", city: "", state: "", postalCode: "", approximateMonthlyBill: null as number | null });
const availabilityDraft = ref({ closerId: "", slotStart: "", slotEnd: "", capacity: "1" });
const outcomes = ["SAT", "PROPOSAL", "CLOSED", "FOLLOW_UP", "NO_SHOW", "NOT_QUALIFIED", "NOT_INTERESTED", "CANCELLED"];

const metrics = computed(() => [{ label: "Field leads", value: leads.value.length, note: "canonical lead records" }, { label: "Appointments", value: appointments.value.length, note: "visible queue" }, { label: "Unassigned", value: appointments.value.filter((item) => item.status === "UNASSIGNED").length, note: "manager action" }, { label: "Closed", value: appointments.value.filter((item) => item.outcome === "CLOSED").length, note: "recorded outcomes" }]);

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const results = await Promise.allSettled([getTopLeads(), getCommandCenter(), getFieldLeads(), getFieldAppointments(), getFieldAvailability(), getFieldClosers(), getFieldReport()]);
  dashboard.value = resultValue(results[0]); commandCenter.value = resultValue(results[1]);
  leads.value = resultValue(results[2]) ?? []; appointments.value = resultValue(results[3]) ?? []; slots.value = resultValue(results[4]) ?? []; closers.value = resultValue(results[5]) ?? []; report.value = resultValue(results[6]);
  if (results[2].status === "rejected" && results[3].status === "rejected") error.value = "Unable to load live field data right now.";
}

async function createLead() { saving.value = true; error.value = ""; try { const lead = await createFieldLead(leadDraft.value); leads.value = [lead, ...leads.value]; selectedLeadId.value = lead.id; selectedSlotId.value = ""; slots.value = await getFieldAvailability(); message.value = "Lead saved. Choose a capacity slot to create its UNASSIGNED appointment."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create the lead."; } finally { saving.value = false; } }
async function bookAppointment() { if (!selectedLeadId.value || !selectedSlotId.value) return; saving.value = true; try { const appointment = await createFieldAppointment(selectedLeadId.value, selectedSlotId.value); appointments.value = [appointment, ...appointments.value]; leads.value = leads.value.map((lead) => lead.id === selectedLeadId.value ? { ...lead, status: "APPOINTMENT_SET" } : lead); slots.value = await getFieldAvailability(); await refreshReport(); message.value = "Appointment created as UNASSIGNED."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create the appointment."; } finally { saving.value = false; } }
async function createAvailability() { try { await createFieldAvailability({ closerId: availabilityDraft.value.closerId, slotStart: new Date(availabilityDraft.value.slotStart).toISOString(), slotEnd: new Date(availabilityDraft.value.slotEnd).toISOString(), capacity: Number(availabilityDraft.value.capacity) }); slots.value = await getFieldAvailability(); message.value = "Closer availability published."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to publish availability."; } }
async function assign(appointment: FieldAppointment) { const closerId = assignmentDraft.value[appointment.id]; if (!closerId) return; try { const updated = await assignFieldAppointment(appointment.id, closerId); replaceAppointment(updated); await refreshReport(); message.value = "Closer assigned."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to assign the closer."; } }
async function recordOutcome(appointment: FieldAppointment, outcome: string) { try { const updated = await updateFieldOutcome(appointment.id, outcome); replaceAppointment(updated); await openAppointment(updated.id); await refreshReport(); message.value = `Outcome recorded: ${outcome}.`; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to record the outcome."; } }
async function openAppointment(id: string) { try { selectedContext.value = await getFieldAppointment(id); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to open the appointment context."; } }
async function addNote() { if (!selectedContext.value) return; try { await addFieldNote(selectedContext.value.context.lead.id, noteDraft.value, selectedContext.value.appointment.id); noteDraft.value = ""; await openAppointment(selectedContext.value.appointment.id); await refreshReport(); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to add the note."; } }
async function addBill() { if (!selectedContext.value) return; try { await addFieldBill(selectedContext.value.context.lead.id, { storageKey: billDraft.value, fileName: billDraft.value, mimeType: "application/octet-stream", fileSizeBytes: 0 }); billDraft.value = ""; await openAppointment(selectedContext.value.appointment.id); await refreshReport(); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to attach the bill."; } }
function replaceAppointment(updated: FieldAppointment) { appointments.value = appointments.value.map((item) => item.id === updated.id ? updated : item); }
function leadName(id: string) { return leads.value.find((lead) => lead.id === id)?.homeownerName ?? "Field lead"; }
function closerName(id: string) { return closers.value.find((closer) => closer.id === id)?.displayName ?? id.slice(0, 8); }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function resultValue<T>(result: PromiseSettledResult<T>): T | null { return result.status === "fulfilled" ? result.value : null; }
async function refreshReport() { try { report.value = await getFieldReport(); } catch { /* The queue mutation itself succeeded; report permissions may be narrower. */ } }
</script>
