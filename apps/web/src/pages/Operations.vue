<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="OPERATIONS" title="Field control center" subtitle="Capture, schedule, assign, and close the work from one canonical appointment record.">
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
          <button class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2" :disabled="saving" type="submit">{{ saving ? "Saving…" : "Save lead and view capacity" }}</button>
        </form>
        <p v-if="message" class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{{ message }}</p>
      </section>

      <section v-if="selectedLeadId && operationalSlots.length > 0" class="page-surface mt-4 p-4">
        <p class="field-label text-primary-600">OPERATIONAL CAPACITY</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Choose a slot</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <button v-for="slot in operationalSlots" :key="slot.id" class="rounded-2xl border p-3 text-left transition" :class="selectedSlotId === slot.id ? 'border-primary-400 bg-primary-50' : 'border-slate-200 bg-white'" type="button" @click="selectOperationalSlot(slot.id)">
            <span class="block text-sm font-semibold text-slate-900">{{ formatDate(slot.slotStart) }} · {{ formatTime(slot.slotStart) }}</span><span class="mt-1 block text-xs text-slate-500">{{ slot.bookedCount }}/{{ slot.standardCapacity }} standard<span v-if="slot.remainingCapacity"> · {{ slot.remainingCapacity }} open</span><span v-else> · full</span></span><span v-if="slot.overflowCount" class="mt-1 block text-xs font-semibold text-amber-700">{{ slot.overflowCount }} overflow</span>
          </button>
        </div>
        <label v-if="selectedOperationalSlot?.remainingCapacity === 0 && selectedOperationalSlot?.overflowPolicy === 'ALLOW_WITH_WARNING'" class="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><input v-model="allowOverflow" class="mt-0.5" type="checkbox" /> <span>Confirm explicit overflow booking.</span></label>
        <button class="touch-target mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="!selectedSlotId || saving || (selectedOperationalSlot?.remainingCapacity === 0 && !allowOverflow)" type="button" @click="bookAppointment">{{ saving ? "Booking…" : "Create UNASSIGNED appointment" }}</button>
      </section>
      <section v-else-if="selectedLeadId && user.can('lead:create')" class="page-surface mt-4 border-dashed p-4 text-sm text-slate-500">No operational slots are available in the next 14 days.</section>

      <section v-if="user.can('appointment:assign')" class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">CLOSER ASSIGNMENT AVAILABILITY</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Add closer availability</h2></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></div>
        <form class="mt-4 grid min-w-0 gap-3 sm:grid-cols-2" novalidate @submit.prevent="createAvailability">
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">Closer
            <select v-model="availabilityDraft.closerId" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900" required @input="availabilityError = ''"><option value="">Select closer</option><option v-for="closer in closers" :key="closer.id" :value="closer.id">{{ closer.displayName }}</option></select>
          </label>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">Capacity
            <input v-model="availabilityDraft.capacity" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 px-3 text-sm font-normal text-slate-900" min="1" max="100" type="number" @input="availabilityError = ''" />
          </label>
          <p class="self-end pb-2 text-xs text-slate-500">One availability window per closer and start time.</p>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">Starts
            <input v-model="availabilityDraft.slotStart" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 px-3 text-sm font-normal text-slate-900" type="datetime-local" required @input="availabilityError = ''" />
          </label>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">Ends
            <input v-model="availabilityDraft.slotEnd" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 px-3 text-sm font-normal text-slate-900" type="datetime-local" required @input="availabilityError = ''" />
          </label>
          <p v-if="availabilityError" class="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2" role="alert">{{ availabilityError }}</p>
          <button class="touch-target rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50 sm:col-span-2" :disabled="availabilitySaving" type="submit">{{ availabilitySaving ? "Publishing…" : "Publish availability" }}</button>
        </form>
      </section>

      <section v-if="user.can('appointment:assign') && definitions.length" class="page-surface mt-4 p-4">
        <p class="field-label text-primary-600">OPERATIONAL SLOT RULES</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Standard capacity and overflow</h2><p class="mt-1 text-xs text-slate-500">These six fixed times define booking capacity independently from closer availability.</p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2"><div v-for="definition in definitions" :key="definition.id" class="rounded-2xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><span class="text-sm font-semibold text-slate-900">{{ formatDefinitionTime(definition.startTime) }}</span><span class="text-[10px] font-semibold text-slate-400">{{ definition.source.replaceAll('_', ' ') }}</span></div><div class="mt-2 flex gap-2"><input v-model.number="definitionDraft[definition.id]" class="min-h-touch w-20 rounded-2xl border border-slate-200 px-3 text-sm" min="1" max="100" type="number" /><select v-model="policyDraft[definition.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="ALLOW_WITH_WARNING">Allow overflow with warning</option><option value="BLOCK">Block overflow</option></select><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="button" @click="saveDefinition(definition)">Save</button></div></div></div>
      </section>

      <section v-if="user.can('appointment:assign')" class="page-surface mt-4 border-primary-200 bg-primary-50/40 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">MANAGER ASSIGNMENT QUEUE</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Unassigned appointments</h2></div><span class="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-primary-700">{{ unassignedAppointments.length }}</span></div>
        <div v-if="unassignedAppointments.length === 0" class="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">No unassigned appointments need action.</div>
        <div v-else class="mt-4 grid gap-3">
          <article v-for="appointment in unassignedAppointments" :key="appointment.id" class="rounded-2xl border border-primary-200 bg-white p-4">
            <button class="w-full text-left" type="button" @click="openAppointment(appointment.id)"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-900">{{ leadName(appointment.leadId) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p></div><span class="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">UNASSIGNED</span></div></button>
            <div v-if="availableClosers[appointment.id]?.length" class="mt-3 flex gap-2"><select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="">Assign available closer</option><option v-for="closer in availableClosers[appointment.id] ?? []" :key="closer.id" :value="closer.id">{{ closer.displayName }} · {{ closer.appointmentsToday }} today</option></select><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id]" type="button" @click="assign(appointment)">Assign</button></div>
            <p v-else class="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">No eligible closer covers this appointment yet. Publish a closer availability window covering {{ formatDate(appointment.scheduledStart) }} at {{ formatTime(appointment.scheduledStart) }}, then refresh.</p>
          </article>
        </div>
      </section>

      <section class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label">CANONICAL APPOINTMENTS</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Assigned and completed visits</h2></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></div>
        <div v-if="assignedAppointments.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No assigned or completed appointments are visible for this account.</div>
        <div v-else class="mt-4 grid gap-3">
          <article v-for="appointment in assignedAppointments" :key="appointment.id" class="rounded-2xl border border-slate-200 p-4">
            <button class="w-full text-left" type="button" @click="openAppointment(appointment.id)"><div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold text-slate-900">{{ leadName(appointment.leadId) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p></div><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.status }}</span></div></button>
            <p class="mt-2 text-xs text-slate-500">{{ appointment.closerId ? `Closer assigned: ${closerName(appointment.closerId)}` : "Waiting for manager assignment" }}<span v-if="appointment.outcome"> · {{ appointment.outcome }}</span></p>
            <div v-if="user.can('appointment:assign') && (appointment.status === 'UNASSIGNED' || (['ASSIGNED', 'RESCHEDULED'].includes(appointment.status) && user.can('appointment:reassign')))" class="mt-3 flex gap-2"><select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="">{{ appointment.status === 'UNASSIGNED' ? 'Assign available closer' : 'Reassign available closer' }}</option><option v-for="closer in availableClosers[appointment.id] ?? []" :key="closer.id" :value="closer.id">{{ closer.displayName }} · {{ closer.appointmentsToday }} today</option></select><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id]" type="button" @click="assign(appointment)">{{ appointment.status === 'UNASSIGNED' ? 'Assign' : 'Reassign' }}</button></div>
            <div v-if="user.can('appointment:update-outcome') && appointment.closerId === user.id && ['ASSIGNED', 'STARTED', 'RESCHEDULED'].includes(appointment.status)" class="mt-3 flex flex-wrap gap-2"><button v-for="outcome in outcomes" :key="outcome" class="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700" type="button" @click="recordOutcome(appointment, outcome)">{{ outcome.replaceAll('_', ' ') }}</button></div>
          </article>
        </div>
      </section>

      <section v-if="selectedContext" class="page-surface mt-4 p-4">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label text-primary-600">LEAD / BILL / NOTES CONTEXT</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ selectedContext.context.lead.homeownerName }}</h2><p class="mt-1 text-sm text-slate-500">{{ selectedContext.context.lead.addressLine1 }}</p></div><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="selectedContext = null">Close</button></div>
        <div class="mt-4 grid gap-2 text-sm sm:grid-cols-3"><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Lead status</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.lead.status }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Bills</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.bills.length }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Sheet sync</span><strong class="mt-1 block text-slate-900">{{ selectedContext.context.sheetSync?.status ?? 'NOT QUEUED' }}</strong></div></div>
        <div class="mt-4 grid gap-2"><p class="field-label">Bills, notes, and activity</p><div v-for="bill in selectedContext.context.bills" :key="bill.id" class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Bill: {{ bill.fileName }} · {{ bill.mimeType }}</div><div v-for="note in selectedContext.context.notes" :key="note.id" class="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">{{ note.body }}</div><div v-for="activity in selectedContext.context.activities.slice(0, 8)" :key="activity.id" class="text-xs text-slate-500">{{ activity.eventType }} · {{ formatDate(activity.createdAt) }}</div></div>
        <form v-if="user.can('lead:update-own') || user.can('lead:update-all')" class="mt-4 flex gap-2" @submit.prevent="addNote"><input v-model="noteDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Add a note" required /><button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="submit">Add note</button></form>
        <form v-if="user.can('bill:upload')" class="mt-3 flex flex-wrap items-center gap-2" @submit.prevent="addBill">
          <input ref="billInput" class="sr-only" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif" type="file" @change="selectBill" />
          <button class="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="chooseBill">{{ selectedBillFile ? "Choose a different bill" : "Choose bill" }}</button>
          <span class="min-w-0 flex-1 truncate text-xs text-slate-500">{{ selectedBillFile?.name ?? "PDF, JPG, PNG, or HEIC · 10 MB max" }}</span>
          <button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!selectedBillFile" type="submit">Upload bill</button>
        </form>
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
import { addFieldNote, assignFieldAppointment, createFieldOperationalAppointment, createFieldAvailability, createFieldLead, getAvailableFieldClosers, getCommandCenter, getFieldAppointment, getFieldAppointments, getFieldAvailability, getFieldClosers, getFieldLeads, getFieldOperationalSlotDefinitions, getFieldOperationalSlots, getFieldReport, getTopLeads, updateFieldOperationalSlotDefinition, updateFieldOutcome, uploadFieldBill, type AvailableCloser, type FieldAppointment, type FieldLead, type FieldLeadContext, type FieldReport, type FieldAvailabilitySlot, type FieldOperationalSlot, type FieldOperationalSlotDefinition } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const dashboard = ref<TodayDashboard | null>(null);
const commandCenter = ref<RevenueCommandCenter | null>(null);
const leads = ref<FieldLead[]>([]);
const appointments = ref<FieldAppointment[]>([]);
const slots = ref<FieldAvailabilitySlot[]>([]);
const operationalSlots = ref<FieldOperationalSlot[]>([]);
const definitions = ref<FieldOperationalSlotDefinition[]>([]);
const definitionDraft = ref<Record<string, number>>({});
const policyDraft = ref<Record<string, FieldOperationalSlotDefinition["overflowPolicy"]>>({});
const closers = ref<Array<{ id: string; displayName: string; teamIds: string[] }>>([]);
const availableClosers = ref<Record<string, AvailableCloser[]>>({});
const report = ref<FieldReport | null>(null);
const selectedLeadId = ref<string | null>(null);
const selectedSlotId = ref("");
const allowOverflow = ref(false);
const selectedContext = ref<{ context: FieldLeadContext; appointment: FieldAppointment } | null>(null);
const assignmentDraft = ref<Record<string, string>>({});
const noteDraft = ref("");
const billInput = ref<HTMLInputElement | null>(null);
const selectedBillFile = ref<File | null>(null);
const error = ref("");
const message = ref("");
const saving = ref(false);
const availabilitySaving = ref(false);
const availabilityError = ref("");
const leadDraft = ref({ homeownerName: "", phone: "", email: "", addressLine1: "", city: "", state: "", postalCode: "" });
const availabilityDraft = ref({ closerId: "", slotStart: "", slotEnd: "", capacity: "1" });
const outcomes = ["CLOSED", "SAT_NOT_CLOSED", "DID_NOT_SIT", "CREDIT_FAIL", "NO_SHOW", "NOT_QUALIFIED", "FOLLOW_UP", "RESCHEDULED", "CANCELLED"];

