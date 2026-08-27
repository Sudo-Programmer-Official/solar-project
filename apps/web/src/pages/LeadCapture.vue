<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="LEADS" title="Create a lead" subtitle="Capture the homeowner once, then choose an open closer-capacity slot.">
      <template #action><RouterLink to="/leads" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">All leads</RouterLink></template>
    </MobileHeader>

    <section class="page-surface p-4">
      <form class="grid gap-2 sm:grid-cols-2" @submit.prevent="saveLead">
        <input v-model="draft.homeownerName" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm sm:col-span-2" placeholder="Homeowner name" required />
        <input v-model="draft.phone" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Phone" type="tel" />
        <input v-model="draft.email" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Email" type="email" />
        <input v-model="draft.addressLine1" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm sm:col-span-2" placeholder="Street address" required />
        <input v-model="draft.city" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="City" />
        <input v-model="draft.state" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="State" />
        <input v-model="draft.postalCode" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="ZIP" />
        <input v-model.number="draft.approximateMonthlyBill" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" min="0" placeholder="Approx. monthly bill" type="number" />
        <button class="touch-target rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2" :disabled="saving" type="submit">{{ saving ? "Saving…" : "Save lead" }}</button>
      </form>
      <p v-if="message" class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{{ message }}</p>
      <p v-if="error" class="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ error }}</p>
    </section>

    <section v-if="leadId" class="page-surface mt-4 p-4">
      <p class="field-label text-primary-600">AVAILABLE TEAM CAPACITY</p>
      <h2 class="mt-1 text-lg font-semibold text-slate-900">Choose a slot</h2>
      <div v-if="slots.length === 0" class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No open slots are available in the next 14 days. A manager can publish closer availability from Operations.</div>
      <div v-else class="mt-3 grid gap-2 sm:grid-cols-2">
        <button v-for="slot in slots" :key="slot.id" class="rounded-2xl border p-3 text-left transition" :class="selectedSlotId === slot.id ? 'border-primary-400 bg-primary-50' : 'border-slate-200 bg-white'" type="button" @click="selectedSlotId = slot.id"><span class="block text-sm font-semibold text-slate-900">{{ formatDate(slot.slotStart) }} · {{ formatTime(slot.slotStart) }}</span><span class="mt-1 block text-xs text-slate-500">{{ slot.closerName }} · {{ slot.bookedCount }}/{{ slot.capacity }} capacity</span></button>
      </div>
      <button v-if="slots.length" class="touch-target mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="!selectedSlotId || saving" type="button" @click="bookAppointment">{{ saving ? "Booking…" : "Create UNASSIGNED appointment" }}</button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import MobileHeader from "../components/MobileHeader.vue";
import { createFieldAppointment, createFieldLead, getFieldAvailability, type FieldAvailabilitySlot } from "../services/api";

const router = useRouter();
const draft = ref({ homeownerName: "", phone: "", email: "", addressLine1: "", city: "", state: "", postalCode: "", approximateMonthlyBill: null as number | null });
const slots = ref<FieldAvailabilitySlot[]>([]);
const leadId = ref<string | null>(null);
const selectedSlotId = ref("");
const saving = ref(false);
const message = ref("");
const error = ref("");

async function saveLead() {
  saving.value = true; error.value = ""; message.value = "";
  try {
    const lead = await createFieldLead(draft.value);
    leadId.value = lead.id;
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    slots.value = await getFieldAvailability(new Date().toISOString(), to);
    message.value = "Lead saved. Choose an open capacity slot to set the appointment.";
  } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to create lead."; }
  finally { saving.value = false; }
}

async function bookAppointment() {
  if (!leadId.value || !selectedSlotId.value) return;
  saving.value = true; error.value = "";
  try { await createFieldAppointment(leadId.value, selectedSlotId.value); await router.replace(`/leads/${leadId.value}`); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : "That slot is no longer available."; }
  finally { saving.value = false; }
}

function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
