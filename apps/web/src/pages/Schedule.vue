<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="SCHEDULE" title="Shared capacity" subtitle="See open closer slots and appointments in the same operating window.">
      <template #action><button class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></template>
    </MobileHeader>
    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Schedule unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p></section>
    <template v-else>
      <section class="page-surface p-4"><p class="field-label">OPEN SLOTS</p><div v-if="slots.length === 0" class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No open closer capacity in the next 14 days.</div><div v-else class="mt-3 grid gap-2 sm:grid-cols-2"><div v-for="slot in slots" :key="slot.id" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p class="text-sm font-semibold text-emerald-950">{{ formatDate(slot.slotStart) }} · {{ formatTime(slot.slotStart) }}</p><p class="mt-1 text-xs text-emerald-800">{{ slot.closerName }} · {{ slot.capacity - slot.bookedCount }} open</p></div></div></section>
      <section class="page-surface mt-4 p-4"><p class="field-label">VISIBLE APPOINTMENTS</p><div v-if="appointments.length === 0" class="mt-3 text-sm text-slate-500">No appointments in your current scope.</div><div v-else class="mt-3 grid gap-2"><RouterLink v-for="appointment in appointments" :key="appointment.id" :to="`/leads/${appointment.leadId}`" class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"><div><p class="text-sm font-semibold text-slate-900">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p><p class="mt-1 text-xs text-slate-500">Lead {{ appointment.leadId.slice(0, 8) }}</p></div><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ appointment.outcome ?? appointment.status }}</span></RouterLink></div></section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { getFieldAppointments, getFieldAvailability, type FieldAppointment, type FieldAvailabilitySlot } from "../services/api";
const slots = ref<FieldAvailabilitySlot[]>([]);
const appointments = ref<FieldAppointment[]>([]);
const error = ref("");
useOperationalRefresh(load);
async function load() { error.value = ""; const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); const results = await Promise.allSettled([getFieldAvailability(new Date().toISOString(), to), getFieldAppointments()]); if (results[0].status === "fulfilled") slots.value = results[0].value; if (results[1].status === "fulfilled") appointments.value = results[1].value; if (results.every((result) => result.status === "rejected")) error.value = "The schedule API could not be reached."; }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