const unassignedAppointments = computed(() => appointments.value.filter((item) => item.status === "UNASSIGNED"));
const assignedAppointments = computed(() => appointments.value.filter((item) => item.status !== "UNASSIGNED"));
const metrics = computed(() => [{ label: "Field leads", value: leads.value.length, note: "canonical lead records" }, { label: "Appointments", value: appointments.value.length, note: "visible queue" }, { label: "Unassigned", value: appointments.value.filter((item) => item.status === "UNASSIGNED").length, note: "manager action" }, { label: "Closed", value: appointments.value.filter((item) => item.outcome === "CLOSED").length, note: "recorded outcomes" }]);

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const results = await Promise.allSettled([getTopLeads(), getCommandCenter(), getFieldLeads(), getFieldAppointments(), getFieldAvailability(), getFieldClosers(), getFieldReport(), getFieldOperationalSlots(), getFieldOperationalSlotDefinitions()]);
  dashboard.value = resultValue(results[0]); commandCenter.value = resultValue(results[1]);
  leads.value = resultValue(results[2]) ?? []; appointments.value = resultValue(results[3]) ?? []; slots.value = resultValue(results[4]) ?? []; closers.value = resultValue(results[5]) ?? []; report.value = resultValue(results[6]);
  operationalSlots.value = resultValue(results[7]) ?? []; definitions.value = resultValue(results[8]) ?? [];
  for (const definition of definitions.value) { definitionDraft.value[definition.id] = definition.standardCapacity; policyDraft.value[definition.id] = definition.overflowPolicy; }
  await refreshAvailableClosers();
  if (results[2].status === "rejected" && results[3].status === "rejected") error.value = "Unable to load live field data right now.";
}

