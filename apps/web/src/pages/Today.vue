<template>
  <main class="min-w-0 overflow-x-hidden px-4 pb-28">
    <div class="mx-auto max-w-7xl">
      <MobileHeader eyebrow="TODAY · FIELD COMMAND" title="Daily command dashboard" subtitle="See what is happening today, assign what is waiting, and clear the next issue without leaving this page.">
        <template #action>
          <button class="touch-target inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary-300 disabled:opacity-50" type="button" :disabled="loading" @click="load">{{ loading ? "Refreshing…" : "Refresh" }}</button>
        </template>
      </MobileHeader>

      <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5" role="alert">
        <p class="field-label text-amber-700">TODAY PARTIALLY UNAVAILABLE</p>
        <p class="mt-2 text-sm text-amber-900">{{ error }}</p>
        <button class="touch-target mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button>
      </section>

      <section class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Today's summary">
        <article v-for="metric in metrics" :key="metric.label" class="page-surface min-w-0 p-4">
          <p class="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{{ metric.label }}</p>
          <strong class="mt-2 block text-2xl font-bold tracking-tight text-slate-950">{{ metric.value }}</strong>
          <p class="mt-1 text-xs leading-4 text-slate-500">{{ metric.note }}</p>
        </article>
      </section>

      <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)] xl:items-start">
        <section class="page-surface min-w-0 p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="field-label">SIX-SLOT DISPATCH</p>
              <h2 class="mt-1 text-xl font-semibold tracking-tight text-slate-950">{{ todayLabel }}</h2>
            </div>
            <RouterLink to="/schedule" class="touch-target inline-flex shrink-0 items-center rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary-300">Full schedule</RouterLink>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article v-for="slot in slotSummaries" :key="slot.key" class="min-w-0 rounded-2xl border p-3" :class="slot.unassignedCount ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="text-lg font-bold text-slate-950">{{ slot.label }}</h3>
                  <p class="mt-1 text-xs font-semibold leading-4 text-slate-500">{{ bookedLabel(slot) }} · {{ slot.assignedCount }} assigned · {{ slot.unassignedCount }} needs closer</p>
                </div>
                <span class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em]" :class="slot.unassignedCount ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'">{{ slot.unassignedCount ? "Action" : "On track" }}</span>
              </div>

              <div v-if="slot.appointments.length" class="mt-3 grid gap-2">
                <div v-for="appointment in slot.appointments" :key="appointment.id" class="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <div class="flex min-w-0 items-start justify-between gap-2">
                    <RouterLink :to="`/leads/${appointment.leadId}`" class="min-w-0 truncate text-sm font-semibold text-slate-900 hover:text-primary-700">{{ customerName(appointment) }}</RouterLink>
                    <span class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide" :class="statusClasses(appointment)">{{ appointmentStatus(appointment) }}</span>
                  </div>
                  <p class="mt-1 truncate text-xs text-slate-500">{{ appointment.closerId ? closerName(appointment) : "Closer: Awaiting assignment" }}</p>
                  <p v-if="appointment.needsCloserReview" class="mt-1 text-[11px] font-semibold text-rose-700">Assigned closer is unavailable · review</p>

                  <div v-if="appointment.status === 'UNASSIGNED' && canAssign" class="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-700" :disabled="assigning[appointment.id]" @focus="ensureAvailableClosers(appointment)">
                      <option value="">{{ availableClosers[appointment.id] ? "Select available closer" : "Load available closers" }}</option>
                      <option v-for="closer in availableClosers[appointment.id] ?? []" :key="closer.id" :value="closer.id">{{ closer.displayName }} · {{ closer.appointmentsToday }} today</option>
                    </select>
                    <button class="min-h-touch rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" type="button" :disabled="!assignmentDraft[appointment.id] || assigning[appointment.id]" @click="assign(appointment)">{{ assigning[appointment.id] ? "Assigning…" : "Assign" }}</button>
                  </div>
                  <p v-if="canAssign && !availableClosers[appointment.id] && appointment.status === 'UNASSIGNED'" class="mt-1 text-[11px] text-slate-400">Tap the selector to check conflict-free AVAILABLE closers.</p>
                  <p v-if="assignmentError[appointment.id]" class="mt-1 text-[11px] leading-4 text-red-600">{{ assignmentError[appointment.id] }}</p>
                  <p v-if="assignmentMessage[appointment.id]" class="mt-1 text-[11px] font-semibold text-emerald-700">{{ assignmentMessage[appointment.id] }}</p>
                </div>
              </div>
              <p v-else class="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">No appointments</p>
            </article>
          </div>
        </section>

        <aside class="grid min-w-0 gap-4">
          <section class="page-surface p-4 sm:p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="field-label">NEEDS ATTENTION</p>
                <h2 class="mt-1 text-xl font-semibold tracking-tight text-slate-950">Clear the blockers</h2>
              </div>
              <span v-if="attentionCount" class="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{{ attentionCount }}</span>
            </div>

            <div v-if="attentionItems.length" class="mt-4 grid gap-2">
              <RouterLink v-for="item in attentionItems" :key="item.label" :to="item.route" class="flex min-h-touch items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 transition hover:border-primary-300">
                <span class="min-w-0"><strong class="block text-sm text-slate-900">{{ item.label }}</strong><span class="mt-0.5 block text-xs text-slate-500">{{ item.note }}</span></span>
                <span class="shrink-0 text-lg font-bold text-slate-950">{{ item.value }}</span>
              </RouterLink>
            </div>
            <p v-else class="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Nothing urgent in today’s command queue.</p>

            <div v-if="unavailableAssignments.length" class="mt-4 border-t border-slate-100 pt-4">
              <p class="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Future review</p>
              <div class="mt-2 grid gap-2">
                <RouterLink v-for="appointment in unavailableAssignments.slice(0, 3)" :key="appointment.id" to="/appointments" class="rounded-xl bg-rose-50 px-3 py-2.5">
                  <p class="truncate text-sm font-semibold text-rose-900">{{ customerName(appointment) }}</p>
                  <p class="mt-1 truncate text-xs text-rose-700">{{ closerName(appointment) }} · {{ formatAppointmentDate(appointment.scheduledStart) }}</p>
                </RouterLink>
              </div>
              <RouterLink v-if="unavailableAssignments.length > 3" to="/appointments" class="mt-2 inline-flex text-xs font-semibold text-rose-700">Review all {{ unavailableAssignments.length }} appointments →</RouterLink>
            </div>
          </section>

          <section class="page-surface p-4 sm:p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="field-label">TEAM TODAY</p>
                <h2 class="mt-1 text-xl font-semibold tracking-tight text-slate-950">Closer coverage</h2>
              </div>
              <RouterLink to="/team" class="text-xs font-semibold text-primary-700">Manage team</RouterLink>
            </div>
            <div v-if="closers.length" class="mt-4 grid gap-2">
              <div v-for="closer in closers" :key="closer.id" class="flex min-h-touch items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                <div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ closer.displayName }}</p><p class="mt-0.5 text-[11px] font-semibold uppercase tracking-wide" :class="closer.availabilityStatus === 'UNAVAILABLE' ? 'text-rose-700' : 'text-emerald-700'">{{ closer.availabilityStatus === 'UNAVAILABLE' ? '● Unavailable' : '● Available' }}</p></div>
                <span v-if="closer.availabilityStatus === 'UNAVAILABLE'" class="shrink-0 text-[11px] font-semibold text-rose-700">Review</span>
              </div>
            </div>
            <p v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No active closers are visible in your team scope.</p>
          </section>
        </aside>
      </div>

      <section class="page-surface mt-4 p-4 sm:p-5">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div><p class="field-label">FOLLOW-UP QUEUE</p><h2 class="mt-1 text-xl font-semibold tracking-tight text-slate-950">Keep the callback loop moving</h2></div>
          <RouterLink to="/follow-ups" class="touch-target inline-flex items-center rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary-300">Open follow-ups</RouterLink>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RouterLink v-for="item in followUpSummary" :key="item.label" to="/follow-ups" class="rounded-2xl bg-slate-50 p-3 transition hover:bg-primary-50"><p class="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{{ item.label }}</p><strong class="mt-1 block text-xl text-slate-950">{{ item.value }}</strong></RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { assignFieldAppointment, getAvailableFieldClosers, getFieldAppointments, getFieldFollowUps, getFieldOperationalSlots, getTeamMembers, type AvailableCloser, type FieldAppointment, type FieldFollowUp, type FieldOperationalSlot, type TeamMember } from "../services/api";
