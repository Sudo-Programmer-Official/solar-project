<template>
  <main class="box-border w-full min-w-0 max-w-full overflow-x-hidden px-4 pb-28">
    <div class="mx-auto box-border w-full min-w-0 max-w-3xl">
      <MobileHeader eyebrow="LEADS" title="Create a lead" subtitle="Homeowner, bill, notes, then choose one of six field times.">
        <template #action><RouterLink to="/leads" class="touch-target inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">All leads</RouterLink></template>
      </MobileHeader>

      <section class="page-surface box-border w-full min-w-0 max-w-full overflow-hidden p-4 sm:p-6">
        <form class="box-border grid w-full min-w-0 max-w-full gap-5" @submit.prevent="saveLead">
          <div>
            <p class="field-label">HOMEOWNER</p>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label class="block min-w-0 sm:col-span-2"><span class="sr-only">Homeowner name</span><input v-model="draft.homeownerName" class="field-control" placeholder="Homeowner name" autocomplete="name" required /></label>
              <label class="block min-w-0"><span class="sr-only">Phone</span><input v-model="draft.phone" class="field-control" placeholder="Phone" autocomplete="tel" type="tel" /></label>
              <label class="block min-w-0"><span class="sr-only">Email</span><input v-model="draft.email" class="field-control" placeholder="Email (optional)" autocomplete="email" type="email" /></label>
            </div>
          </div>

          <div>
            <p class="field-label">PROPERTY ADDRESS</p>
            <label class="mt-3 block min-w-0"><span class="sr-only">Property address</span><input v-model="draft.propertyAddress" class="field-control" placeholder="123 Maple St, Johnstown, PA 15901" autocomplete="street-address" required /></label>
            <details class="mt-3 min-w-0 max-w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <summary class="cursor-pointer text-sm font-semibold text-slate-700">Add address details</summary>
              <div class="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
                <input v-model="draft.addressLine1" class="field-control min-w-0 sm:col-span-3" placeholder="Street address" autocomplete="address-line1" />
                <input v-model="draft.city" class="field-control min-w-0" placeholder="City" autocomplete="address-level2" />
                <input v-model="draft.state" class="field-control min-w-0" placeholder="State" autocomplete="address-level1" />
                <input v-model="draft.postalCode" class="field-control min-w-0" placeholder="ZIP" autocomplete="postal-code" inputmode="numeric" />
              </div>
            </details>
          </div>

          <div class="box-border w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-primary-200 bg-primary-50 p-4">
            <div class="flex min-w-0 items-start justify-between gap-4">
              <div class="min-w-0 flex-1"><p class="field-label text-primary-700">UTILITY BILL <span class="tracking-normal text-slate-500">OPTIONAL</span></p><p class="mt-1 max-w-full text-sm text-slate-600">Upload a PDF or photo now, or add it after the lead is saved.</p></div>
              <span class="hidden rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-primary-700 sm:inline">PDF · JPG · PNG · HEIC</span>
            </div>
            <input ref="billInput" class="sr-only" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif" type="file" @change="selectBill" />
            <button class="touch-target mt-4 inline-flex w-full min-w-0 max-w-full items-center justify-center rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white sm:w-auto" type="button" @click="billInput?.click()">+ {{ billFile ? "Replace bill" : "Upload bill" }}</button>
            <div v-if="billFile" class="mt-3 flex w-full min-w-0 max-w-full flex-col gap-1.5 overflow-hidden rounded-2xl bg-white px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"><div class="min-w-0 max-w-full flex-1 overflow-hidden"><p class="truncate whitespace-nowrap font-semibold text-slate-900">{{ billFile.name }}</p><p class="mt-1 flex min-w-0 max-w-full items-center gap-1 text-xs"><span class="shrink-0 text-slate-500">{{ formatBytes(billFile.size) }}</span><span class="shrink-0 text-slate-400" aria-hidden="true">·</span><span class="min-w-0 truncate font-semibold" :class="uploadState === 'failed' ? 'text-red-600' : uploadState === 'uploaded' ? 'text-emerald-600' : 'text-slate-500'">{{ uploadLabel }}</span></p></div></div>
            <p v-if="uploadError" class="mt-2 text-xs font-semibold text-red-700">{{ uploadError }}</p>
          </div>

          <div class="min-w-0">
            <p class="field-label">NOTES</p>
            <textarea v-model="draft.notes" class="field-control mt-3 min-h-28 py-3" placeholder="Anything the closer should know..." rows="4" />
            <p class="mt-2 text-xs text-slate-500">Notes are added to the activity history and can be extended later.</p>
          </div>

          <section class="box-border w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-5">
            <div class="flex min-w-0 items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="field-label text-primary-700">APPOINTMENT <span class="tracking-normal text-slate-500">OPTIONAL</span></p>
                <p class="mt-1 text-sm text-slate-600">Ask for availability now. Capacity is checked again when you save.</p>
              </div>
              <span class="hidden rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:inline">6 fixed times</span>
            </div>
            <div v-if="loadingSlots" class="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">Loading available times…</div>
            <div v-else-if="slotsError" class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p class="text-sm font-semibold text-amber-900">{{ slotsError }}</p>
              <button class="touch-target mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="button" @click="loadSlots">Try again</button>
            </div>
            <div v-else class="min-w-0 max-w-full">
              <OperationalSlotPicker
                v-model="selectedSlotId"
                v-model:allow-overflow="allowOverflow"
                :slots="slots"
                :show-cta="false"
                :sticky="false"
              />
            </div>
          </section>

          <div class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 grid w-full min-w-0 max-w-full gap-3 border-t border-slate-100 bg-white/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:border-t sm:bg-transparent sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
            <button class="touch-target box-border w-full min-w-0 max-w-full rounded-2xl bg-cyan-700 px-4 py-3 text-center text-base font-bold text-white shadow-sm transition hover:bg-cyan-800 active:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100" :disabled="saving || requiresOverflowConfirmation" type="submit">{{ saving ? "Saving lead…" : selectedSlotId ? "Save lead & appointment" : "Save lead" }}</button>
            <p class="text-center text-xs leading-5 text-slate-500">{{ selectedSlotId ? "The selected time is rechecked before the lead is saved." : "Appointment is optional—you can add one later." }}</p>
          </div>
        </form>
        <p v-if="error" class="mt-4 rounded-2xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{{ error }}</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import OperationalSlotPicker from "../components/OperationalSlotPicker.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldNote, createFieldLead, createFieldLeadWithAppointment, getFieldOperationalSlots, uploadFieldBill, type FieldOperationalSlot } from "../services/api";
