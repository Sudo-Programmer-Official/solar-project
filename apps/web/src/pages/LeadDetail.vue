<template>
  <main class="px-4 pb-28">
    <div class="mx-auto max-w-4xl">
      <MobileHeader eyebrow="LEAD DETAIL" :title="context?.lead.homeownerName ?? 'Lead detail'" :subtitle="context ? addressLabel(context.lead) : 'Loading canonical lead context.'">
        <template #action><RouterLink to="/leads" class="touch-target inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Back</RouterLink></template>
      </MobileHeader>

      <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">LEAD UNAVAILABLE</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p><button class="touch-target mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button></section>
      <template v-else-if="context">
        <section v-if="route.query.appointment === 'booked' && bookedAppointment" class="page-surface mb-4 border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div class="flex items-start gap-3"><span class="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">✓</span><div><p class="field-label text-emerald-700">APPOINTMENT BOOKED</p><h2 class="mt-1 text-xl font-semibold text-slate-950">{{ context.lead.homeownerName }}</h2></div></div>
          <dl class="mt-5 grid gap-3 rounded-2xl bg-white/70 p-4 text-sm sm:grid-cols-2">
            <div><dt class="text-xs text-slate-500">Homeowner</dt><dd class="mt-1 font-semibold text-slate-900">{{ context.lead.homeownerName }}</dd></div>
            <div><dt class="text-xs text-slate-500">Date / time</dt><dd class="mt-1 font-semibold text-slate-900">{{ formatDateTime(bookedAppointment.scheduledStart) }}</dd></div>
            <div><dt class="text-xs text-slate-500">Bill</dt><dd class="mt-1 font-semibold text-slate-900">{{ currentBills.length ? "Received" : "Missing" }}</dd></div>
            <div><dt class="text-xs text-slate-500">Closer</dt><dd class="mt-1 font-semibold text-slate-900">{{ bookedAppointment.closerId ? "Closer assigned" : "Closer: Awaiting assignment" }}</dd></div>
          </dl>
        </section>
        <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <article class="page-surface p-4"><span class="text-xs text-slate-500">Status</span><strong class="mt-1 block text-sm text-slate-900">{{ context.lead.status.replaceAll("_", " ") }}</strong></article>
          <article class="page-surface p-4"><span class="text-xs text-slate-500">Appointments</span><strong class="mt-1 block text-sm text-slate-900">{{ context.appointments.length }}</strong></article>
          <article class="page-surface p-4"><span class="text-xs text-slate-500">Utility bill</span><strong class="mt-1 block text-sm text-slate-900">{{ currentBills.length ? "Received" : "Missing" }}</strong></article>
          <article class="page-surface p-4"><span class="text-xs text-slate-500">Sheet sync</span><strong class="mt-1 block text-sm text-slate-900">{{ context.sheetSync?.status ?? "—" }}</strong></article>
        </section>

        <section class="page-surface mt-4 p-4 sm:p-5"><p class="field-label">CONTACT</p><div class="mt-3 grid gap-3 text-sm sm:grid-cols-2"><p><span class="text-slate-500">Phone</span><br /><a v-if="context.lead.phone" class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4" :href="`tel:${context.lead.phone}`">{{ context.lead.phone }}</a><span v-else class="font-semibold text-slate-900">—</span></p><p><span class="text-slate-500">Email</span><br /><a v-if="context.lead.email" class="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4" :href="`mailto:${context.lead.email}`">{{ context.lead.email }}</a><span v-else class="font-semibold text-slate-900">—</span></p><p class="sm:col-span-2"><span class="text-slate-500">Property</span><br /><span class="font-semibold text-slate-900">{{ addressLabel(context.lead) }}</span></p></div></section>

        <section class="page-surface mt-4 p-4 sm:p-5"><div class="flex items-center justify-between gap-3"><div><p class="field-label">APPOINTMENT</p><h2 class="mt-1 text-base font-semibold text-slate-900">Scheduled visits</h2></div><span class="text-xs text-slate-500">{{ context.appointments.length }} total</span></div><div v-if="context.appointments.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No appointment has been set.</div><div v-else class="mt-3 grid gap-2"><div v-for="appointment in context.appointments" :key="appointment.id" class="rounded-2xl border border-slate-200 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><span class="text-sm font-semibold text-slate-900">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</span><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{{ appointment.outcome ?? appointment.status }}</span></div><p class="mt-1 text-xs text-slate-500">{{ appointment.closerId ? "Closer assigned" : "Waiting for manager assignment" }}<span v-if="appointment.isOverflow"> · Overflow</span><span v-if="appointment.outcomeNotes"> · {{ appointment.outcomeNotes }}</span><span v-if="appointment.cancelReason"> · Reason: {{ appointment.cancelReason }}</span></p></div></div></section>

        <section class="page-surface mt-4 p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3"><div><p class="field-label">UTILITY BILL</p><h2 class="mt-1 text-base font-semibold text-slate-900">Secure homeowner documents</h2><p class="mt-1 text-sm text-slate-500">{{ currentBills.length ? "The latest bill is available to authorized teammates." : "No bill received yet." }}</p></div><span class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="currentBills.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'">{{ currentBills.length ? "RECEIVED" : "MISSING" }}</span></div>
          <div v-for="bill in currentBills" :key="bill.id" class="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ bill.fileName }}</p><p class="mt-1 text-xs text-slate-500">{{ billTypeLabel(bill) }} · {{ formatBytes(bill.fileSizeBytes) }} · {{ formatDate(bill.createdAt) }}</p></div><div class="flex gap-2"><button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="viewBill(bill.id)">View</button><button class="touch-target rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white" type="button" @click="downloadBill(bill.id)">Download</button></div></div>
          <input ref="billInput" class="sr-only" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif" type="file" @change="selectBill" />
          <div v-if="canUploadBill" class="mt-4"><button class="touch-target w-full rounded-2xl border border-primary-300 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800 sm:w-auto" type="button" @click="billInput?.click()">+ {{ currentBills.length ? "Replace bill" : "Upload bill" }}</button><span v-if="uploadingBill" class="ml-3 text-xs font-semibold text-slate-500">Uploading…</span><p v-if="billError" class="mt-2 text-xs font-semibold text-red-700">{{ billError }}</p></div>
          <details v-if="olderBills.length" class="mt-4"><summary class="cursor-pointer text-xs font-semibold text-slate-500">{{ olderBills.length }} previous bill{{ olderBills.length === 1 ? "" : "s" }} preserved in history</summary><div class="mt-2 grid gap-2"><p v-for="bill in olderBills" :key="bill.id" class="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500">{{ bill.fileName }} · replaced {{ bill.replacedAt ? formatDate(bill.replacedAt) : "" }}</p></div></details>
        </section>

        <section class="page-surface mt-4 p-4 sm:p-5"><div class="flex items-center justify-between gap-3"><div><p class="field-label">NOTES</p><h2 class="mt-1 text-base font-semibold text-slate-900">Field context</h2></div><span class="text-xs text-slate-500">{{ context.notes.length }} note{{ context.notes.length === 1 ? "" : "s" }}</span></div><div v-if="context.notes.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No notes yet. Add the detail the closer needs for the next decision.</div><div v-else class="mt-3 grid gap-3"><article v-for="note in context.notes" :key="note.id" class="rounded-2xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-3 text-xs text-slate-500"><span class="truncate font-semibold text-slate-700">{{ note.authorName || "Team member" }}</span><time :datetime="note.createdAt">{{ formatDateTime(note.createdAt) }}</time></div><p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{{ note.body }}</p></article></div><form v-if="canAddNote" class="mt-4" @submit.prevent="saveNote"><textarea v-model="noteDraft" class="field-control min-h-24 py-3" placeholder="Anything the closer should know..." rows="3" required /><button class="touch-target mt-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" :disabled="savingNote" type="submit">{{ savingNote ? "Adding…" : "+ Add note" }}</button></form></section>

        <section class="page-surface mt-4 p-4 sm:p-5"><p class="field-label">ACTIVITY HISTORY</p><div class="mt-3 grid gap-3"><div v-for="activity in context.activities" :key="activity.id" class="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 text-xs last:border-0 last:pb-0"><div><p class="font-semibold text-slate-700">{{ activity.eventType.replaceAll("_", " ") }}</p><p class="mt-1 text-slate-500">{{ activity.actorName || "System" }}</p></div><time class="shrink-0 text-slate-400" :datetime="activity.createdAt">{{ formatDateTime(activity.createdAt) }}</time></div><p v-if="context.activities.length === 0" class="text-sm text-slate-500">No activity recorded yet.</p></div></section>
        <section v-if="context && canAddNote && context.notes.length" class="page-surface mt-4 p-4 sm:p-5">
          <p class="field-label">EDIT NOTE</p>
          <div class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <select v-model="editingNoteId" class="field-control" @change="loadNoteForEdit">
              <option value="">Select a note</option>
              <option v-for="note in context.notes" :key="note.id" :value="note.id">{{ note.authorName || "Team member" }} · {{ formatDateTime(note.createdAt) }}</option>
            </select>
            <textarea v-model="editingNoteBody" class="field-control min-h-24 py-3" placeholder="Edit the selected note..." rows="3" />
          </div>
          <button class="touch-target mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="!editingNoteId || !editingNoteBody.trim() || savingNote" type="button" @click="saveEditedNote">{{ savingNote ? "Saving…" : "Save note edit" }}</button>
        </section>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MobileHeader from "../components/MobileHeader.vue";
