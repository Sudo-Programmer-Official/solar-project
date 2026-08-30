<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="FOLLOW-UPS" title="Reconnect at the right time" subtitle="Keep future opportunities separate from scheduled appointments, then convert them when the homeowner is ready.">
      <template #action><button class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></template>
    </MobileHeader>

    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5"><p class="field-label text-amber-700">Follow-ups unavailable</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p></section>

    <section v-if="user.can('followup:create') && leads.length" class="page-surface p-4">
      <p class="field-label text-primary-600">NEW REMINDER</p>
      <h2 class="mt-1 text-lg font-semibold text-slate-900">Create a follow-up</h2>
      <form class="mt-4 grid gap-2 sm:grid-cols-2" @submit.prevent="create">
        <select v-model="draft.leadId" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm" required><option value="">Select homeowner</option><option v-for="lead in leads" :key="lead.id" :value="lead.id">{{ lead.homeownerName }} · {{ lead.addressLine1 }}</option></select>
        <input v-model="draft.dueAt" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" type="datetime-local" required />
        <select v-model="draft.reason" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3 text-sm"><option value="">Choose a reason</option><option v-for="reason in reasons" :key="reason" :value="reason">{{ reason }}</option></select>
        <input v-model="draft.customReason" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Or enter a reason" />
        <textarea v-model="draft.note" class="min-h-20 rounded-2xl border border-slate-200 p-3 text-sm sm:col-span-2" placeholder="Context to remember later" />
        <button class="touch-target rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2" :disabled="saving" type="submit">{{ saving ? "Saving…" : "Save reminder" }}</button>
      </form>
    </section>

    <section v-for="group in groups" :key="group.id" class="page-surface mt-4 p-4">
      <div class="flex items-center justify-between gap-3"><div><p class="field-label">{{ group.label }}</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ group.items.length }} {{ group.items.length === 1 ? 'follow-up' : 'follow-ups' }}</h2></div><span v-if="group.id === 'today'" class="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">Needs attention</span></div>
      <div v-if="group.items.length === 0" class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nothing here.</div>
      <div v-else class="mt-3 grid gap-3">
        <article v-for="followUp in group.items" :key="followUp.id" class="rounded-2xl border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ followUp.homeownerName }}</p><p class="mt-1 truncate text-xs text-slate-500">{{ followUp.addressLine1 }}</p></div><span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ followUp.status.replaceAll('_', ' ') }}</span></div>
          <p class="mt-3 text-sm font-semibold text-slate-800">{{ followUp.reason }}</p><p v-if="followUp.note" class="mt-1 text-sm text-slate-600">{{ followUp.note }}</p><p class="mt-2 text-xs text-slate-500">Due {{ formatDateTime(followUp.dueAt) }}</p>
          <div v-if="isOpen(followUp)" class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input v-model="snoozeDraft[followUp.id]" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-xs" type="datetime-local" />
            <button class="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50" :disabled="!snoozeDraft[followUp.id]" type="button" @click="snooze(followUp)">Snooze</button>
            <button class="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="button" @click="complete(followUp)">Complete</button>
          </div>
          <div v-if="isOpen(followUp) && user.can('appointment:create')" class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><select v-model="convertDraft[followUp.id]" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-xs"><option value="">Select appointment slot</option><option v-for="slot in slots" :key="slot.id" :value="slot.id">{{ formatDateTime(slot.slotStart) }} · {{ slot.bookedCount }}/{{ slot.standardCapacity }} booked</option></select><button class="rounded-2xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!convertDraft[followUp.id] || (selectedSlot(followUp.id)?.remainingCapacity === 0 && !overflowDraft[followUp.id])" type="button" @click="convert(followUp)">Create appointment</button><label v-if="selectedSlot(followUp.id)?.remainingCapacity === 0 && selectedSlot(followUp.id)?.overflowPolicy === 'ALLOW_WITH_WARNING'" class="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:col-span-2"><input v-model="overflowDraft[followUp.id]" class="mt-0.5" type="checkbox" /> <span>Confirm explicit overflow booking.</span></label></div>
          <RouterLink class="mt-3 inline-block text-xs font-semibold text-primary-700" :to="`/leads/${followUp.leadId}`">Open homeowner →</RouterLink>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { completeFieldFollowUp, convertFieldFollowUpToOperationalSlot, createFieldFollowUp, getFieldOperationalSlots, getFieldFollowUps, getFieldLeads, snoozeFieldFollowUp, type FieldFollowUp, type FieldLead, type FieldOperationalSlot } from "../services/api";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const followUps = ref<FieldFollowUp[]>([]);