import { useUserStore } from "../stores/user.store";
import { formatOperationalTime, localDayWindow, oneSlotPerDateAndTime } from "../utils/operational-slots";

type SlotSummary = {
  key: string;
  label: string;
  capacity: number | null;
  bookedCount: number;
  assignedCount: number;
  unassignedCount: number;
  appointments: FieldAppointment[];
};

const FIXED_TIMES = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
const user = useUserStore();
const appointments = ref<FieldAppointment[]>([]);
const operationalSlots = ref<FieldOperationalSlot[]>([]);
const followUps = ref<FieldFollowUp[]>([]);
const teamMembers = ref<TeamMember[]>([]);
const availableClosers = ref<Record<string, AvailableCloser[]>>({});
const assignmentDraft = ref<Record<string, string>>({});
const assigning = ref<Record<string, boolean>>({});
const assignmentError = ref<Record<string, string>>({});
const assignmentMessage = ref<Record<string, string>>({});
const error = ref("");
const loading = ref(false);

const canAssign = computed(() => user.can("appointment:assign"));
const todayDateKey = computed(() => localDateKey(new Date()));
const todayLabel = computed(() => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
const todayAppointments = computed(() => appointments.value.filter((appointment) => isToday(appointment.scheduledStart) && appointment.status !== "CANCELLED"));
const unassignedToday = computed(() => todayAppointments.value.filter((appointment) => appointment.status === "UNASSIGNED"));
const assignedToday = computed(() => todayAppointments.value.filter((appointment) => Boolean(appointment.closerId)));
const completedToday = computed(() => todayAppointments.value.filter((appointment) => appointment.status === "COMPLETED" || appointment.outcome === "CLOSED"));
const missingBillsToday = computed(() => todayAppointments.value.filter((appointment) => appointment.hasBill === false));
const activeFollowUps = computed(() => followUps.value.filter((followUp) => followUp.status === "OPEN" || followUp.status === "SNOOZED"));
const followUpsDueToday = computed(() => activeFollowUps.value.filter((followUp) => followUp.dueAt != null && isToday(followUp.dueAt)));
const overdueFollowUps = computed(() => activeFollowUps.value.filter((followUp) => followUp.dueAt != null && new Date(followUp.dueAt).getTime() < Date.now()));
const closers = computed(() => teamMembers.value.filter((member) => member.active && member.roles.includes("CLOSER")));
const unavailableCloserIds = computed(() => new Set(closers.value.filter((closer) => closer.availabilityStatus === "UNAVAILABLE").map((closer) => closer.id)));
const unavailableAssignments = computed(() => appointments.value.filter((appointment) => Boolean(appointment.closerId) && isFuture(appointment.scheduledStart) && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status) && (appointment.needsCloserReview === true || appointment.closerAvailabilityStatus === "UNAVAILABLE" || unavailableCloserIds.value.has(appointment.closerId ?? ""))));
const metrics = computed(() => [
  { label: "Appointments", value: todayAppointments.value.length, note: "booked today" },
  { label: "Unassigned", value: unassignedToday.value.length, note: "need a closer" },
  { label: "Assigned", value: assignedToday.value.length, note: "closer confirmed" },
  { label: "Completed / closed", value: completedToday.value.length, note: "outcomes recorded" },
  { label: "Missing bills", value: missingBillsToday.value.length, note: "need follow-through" },
  { label: "Follow-ups due", value: followUpsDueToday.value.length, note: "due today" },
]);
const attentionItems = computed(() => [
  { label: "Unassigned appointments", value: unassignedToday.value.length, note: "Assign a closer from the slot card.", route: "/appointments" },
  { label: "Missing bills", value: missingBillsToday.value.length, note: "Open the appointment or lead to collect it.", route: "/appointments" },
  { label: "Overdue follow-ups", value: overdueFollowUps.value.length, note: "Callbacks that need attention first.", route: "/follow-ups" },
  { label: "Unavailable closer reviews", value: unavailableAssignments.value.length, note: "Future appointments retained for manager review.", route: "/appointments" },
].filter((item) => item.value > 0));
const attentionCount = computed(() => attentionItems.value.reduce((total, item) => total + item.value, 0));
const followUpSummary = computed(() => [
  { label: "Due today", value: followUpsDueToday.value.length },
  { label: "Overdue", value: overdueFollowUps.value.length },
  { label: "Open", value: activeFollowUps.value.length },
  { label: "Closers away", value: closers.value.filter((closer) => closer.availabilityStatus === "UNAVAILABLE").length },
]);
const slotSummaries = computed<SlotSummary[]>(() => {
  const slotsByTime = new Map(oneSlotPerDateAndTime(operationalSlots.value.filter((slot) => slot.slotDate === todayDateKey.value)).map((slot) => [slot.startTime.slice(0, 5), slot]));
  return FIXED_TIMES.map((time) => {
    const slot = slotsByTime.get(time) ?? null;
    const slotAppointments = appointmentsForSlot(time, slot);
    const activeSlotAppointments = slotAppointments.filter((appointment) => appointment.status !== "CANCELLED");
    return {
      key: `${todayDateKey.value}-${time}`,
      label: formatOperationalTime(time),
      capacity: slot?.standardCapacity ?? null,
      bookedCount: slot?.bookedCount ?? activeSlotAppointments.length,
      assignedCount: activeSlotAppointments.filter((appointment) => Boolean(appointment.closerId)).length,
      unassignedCount: activeSlotAppointments.filter((appointment) => appointment.status === "UNASSIGNED").length,
      appointments: activeSlotAppointments.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()),
    };
  });
});

