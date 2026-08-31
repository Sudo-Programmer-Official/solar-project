<template>
  <main class="px-4 pb-28">
    <div class="mx-auto max-w-3xl">
      <MobileHeader eyebrow="SCHEDULE" title="Today" subtitle="A simple agenda for the six operational field times.">
        <template #action><button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></template>
      </MobileHeader>

      <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">SCHEDULE UNAVAILABLE</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p><button class="touch-target mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button></section>
      <section v-else class="page-surface p-4 sm:p-5">
        <div class="flex items-start justify-between gap-3"><div><p class="field-label">TODAY'S AGENDA</p><h2 class="mt-1 text-xl font-semibold text-slate-950">{{ todayLabel }}</h2></div><span class="rounded-full bg-primary-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-700">6 fixed times</span></div>
        <div v-if="todaySlots.length === 0" class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No operational times are available today.</div>
        <div v-else class="mt-5 grid gap-3">
          <article v-for="slot in todaySlots" :key="slot.id" class="rounded-2xl border p-4" :class="slot.overflowCount ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'">
            <div class="flex min-w-0 items-center justify-between gap-3"><div class="min-w-0"><p class="text-lg font-bold text-slate-950">{{ formatOperationalTime(slot.startTime) }}</p><p class="mt-1 break-words text-xs font-semibold text-slate-500">{{ operationalSlotStateLabel(slot) }}<span class="font-normal"> · {{ slot.bookedCount }}/{{ slot.standardCapacity }} booked</span><span v-if="slot.overflowCount"> · {{ slot.overflowCount }} overflow</span></p></div><span v-if="slot.overflowCount" class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-amber-800">Overflow</span><span v-else-if="slot.remainingCapacity > 0" class="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-700">{{ slot.remainingCapacity }} open</span><span v-else class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-600">Full</span></div>
            <div v-if="appointmentsForSlot(slot).length" class="mt-3 grid gap-2">
              <RouterLink v-for="appointment in appointmentsForSlot(slot)" :key="appointment.id" :to="`/leads/${appointment.leadId}`" class="flex min-h-[60px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 transition hover:border-primary-300"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ leadName(appointment.leadId) }}</p><p class="mt-1 text-xs text-slate-500">{{ appointment.closerId ? "Closer assigned" : "Closer: Awaiting assignment" }}<span v-if="appointment.isOverflow"> · Overflow</span></p></div><span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.outcome ?? appointment.status }}</span></RouterLink>
            </div>
            <p v-else class="mt-3 rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">No appointments</p>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { getFieldAppointments, getFieldLeads, getFieldOperationalSlots, type FieldAppointment, type FieldLead, type FieldOperationalSlot } from "../services/api";
import { formatOperationalTime, localDayWindow, oneSlotPerDateAndTime, operationalSlotStateLabel } from "../utils/operational-slots";

const slots = ref<FieldOperationalSlot[]>([]);
const appointments = ref<FieldAppointment[]>([]);
const leads = ref<FieldLead[]>([]);
const error = ref("");
const todayLabel = computed(() => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
const todaySlots = computed(() => oneSlotPerDateAndTime(slots.value).sort((a, b) => a.startTime.localeCompare(b.startTime)));
const leadsById = computed(() => new Map(leads.value.map((lead) => [lead.id, lead])));

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const { from, to } = localDayWindow();
  const results = await Promise.allSettled([getFieldOperationalSlots(from, to), getFieldAppointments(), getFieldLeads()]);
  if (results[0].status === "fulfilled") slots.value = results[0].value;
  if (results[1].status === "fulfilled") appointments.value = results[1].value;
  if (results[2].status === "fulfilled") leads.value = results[2].value;
  if (results.every((result) => result.status === "rejected")) error.value = "The schedule API could not be reached.";
}

function appointmentsForSlot(slot: FieldOperationalSlot): FieldAppointment[] {
  const ids = new Set(slot.appointments.map((appointment) => appointment.id));
  return appointments.value.filter((appointment) => {
    if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status)) return false;
    return ids.has(appointment.id) || (!appointment.operationalSlotId && sameLocalTime(appointment.scheduledStart, slot.slotStart));
  }).sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}

function sameLocalTime(first: string, second: string): boolean {
  const a = new Date(first);
  const b = new Date(second);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() && a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
}

function leadName(id: string) { return leadsById.value.get(id)?.homeownerName ?? `Lead ${id.slice(0, 8)}`; }
</script>