const leads = ref<FieldLead[]>([]);
const slots = ref<FieldOperationalSlot[]>([]);
const error = ref("");
const saving = ref(false);
const snoozeDraft = ref<Record<string, string>>({});
const convertDraft = ref<Record<string, string>>({});
const overflowDraft = ref<Record<string, boolean>>({});
const draft = ref({ leadId: "", dueAt: "", reason: "", customReason: "", note: "" });
const reasons = ["New roof in progress", "Homeowner traveling", "Credit improvement", "Spouse unavailable", "Callback requested", "Utility bill availability"];

const groups = computed(() => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const active = followUps.value.filter(isOpen);
  const completed = followUps.value.filter((item) => !isOpen(item));
  return [
    { id: "today", label: "TODAY", items: active.filter((item) => new Date(item.dueAt) < tomorrow && new Date(item.dueAt) >= today) },
    { id: "upcoming", label: "UPCOMING", items: active.filter((item) => new Date(item.dueAt) >= tomorrow) },
    { id: "overdue", label: "OVERDUE", items: active.filter((item) => new Date(item.dueAt) < today) },
    { id: "completed", label: "COMPLETED", items: completed },
  ];
});

useOperationalRefresh(load);

async function load() {
  error.value = "";
  const results = await Promise.allSettled([getFieldFollowUps(), getFieldLeads(), user.can("appointment:create") ? getFieldOperationalSlots() : Promise.resolve([] as FieldOperationalSlot[])]);
  if (results[0].status === "fulfilled") followUps.value = results[0].value;
  if (results[1].status === "fulfilled") leads.value = results[1].value;
  if (results[2].status === "fulfilled") slots.value = results[2].value;
  if (results[0].status === "rejected") error.value = results[0].reason instanceof Error ? results[0].reason.message : "Unable to load follow-ups.";
}

async function create() {
  const reason = draft.value.customReason.trim() || draft.value.reason;
  if (!draft.value.leadId || !draft.value.dueAt || !reason) return;
  saving.value = true; error.value = "";
  try { const created = await createFieldFollowUp({ leadId: draft.value.leadId, dueAt: new Date(draft.value.dueAt).toISOString(), reason, note: draft.value.note.trim() || undefined }); followUps.value = [created, ...followUps.value]; draft.value = { leadId: "", dueAt: "", reason: "", customReason: "", note: "" }; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create follow-up."; } finally { saving.value = false; }
}
async function complete(followUp: FieldFollowUp) { try { replace(await completeFieldFollowUp(followUp.id)); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to complete follow-up."; } }
async function snooze(followUp: FieldFollowUp) { const value = snoozeDraft.value[followUp.id]; if (!value) return; try { replace(await snoozeFieldFollowUp(followUp.id, new Date(value).toISOString())); snoozeDraft.value[followUp.id] = ""; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to snooze follow-up."; } }
async function convert(followUp: FieldFollowUp) { const slotId = convertDraft.value[followUp.id]; if (!slotId) return; try { const result = await convertFieldFollowUpToOperationalSlot(followUp.id, slotId, overflowDraft.value[followUp.id] === true); replace(result.followUp); } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create appointment."; } }
function selectedSlot(id: string) { return slots.value.find((slot) => slot.id === convertDraft.value[id]); }
function replace(updated: FieldFollowUp) { followUps.value = followUps.value.map((item) => item.id === updated.id ? updated : item); }
function isOpen(item: FieldFollowUp) { return item.status === "OPEN" || item.status === "SNOOZED"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
</script>