useOperationalRefresh(load);

async function load(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  const { from, to } = localDayWindow();
  const results = await Promise.allSettled([getFieldAppointments(), getFieldOperationalSlots(from, to), getFieldFollowUps(), getTeamMembers()]);
  if (results[0].status === "fulfilled") appointments.value = results[0].value;
  if (results[1].status === "fulfilled") operationalSlots.value = results[1].value;
  if (results[2].status === "fulfilled") followUps.value = results[2].value;
  if (results[3].status === "fulfilled") teamMembers.value = results[3].value;
  if (results[0].status === "rejected") error.value = "Today’s appointment data could not be loaded.";
  if (results.every((result) => result.status === "rejected")) error.value = "Today’s command data could not be loaded.";
  loading.value = false;
}

async function ensureAvailableClosers(appointment: FieldAppointment): Promise<void> {
  if (availableClosers.value[appointment.id]) return;
  availableClosers.value[appointment.id] = await getAvailableFieldClosers(appointment.id).catch(() => []);
}

async function assign(appointment: FieldAppointment): Promise<void> {
  const closerId = assignmentDraft.value[appointment.id];
  if (!closerId || assigning.value[appointment.id]) return;
  assigning.value[appointment.id] = true;
  assignmentError.value[appointment.id] = "";
  assignmentMessage.value[appointment.id] = "";
  try {
    const updated = await assignFieldAppointment(appointment.id, closerId);
    replaceAppointment(updated);
    assignmentDraft.value[appointment.id] = "";
    assignmentMessage.value[appointment.id] = `Assigned to ${updated.closerName ?? availableClosers.value[appointment.id]?.find((closer) => closer.id === closerId)?.displayName ?? "closer"} ✓`;
    availableClosers.value[appointment.id] = await getAvailableFieldClosers(appointment.id).catch(() => availableClosers.value[appointment.id] ?? []);
    const window = localDayWindow();
    operationalSlots.value = await getFieldOperationalSlots(window.from, window.to).catch(() => operationalSlots.value);
  } catch (cause) {
    assignmentError.value[appointment.id] = cause instanceof Error ? cause.message : "Unable to assign the closer. Choose another AVAILABLE closer.";
  } finally {
    assigning.value[appointment.id] = false;
  }
}