import { addFieldNote, downloadFieldBill, getFieldBillDownloadUrl, getFieldLead, type FieldLeadContext, uploadFieldBill } from "../services/api";
import { updateFieldNote } from "../services/field-notes";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { useUserStore } from "../stores/user.store";

const props = defineProps<{ id: string }>();
const route = useRoute();
const user = useUserStore();
const billInput = ref<HTMLInputElement | null>(null);
const context = ref<FieldLeadContext | null>(null);
const error = ref("");
const billError = ref("");
const billFile = ref<File | null>(null);
const uploadingBill = ref(false);
const noteDraft = ref("");
const editingNoteId = ref("");
const editingNoteBody = ref("");
const savingNote = ref(false);
const currentBills = computed(() => context.value?.bills.filter((bill) => bill.replacedBy == null) ?? []);
const olderBills = computed(() => context.value?.bills.filter((bill) => bill.replacedBy != null) ?? []);
const canUploadBill = computed(() => user.can("bill:upload"));
const canAddNote = computed(() => user.can("lead:update-own") || user.can("lead:update-all"));
const bookedAppointment = computed(() => context.value?.appointments.find((appointment) => !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status)) ?? null);

useOperationalRefresh(load);
watch(() => props.id, () => { void load(); });

async function load() {
  error.value = "";
  try { context.value = await getFieldLead(props.id); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load lead."; }
}

async function saveNote() {
  if (!context.value || !noteDraft.value.trim()) return;
  savingNote.value = true;
  try { await addFieldNote(context.value.lead.id, noteDraft.value.trim()); noteDraft.value = ""; await load(); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to add note."; }
  finally { savingNote.value = false; }
}

function loadNoteForEdit() {
  const note = context.value?.notes.find((candidate) => candidate.id === editingNoteId.value);
  editingNoteBody.value = note?.body ?? "";
}

async function saveEditedNote() {
  if (!context.value || !editingNoteId.value || !editingNoteBody.value.trim()) return;
  const note = context.value.notes.find((candidate) => candidate.id === editingNoteId.value);
  if (!note || (note.authorId !== user.id && !user.can("lead:update-all"))) {
    error.value = "You can only edit your own notes.";
    return;
  }
  savingNote.value = true;
  try {
    await updateFieldNote(context.value.lead.id, editingNoteId.value, editingNoteBody.value.trim());
    editingNoteId.value = "";
    editingNoteBody.value = "";
    await load();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Unable to edit note.";
  } finally {
    savingNote.value = false;
  }
}

function selectBill(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (!file) return;
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
  if ((!allowed.includes(file.type) && !/\.(pdf|jpe?g|png|heic|heif)$/i.test(file.name)) || file.size > 10 * 1024 * 1024) { billError.value = "Choose a PDF, JPG, PNG, or HEIC bill up to 10 MB."; return; }
  billFile.value = file;
  void uploadBill(file);
}

async function uploadBill(file: File) {
  if (!context.value) return;
  uploadingBill.value = true; billError.value = "";
  try { await uploadFieldBill(context.value.lead.id, file); billFile.value = null; await load(); }
  catch (caught) { billError.value = caught instanceof Error ? caught.message : "The bill could not be uploaded."; }
  finally { uploadingBill.value = false; }
}

async function viewBill(billId: string) {
  try { const url = await getFieldBillDownloadUrl(billId); window.open(url, "_blank", "noopener,noreferrer"); }
  catch (caught) { billError.value = caught instanceof Error ? caught.message : "The bill could not be opened."; }
}
async function downloadBill(billId: string) { try { await downloadFieldBill(billId); } catch (caught) { billError.value = caught instanceof Error ? caught.message : "The bill could not be downloaded."; } }
function addressLabel(lead: FieldLeadContext["lead"]) { return [lead.addressLine1, lead.city, lead.state, lead.postalCode].filter(Boolean).join(", "); }
function billTypeLabel(bill: FieldLeadContext["bills"][number]) { return bill.mimeType.includes("pdf") ? "PDF" : bill.mimeType.split("/")[1]?.toUpperCase() || "FILE"; }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function formatDateTime(value: string) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
