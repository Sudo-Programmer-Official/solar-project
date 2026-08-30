<template>
  <main class="px-4 pb-28">
    <div class="mx-auto max-w-xl">
      <MobileHeader eyebrow="APPOINTMENT" :title="context?.lead.homeownerName ?? 'Schedule homeowner'" subtitle="Pick one fixed field time. Closer assignment happens after booking.">
        <template #action><RouterLink :to="`/leads/${id}`" class="touch-target inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Lead detail</RouterLink></template>
      </MobileHeader>

      <section v-if="loading" class="page-surface p-5 text-sm text-slate-500">Loading homeowner and appointment times…</section>
      <section v-else-if="error" class="page-surface border-amber-200 bg-amber-50 p-5">
        <p class="field-label text-amber-700">SCHEDULING UNAVAILABLE</p>
        <p class="mt-2 text-sm text-amber-900">{{ error }}</p>
        <button class="touch-target mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button>
      </section>

      <template v-else-if="context">
        <section class="page-surface p-4 sm:p-5">
          <p class="field-label">HOMEOWNER</p>
          <h2 class="mt-1 text-xl font-semibold text-slate-950">{{ context.lead.homeownerName }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ addressLabel(context.lead) }}</p>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div class="rounded-2xl bg-slate-50 p-3"><span class="text-xs text-slate-500">Bill</span><strong class="mt-1 block text-sm text-slate-900">{{ billStatus }}</strong></div>
            <div class="rounded-2xl bg-slate-50 p-3"><span class="text-xs text-slate-500">Notes</span><strong class="mt-1 block text-sm text-slate-900">{{ context.notes.length ? `${context.notes.length} saved` : "None yet" }}</strong></div>
          </div>
        </section>

        <p v-if="savedWithoutAppointment" class="mt-4 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-900">Lead saved. Appointment is optional—you can choose a time now or leave this homeowner unscheduled.</p>

        <section v-if="bookedAppointment" class="page-surface mt-4 border-emerald-200 p-5 sm:p-6">
          <div class="flex items-start gap-3"><span class="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span><div><p class="field-label text-emerald-700">APPOINTMENT BOOKED</p><h2 class="mt-1 text-xl font-semibold text-slate-950">{{ context.lead.homeownerName }}</h2></div></div>
          <dl class="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div><dt class="text-xs text-slate-500">Homeowner</dt><dd class="mt-1 font-semibold text-slate-900">{{ context.lead.homeownerName }}</dd></div>
            <div><dt class="text-xs text-slate-500">Date / time</dt><dd class="mt-1 font-semibold text-slate-900">{{ formatDate(bookedAppointment.scheduledStart) }} · {{ formatTime(bookedAppointment.scheduledStart) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Bill</dt><dd class="mt-1 font-semibold text-slate-900">{{ billStatus }}</dd></div>
            <div><dt class="text-xs text-slate-500">Assignment</dt><dd class="mt-1 font-semibold text-slate-900">{{ bookedAppointment.closerId ? "Closer assigned" : "Closer: Awaiting assignment" }}</dd></div>
          </dl>
          <RouterLink :to="`/leads/${id}`" class="touch-target mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Open homeowner record</RouterLink>
        </section>

        <section v-else class="page-surface mt-4 p-4 sm:p-5">
          <OperationalSlotPicker v-model="selectedSlotId" v-model:allow-overflow="allowOverflow" :slots="slots" @confirm="bookAppointment" />
          <p v-if="bookingError" class="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ bookingError }}</p>
        </section>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MobileHeader from "../components/MobileHeader.vue";
import OperationalSlotPicker from "../components/OperationalSlotPicker.vue";
import { createFieldOperationalAppointment, getFieldLead, getFieldOperationalSlots, type FieldAppointment, type FieldLeadContext, type FieldOperationalSlot } from "../services/api";

const props = defineProps<{ id: string }>();
const route = useRoute();
const id = computed(() => props.id);
const context = ref<FieldLeadContext | null>(null);
const slots = ref<FieldOperationalSlot[]>([]);
const bookedAppointment = ref<FieldAppointment | null>(null);
const selectedSlotId = ref("");
const allowOverflow = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const bookingError = ref("");
const savedWithoutAppointment = computed(() => route.query.mode === "saved");
const billStatus = computed(() => context.value?.bills.some((bill) => bill.replacedBy == null) ? "Received" : "Missing");

watch(() => props.id, () => { void load(); });
void load();

async function load() {
  loading.value = true;
  error.value = "";
  bookingError.value = "";
  try {
    const [leadContext, operationalSlots] = await Promise.all([getFieldLead(props.id), getUpcomingSlots()]);
    context.value = leadContext;
    slots.value = operationalSlots;
    bookedAppointment.value = leadContext.appointments.find((appointment) => !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status)) ?? null;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Unable to load scheduling.";
  } finally {
    loading.value = false;
  }
}

async function getUpcomingSlots() {
  const from = new Date();
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return getFieldOperationalSlots(from.toISOString(), to.toISOString());
}

async function bookAppointment() {
  if (!context.value || !selectedSlotId.value || saving.value) return;
  saving.value = true;
  bookingError.value = "";
  try {
    bookedAppointment.value = await createFieldOperationalAppointment(context.value.lead.id, selectedSlotId.value, allowOverflow.value);
    context.value = await getFieldLead(context.value.lead.id);
  } catch (caught) {
    bookingError.value = caught instanceof Error ? caught.message : "That time changed. Choose another slot.";
    slots.value = await getUpcomingSlots().catch(() => slots.value);
  } finally {
    saving.value = false;
  }
}

function addressLabel(lead: FieldLeadContext["lead"]) { return [lead.addressLine1, lead.city, lead.state, lead.postalCode].filter(Boolean).join(", "); }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