async function createLead() { saving.value = true; error.value = ""; try { const lead = await createFieldLead(leadDraft.value); leads.value = [lead, ...leads.value]; selectedLeadId.value = lead.id; selectedSlotId.value = ""; operationalSlots.value = await getFieldOperationalSlots(); message.value = "Lead saved. Choose an operational slot to create its UNASSIGNED appointment."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create the lead."; } finally { saving.value = false; } }
async function bookAppointment() { if (!selectedLeadId.value || !selectedSlotId.value) return; saving.value = true; try { const appointment = await createFieldOperationalAppointment(selectedLeadId.value, selectedSlotId.value, allowOverflow.value); appointments.value = [appointment, ...appointments.value]; leads.value = leads.value.map((lead) => lead.id === selectedLeadId.value ? { ...lead, status: "APPOINTMENT_SET" } : lead); operationalSlots.value = await getFieldOperationalSlots(); await refreshReport(); message.value = "Appointment created as UNASSIGNED."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create the appointment."; } finally { saving.value = false; } }
async function createAvailability() {
  availabilityError.value = "";
  const { closerId, slotStart, slotEnd, capacity } = availabilityDraft.value;
  const start = new Date(slotStart);
  const end = new Date(slotEnd);
  const capacityNumber = Number(capacity);
  if (!closerId || !slotStart || !slotEnd || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    availabilityError.value = "Select a closer, start date and time, and end date and time.";
    return;
  }
  if (end.getTime() <= start.getTime()) {
    availabilityError.value = "The end date and time must be after the start.";
    return;
  }
  if (!Number.isInteger(capacityNumber) || capacityNumber < 1 || capacityNumber > 100) {
    availabilityError.value = "Capacity must be a whole number from 1 to 100.";
    return;
  }
  availabilitySaving.value = true;
  try {
    await createFieldAvailability({ closerId, slotStart: start.toISOString(), slotEnd: end.toISOString(), capacity: capacityNumber });
    slots.value = await getFieldAvailability();
    await refreshAvailableClosers();
    message.value = "Closer assignment availability published.";
  } catch (cause) {
    availabilityError.value = cause instanceof Error ? cause.message : "Unable to publish availability.";
  } finally {
    availabilitySaving.value = false;
  }
}
async function saveDefinition(definition: FieldOperationalSlotDefinition) { try { const updated = await updateFieldOperationalSlotDefinition(definition.id, Math.floor(definitionDraft.value[definition.id] ?? definition.standardCapacity), policyDraft.value[definition.id] ?? definition.overflowPolicy); definitions.value = definitions.value.map((item) => item.id === updated.id ? updated : item); operationalSlots.value = await getFieldOperationalSlots(); message.value = `${formatDefinitionTime(updated.startTime)} capacity rule updated.`; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to update the operational slot rule."; } }
async function assign(appointment: FieldAppointment) { const closerId = assignmentDraft.value[appointment.id]; if (!closerId) return; try { const updated = await assignFieldAppointment(appointment.id, closerId); replaceAppointment(updated); availableClosers.value[appointment.id] = await getAvailableFieldClosers(updated.id).catch(() => []); await refreshReport(); message.value = appointment.status === "UNASSIGNED" ? "Closer assigned." : "Closer reassigned."; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to assign the closer."; } }
async function recordOutcome(appointment: FieldAppointment, outcome: string) { if (outcome === "CANCELLED" && !window.confirm("Cancel this appointment? This will release its slot capacity.")) return; try { const updated = await updateFieldOutcome(appointment.id, outcome); replaceAppointment(updated); await openAppointment(updated.id); await refreshReport(); message.value = `Outcome recorded: ${outcome}.`; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to record the outcome."; } }
async function openAppointment(id: string) { try { selectedContext.value = await getFieldAppointment(id); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to open the appointment context."; } }
async function addNote() { if (!selectedContext.value) return; try { await addFieldNote(selectedContext.value.context.lead.id, noteDraft.value, selectedContext.value.appointment.id); noteDraft.value = ""; await openAppointment(selectedContext.value.appointment.id); await refreshReport(); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to add the note."; } }
function chooseBill() { billInput.value?.click(); }
function selectBill(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"]);
  const allowedExtension = /\.(pdf|jpe?g|png|heic|heif)$/i.test(file.name);
  if ((!allowedTypes.has(file.type) && !allowedExtension) || file.size < 1 || file.size > 10 * 1024 * 1024) {
    selectedBillFile.value = null;
    error.value = "Choose a PDF, JPG, PNG, or HEIC bill smaller than 10 MB.";
    if (billInput.value) billInput.value.value = "";
    return;
  }
  error.value = "";
  selectedBillFile.value = file;
}
async function addBill() {
  if (!selectedContext.value || !selectedBillFile.value) return;
  try {
    await uploadFieldBill(selectedContext.value.context.lead.id, selectedBillFile.value);
    selectedBillFile.value = null;
    if (billInput.value) billInput.value.value = "";
    await openAppointment(selectedContext.value.appointment.id);
    await refreshReport();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to attach the bill.";
  }
}
function replaceAppointment(updated: FieldAppointment) { appointments.value = appointments.value.map((item) => item.id === updated.id ? updated : item); }
function leadName(id: string) { return leads.value.find((lead) => lead.id === id)?.homeownerName ?? "Field lead"; }
function closerName(id: string) { return closers.value.find((closer) => closer.id === id)?.displayName ?? id.slice(0, 8); }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function formatDefinitionTime(value: string) { const [hourText, minute] = value.split(":"); const hour = Number(hourText); return `${hour > 12 ? hour - 12 : hour || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`; }
const selectedOperationalSlot = computed(() => operationalSlots.value.find((slot) => slot.id === selectedSlotId.value) ?? null);
function selectOperationalSlot(id: string) { selectedSlotId.value = id; allowOverflow.value = false; }
function resultValue<T>(result: PromiseSettledResult<T>): T | null { return result.status === "fulfilled" ? result.value : null; }
async function refreshAvailableClosers() {
  if (!user.can("appointment:assign")) return;
  const candidates = await Promise.all(appointments.value.filter((appointment) => appointment.status === "UNASSIGNED" || (["ASSIGNED", "RESCHEDULED"].includes(appointment.status) && user.can("appointment:reassign"))).map(async (appointment) => [appointment.id, await getAvailableFieldClosers(appointment.id).catch(() => [])] as const));
  availableClosers.value = Object.fromEntries(candidates);
}
async function refreshReport() { try { report.value = await getFieldReport(); } catch { /* The queue mutation itself succeeded; report permissions may be narrower. */ } }
</script>