function replaceAppointment(updated: FieldAppointment): void {
  appointments.value = appointments.value.map((appointment) => appointment.id === updated.id ? updated : appointment);
}

function appointmentsForSlot(time: string, slot: FieldOperationalSlot | null): FieldAppointment[] {
  const slotIds = new Set(slot?.appointments.map((appointment) => appointment.id) ?? []);
  return todayAppointments.value.filter((appointment) => slotIds.has(appointment.id) || (!appointment.operationalSlotId && sameLocalTime(appointment.scheduledStart, time)));
}

function sameLocalTime(value: string, time: string): boolean {
  const date = new Date(value);
  return localDateKey(date) === todayDateKey.value && `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` === time;
}

function isToday(value: string): boolean {
  return localDateKey(new Date(value)) === todayDateKey.value;
}

function isFuture(value: string): boolean {
  return new Date(value).getTime() > Date.now();
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function customerName(appointment: FieldAppointment): string {
  return appointment.homeownerName ?? `Lead ${appointment.leadId.slice(0, 8)}`;
}

function closerName(appointment: FieldAppointment): string {
  return appointment.closerName ?? (appointment.closerId ? `Closer ${appointment.closerId.slice(0, 8)}` : "Unassigned");
}

function appointmentStatus(appointment: FieldAppointment): string {
  if (appointment.outcome === "CLOSED") return "Closed";
  if (appointment.status === "UNASSIGNED") return "Needs closer";
  return appointment.status.replaceAll("_", " ");
}

function statusClasses(appointment: FieldAppointment): string {
  if (appointment.status === "UNASSIGNED") return "bg-amber-100 text-amber-800";
  if (appointment.outcome === "CLOSED" || appointment.status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  return "bg-white text-slate-600";
}

function bookedLabel(slot: SlotSummary): string {
  return slot.capacity == null ? `${slot.bookedCount} booked` : `${slot.bookedCount}/${slot.capacity} booked`;
}

function formatAppointmentDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
</script>