import { useRouter } from "vue-router";

const router = useRouter();
const billInput = ref<HTMLInputElement | null>(null);
const draft = ref({ homeownerName: "", phone: "", email: "", propertyAddress: "", addressLine1: "", city: "", state: "", postalCode: "", notes: "" });
const billFile = ref<File | null>(null);
const slots = ref<FieldOperationalSlot[]>([]);
const selectedSlotId = ref("");
const allowOverflow = ref(false);
const loadingSlots = ref(true);
const slotsError = ref("");
const saving = ref(false);
const error = ref("");
const uploadError = ref("");
const uploadState = ref<"idle" | "uploading" | "uploaded" | "failed">("idle");
const selectedSlot = computed(() => slots.value.find((slot) => slot.id === selectedSlotId.value) ?? null);
const requiresOverflowConfirmation = computed(() => Boolean(selectedSlot.value && selectedSlot.value.bookedCount > 0 && selectedSlot.value.overflowPolicy === "ALLOW_WITH_WARNING" && !allowOverflow.value));
const uploadLabel = computed(() => uploadState.value === "uploading" ? "Uploading…" : uploadState.value === "uploaded" ? "Uploaded ✓" : uploadState.value === "failed" ? "Upload failed — retry" : "Ready to upload");

useOperationalRefresh(loadSlots);

async function loadSlots() {
  loadingSlots.value = true;
  slotsError.value = "";
  try {
    slots.value = await getFieldOperationalSlots();
  } catch (caught) {
    slotsError.value = caught instanceof Error ? caught.message : "Appointment availability is unavailable.";
  } finally {
    loadingSlots.value = false;
  }
}

async function saveLead() {
  saving.value = true;
  error.value = "";
  uploadError.value = "";
  try {
    const address = parseAddress();
    const input = {
      homeownerName: draft.value.homeownerName.trim(),
      phone: draft.value.phone.trim() || null,
      email: draft.value.email.trim() || null,
      addressLine1: address.addressLine1,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
    };

    if (selectedSlotId.value) {
      const created = await createFieldLeadWithAppointment(input, selectedSlotId.value, allowOverflow.value);
      if (draft.value.notes.trim()) await addFieldNote(created.lead.id, draft.value.notes.trim());
      if (billFile.value) await uploadBill(created.lead.id);
      await router.replace({ path: `/leads/${created.lead.id}`, query: { appointment: "booked" } });
      return;
    }

    const lead = await createFieldLead(input);
    if (draft.value.notes.trim()) await addFieldNote(lead.id, draft.value.notes.trim());
    if (billFile.value) await uploadBill(lead.id);
    await router.replace(`/leads/${lead.id}`);
  } catch (caught) {
    const code = caught instanceof Error ? (caught as Error & { code?: string }).code : undefined;
    error.value = code === "SLOT_UNAVAILABLE" || (caught instanceof Error && caught.message.includes("That time just filled up"))
      ? "That time just filled up. Choose another time."
      : caught instanceof Error ? caught.message : "Unable to create the lead.";
  } finally {
    saving.value = false;
  }
}

async function uploadBill(id: string) {
  if (!billFile.value) return;
  uploadState.value = "uploading";
  uploadError.value = "";
  try {
    await uploadFieldBill(id, billFile.value);
    uploadState.value = "uploaded";
  } catch (caught) {
    uploadState.value = "failed";
    uploadError.value = caught instanceof Error ? caught.message : "The bill could not be uploaded.";
    throw new Error("Lead saved, but the bill upload needs a retry.");
  }
}

function selectBill(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (!file) return;
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
  if (!allowed.includes(file.type) && !/\.(pdf|jpe?g|png|heic|heif)$/i.test(file.name)) { uploadError.value = "Choose a PDF, JPG, PNG, or HEIC bill."; uploadState.value = "failed"; return; }
  if (file.size > 10 * 1024 * 1024) { uploadError.value = "Bills must be 10 MB or smaller."; uploadState.value = "failed"; return; }
  billFile.value = file;
  uploadState.value = "idle";
  uploadError.value = "";
}

function parseAddress() {
  const parts = draft.value.propertyAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const last = parts.at(-1) ?? "";
  const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  return { addressLine1: draft.value.addressLine1.trim() || parts[0] || draft.value.propertyAddress.trim(), city: draft.value.city.trim() || (parts.length >= 3 ? parts.at(-2) ?? null : null), state: draft.value.state.trim() || stateZip?.[1] || (parts.length >= 2 ? parts.at(-1) ?? null : null), postalCode: draft.value.postalCode.trim() || stateZip?.[2] || null };
}

function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
</script>
