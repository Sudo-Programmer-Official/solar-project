<template>
  <main class="overflow-x-hidden px-4 pb-28">
    <section class="page-surface border-primary-100 bg-primary-50/60 p-4 sm:p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p class="field-label text-primary-700">FOLLOW-UPS</p><h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Follow-ups</h1></div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button class="min-h-touch rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" type="button" @click="load">Refresh</button>
          <button class="min-h-touch rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm" type="button" @click="showCreate = !showCreate">{{ showCreate ? "Close form" : "+ New follow-up" }}</button>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
        <div class="rounded-2xl bg-white px-3 py-3"><p class="text-xs text-slate-500">Needs attention</p><strong class="mt-1 block text-xl text-amber-700">{{ overdueCount + todayCount }}</strong></div>
        <div class="rounded-2xl bg-white px-3 py-3"><p class="text-xs text-slate-500">Open</p><strong class="mt-1 block text-xl text-slate-950">{{ activeCount }}</strong></div>
        <div class="rounded-2xl bg-white px-3 py-3"><p class="text-xs text-slate-500">Completed</p><strong class="mt-1 block text-xl text-slate-950">{{ completedCount }}</strong></div>
      </div>
    </section>

    <section v-if="error" class="page-surface mt-4 border-amber-200 bg-amber-50 p-4"><p class="field-label text-amber-700">FOLLOW-UPS UNAVAILABLE</p><p class="mt-2 text-sm text-amber-900">{{ error }}</p></section>

    <section v-if="showCreate" class="page-surface mt-4 p-4 sm:p-5">
      <p class="field-label text-primary-600">NEW PRE-LEAD</p><h2 class="mt-1 text-xl font-semibold text-slate-950">Save a doorstep conversation</h2><p class="mt-2 text-sm text-slate-500">Name, phone, and email are optional. The address, schedule, reason, and context note are enough to save it.</p>
      <form class="mt-5 grid gap-3 sm:grid-cols-2" @submit.prevent="create">
        <label class="grid gap-1 text-sm font-medium text-slate-700"><span>Customer name <span class="font-normal text-slate-400">(optional)</span></span><input v-model="draft.homeownerName" class="min-h-touch rounded-2xl border border-slate-200 px-3" autocomplete="name" placeholder="Jordan Miller" /></label>
        <label class="grid gap-1 text-sm font-medium text-slate-700"><span>Phone <span class="font-normal text-slate-400">(optional)</span></span><input v-model="draft.phone" class="min-h-touch rounded-2xl border border-slate-200 px-3" autocomplete="tel" inputmode="tel" placeholder="(555) 555-0123" /></label>
        <label class="grid gap-1 text-sm font-medium text-slate-700"><span>Email <span class="font-normal text-slate-400">(optional)</span></span><input v-model="draft.email" class="min-h-touch rounded-2xl border border-slate-200 px-3" autocomplete="email" type="email" placeholder="jordan@example.com" /></label>
        <label class="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2"><span>Property address</span><input v-model="draft.addressLine1" class="min-h-touch rounded-2xl border border-slate-200 px-3" autocomplete="street-address" placeholder="3306 Pleasant Valley Blvd" required /></label>
        <label class="grid gap-1 text-sm font-medium text-slate-700"><span>City <span class="font-normal text-slate-400">(optional)</span></span><input v-model="draft.city" class="min-h-touch rounded-2xl border border-slate-200 px-3" placeholder="Altoona" /></label>
        <div class="grid grid-cols-2 gap-3"><label class="grid gap-1 text-sm font-medium text-slate-700"><span>State</span><input v-model="draft.state" class="min-h-touch rounded-2xl border border-slate-200 px-3" placeholder="PA" /></label><label class="grid gap-1 text-sm font-medium text-slate-700"><span>ZIP</span><input v-model="draft.postalCode" class="min-h-touch rounded-2xl border border-slate-200 px-3" inputmode="numeric" placeholder="16602" /></label></div>
        <label class="grid gap-1 text-sm font-medium text-slate-700"><span>Follow-up date</span><input v-model="draft.date" class="min-h-touch rounded-2xl border border-slate-200 px-3" type="date" required /></label>
        <div class="grid grid-cols-2 gap-3"><label class="grid gap-1 text-sm font-medium text-slate-700"><span>Exact time <span class="font-normal text-slate-400">(optional)</span></span><input v-model="draft.time" class="min-h-touch rounded-2xl border border-slate-200 px-3" type="time" /></label><label class="grid gap-1 text-sm font-medium text-slate-700"><span>Daypart</span><select v-model="draft.daypart" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3" :required="!draft.time"><option value="">Choose</option><option v-for="part in dayparts" :key="part.value" :value="part.value">{{ part.label }}</option></select></label></div>
        <label class="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2"><span>Reason</span><select v-model="draft.reason" class="min-h-touch rounded-2xl border border-slate-200 bg-white px-3" required><option value="">Choose a reason</option><option v-for="reason in reasons" :key="reason" :value="reason">{{ reason }}</option></select></label>
        <label v-if="draft.reason === 'Other'" class="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2"><span>Other reason</span><input v-model="draft.otherReason" class="min-h-touch rounded-2xl border border-slate-200 px-3" placeholder="What should the setter remember?" required /></label>
        <label class="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2"><span>Context note</span><textarea v-model="draft.note" class="min-h-24 rounded-2xl border border-slate-200 p-3" placeholder="What did they say, and what should happen next?" required /></label>
        <button class="min-h-touch rounded-2xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2" :disabled="saving" type="submit">{{ saving ? "Saving…" : "Save follow-up" }}</button>
      </form>
    </section>

    <nav class="page-surface mt-4 grid grid-cols-2 gap-2 p-2 sm:grid-cols-4" aria-label="Follow-up views"><button v-for="tab in tabs" :key="tab.id" class="min-h-touch rounded-2xl px-3 py-3 text-left transition" :class="activeView === tab.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'" type="button" @click="activeView = tab.id"><span class="block text-xs font-semibold uppercase tracking-[0.16em]">{{ tab.label }}</span><strong class="mt-1 block text-xl">{{ tab.count }}</strong></button></nav>

    <section class="page-surface mt-4 p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3"><div><p class="field-label">{{ currentTab.label }}</p><h2 class="mt-1 text-xl font-semibold text-slate-950">{{ visibleViewItems.length }}{{ searchQuery.trim() ? ` of ${viewItems.length}` : "" }} {{ visibleViewItems.length === 1 ? "follow-up" : "follow-ups" }}</h2></div><span v-if="activeView === 'overdue' || activeView === 'today'" class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Priority view</span></div>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><label class="relative block min-w-0 flex-1"><span class="sr-only">Search follow-ups</span><input v-model="searchQuery" class="min-h-touch w-full rounded-2xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100" type="search" placeholder="Search name, address, phone, or reason" aria-label="Search follow-ups" /><svg class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="8.5" cy="8.5" r="4.75" /><path d="m12 12 4 4" stroke-linecap="round" /></svg></label><span class="text-xs text-slate-500">{{ followUps.length }} total follow-ups</span></div>
      <div v-if="viewItems.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No follow-ups in this view.</div>
      <div v-else-if="visibleViewItems.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No follow-ups match “{{ searchQuery }}”.</div>

      <div v-else class="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
        <div class="max-h-[min(68vh,760px)] overflow-auto">
          <table class="w-full min-w-[1120px] table-fixed text-left text-sm">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th class="w-[14%] px-3 py-3 font-semibold">Due</th>
                <th class="w-[23%] px-3 py-3 font-semibold">Homeowner / property</th>
                <th class="w-[17%] px-3 py-3 font-semibold">Reason / latest note</th>
                <th class="w-[11%] px-3 py-3 font-semibold">Status</th>
                <th class="w-[35%] px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <template v-for="followUp in visibleViewItems" :key="followUp.id">
                <tr class="align-top text-slate-700 transition hover:bg-primary-50/30" :class="expandedRows[followUp.id] ? 'bg-primary-50/20' : ''">
                  <td class="px-3 py-4"><button class="text-left" type="button" @click="toggleDetails(followUp)"><strong class="block whitespace-nowrap text-slate-900">{{ formatDue(followUp) }}</strong><span class="mt-1 block text-xs text-slate-500">{{ activeView === 'completed' ? 'Completed record' : currentTab.label }}</span></button></td>
                  <td class="max-w-0 px-3 py-4"><button class="block max-w-full truncate text-left font-semibold text-slate-900 hover:text-primary-700" type="button" @click="toggleDetails(followUp)">{{ displayName(followUp) }}</button><span class="mt-1 block truncate text-xs text-slate-500" :title="addressLabel(followUp)">{{ addressLabel(followUp) }}</span><span v-if="followUp.phone" class="mt-1 block truncate text-xs text-slate-400">{{ followUp.phone }}</span></td>
                  <td class="max-w-0 px-3 py-4"><span class="block truncate font-medium text-slate-800" :title="followUp.reason">{{ followUp.reason }}</span><span v-if="latestNote(followUp)" class="mt-1 block truncate text-xs text-slate-500" :title="latestNote(followUp)">{{ latestNote(followUp) }}</span><span v-else class="mt-1 block text-xs text-slate-400">No notes</span></td>
                  <td class="px-3 py-4"><span class="inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" :class="statusClass(followUp)">{{ statusLabel(followUp.status) }}</span><span v-if="followUp.convertedLeadId" class="mt-2 block text-xs font-semibold text-emerald-700">Lead created</span><span v-else class="mt-2 block text-xs text-slate-400">{{ followUp.activities.length }} activities</span></td>
                  <td class="px-3 py-4"><div class="flex flex-wrap items-center gap-1.5"><a v-if="followUp.phone" class="inline-flex min-h-9 items-center justify-center rounded-xl bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100" :href="`tel:${followUp.phone}`">Call</a><span v-else class="inline-flex min-h-9 items-center justify-center rounded-xl bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-400">No phone</span><button class="min-h-9 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700" type="button" @click="navigate(followUp)">Map</button><button v-if="isOpen(followUp)" class="min-h-9 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700" type="button" @click="complete(followUp)">Done</button><button v-if="canReschedule(followUp)" class="min-h-9 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700" type="button" @click="toggleReschedule(followUp)">{{ rescheduleOpen[followUp.id] ? "Close" : "Reschedule" }}</button><button class="min-h-9 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700" type="button" @click="toggleNote(followUp)">{{ noteOpen[followUp.id] ? "Close" : "Note" }}</button><button v-if="!followUp.convertedLeadId && followUp.status !== 'CONVERTED_TO_APPOINTMENT'" class="min-h-9 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-50" :disabled="converting[followUp.id]" type="button" @click="convert(followUp)">{{ converting[followUp.id] ? "Creating…" : "Create lead" }}</button><RouterLink v-else-if="followUp.convertedLeadId" class="inline-flex min-h-9 items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" :to="`/leads/${followUp.convertedLeadId}`">Open lead</RouterLink><button class="min-h-9 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-primary-300 hover:text-primary-700" type="button" @click="toggleDetails(followUp)">{{ expandedRows[followUp.id] ? "Close" : "Details" }}</button></div></td>
                </tr>
                <tr v-if="expandedRows[followUp.id]" class="bg-primary-50/20">
                  <td colspan="5" class="px-3 pb-4 pt-1"><div class="grid gap-3 rounded-2xl border border-primary-100 bg-white p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div><p class="field-label text-primary-700">FOLLOW-UP DETAILS</p><p class="mt-2 text-sm text-slate-700"><strong>{{ displayName(followUp) }}</strong></p><p class="mt-1 text-sm text-slate-600">{{ addressLabel(followUp) }}</p><p v-if="followUp.email" class="mt-1 text-sm text-slate-500">{{ followUp.email }}</p><p v-if="latestNote(followUp)" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">{{ latestNote(followUp) }}</p></div><div class="grid gap-3"><form v-if="rescheduleOpen[followUp.id]" class="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" @submit.prevent="reschedule(followUp)"><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>Date</span><input v-model="rescheduleDraft[followUp.id].date" class="min-h-touch rounded-xl border border-slate-200 bg-white px-2" type="date" required /></label><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>Time</span><input v-model="rescheduleDraft[followUp.id].time" class="min-h-touch rounded-xl border border-slate-200 bg-white px-2" type="time" /></label><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>Daypart</span><select v-model="rescheduleDraft[followUp.id].daypart" class="min-h-touch rounded-xl border border-slate-200 bg-white px-2" :required="!rescheduleDraft[followUp.id].time"><option value="">Choose</option><option v-for="part in dayparts" :key="part.value" :value="part.value">{{ part.label }}</option></select></label><button class="min-h-touch rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" type="submit">Save</button></form><form v-if="noteOpen[followUp.id]" class="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end" @submit.prevent="addNote(followUp)"><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>New activity note</span><textarea v-model="noteDraft[followUp.id]" class="min-h-20 rounded-xl border border-slate-200 bg-white p-2" placeholder="What changed?" required /></label><button class="min-h-touch rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" type="submit">Save note</button></form><div v-if="followUp.activities.length" class="rounded-2xl bg-slate-50 p-3"><p class="text-sm font-semibold text-slate-700">Activity history · {{ followUp.activities.length }}</p><ol class="mt-3 grid gap-3 border-l border-slate-200 pl-4"><li v-for="activity in followUp.activities" :key="activity.id" class="relative text-sm"><span class="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary-500"></span><p class="font-medium text-slate-700">{{ activityLabel(activity) }}</p><p class="mt-0.5 text-xs text-slate-500">{{ formatActivityDate(activity.createdAt) }}</p></li></ol></div></div></div></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="visibleViewItems.length" class="mt-4 grid gap-3 lg:hidden">
        <article v-for="followUp in visibleViewItems" :key="followUp.id" class="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate text-base font-semibold text-slate-950">{{ displayName(followUp) }}</p><p class="mt-1 break-words text-sm text-slate-600">{{ addressLabel(followUp) }}</p></div><span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" :class="statusClass(followUp)">{{ statusLabel(followUp.status) }}</span></div>
          <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><div><p class="text-sm font-semibold text-slate-800">{{ formatDue(followUp) }}</p><p class="mt-1 text-sm text-slate-500">{{ followUp.reason }}</p></div><span v-if="followUp.convertedLeadId" class="text-xs font-semibold text-emerald-700">Lead created</span></div>
          <p v-if="latestNote(followUp)" class="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">{{ latestNote(followUp) }}</p>
          <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><a v-if="followUp.phone" class="min-h-touch inline-flex items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" :href="`tel:${followUp.phone}`">Call</a><span v-else class="inline-flex min-h-touch items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400">No phone</span><button class="min-h-touch rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" type="button" @click="navigate(followUp)">Navigate</button><button v-if="isOpen(followUp)" class="min-h-touch rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" type="button" @click="complete(followUp)">Complete</button><button v-if="canReschedule(followUp)" class="min-h-touch rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" type="button" @click="toggleReschedule(followUp)">{{ rescheduleOpen[followUp.id] ? "Close" : "Reschedule" }}</button><button class="min-h-touch rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" type="button" @click="toggleNote(followUp)">{{ noteOpen[followUp.id] ? "Close" : "Add note" }}</button><button v-if="!followUp.convertedLeadId && followUp.status !== 'CONVERTED_TO_APPOINTMENT'" class="min-h-touch rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:col-span-2" :disabled="converting[followUp.id]" type="button" @click="convert(followUp)">{{ converting[followUp.id] ? "Creating lead…" : "Create Lead" }}</button><RouterLink v-else-if="followUp.convertedLeadId" class="min-h-touch inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white sm:col-span-2" :to="`/leads/${followUp.convertedLeadId}`">Open lead</RouterLink></div>
          <form v-if="rescheduleOpen[followUp.id]" class="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" @submit.prevent="reschedule(followUp)"><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>Date</span><input v-model="rescheduleDraft[followUp.id].date" class="min-h-touch rounded-xl border border-slate-200 bg-white px-2" type="date" required /></label><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>Time</span><input v-model="rescheduleDraft[followUp.id].time" class="min-h-touch rounded-xl border border-slate-200 bg-white px-2" type="time" /></label><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>Daypart</span><select v-model="rescheduleDraft[followUp.id].daypart" class="min-h-touch rounded-xl border border-slate-200 bg-white px-2" :required="!rescheduleDraft[followUp.id].time"><option value="">Choose</option><option v-for="part in dayparts" :key="part.value" :value="part.value">{{ part.label }}</option></select></label><button class="min-h-touch rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" type="submit">Save</button></form>
          <form v-if="noteOpen[followUp.id]" class="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end" @submit.prevent="addNote(followUp)"><label class="grid gap-1 text-xs font-semibold text-slate-600"><span>New activity note</span><textarea v-model="noteDraft[followUp.id]" class="min-h-20 rounded-xl border border-slate-200 bg-white p-2" placeholder="What changed?" required /></label><button class="min-h-touch rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" type="submit">Save note</button></form>
          <details v-if="followUp.activities.length" class="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"><summary class="cursor-pointer text-sm font-semibold text-slate-700">Activity history · {{ followUp.activities.length }}</summary><ol class="mt-3 grid gap-3 border-l border-slate-200 pl-4"><li v-for="activity in followUp.activities" :key="activity.id" class="relative text-sm"><span class="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary-500"></span><p class="font-medium text-slate-700">{{ activityLabel(activity) }}</p><p class="mt-0.5 text-xs text-slate-500">{{ formatActivityDate(activity.createdAt) }}</p></li></ol></details>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldFollowUpNote, completeFieldFollowUp, convertFieldFollowUpToLead, createFieldFollowUp, getFieldFollowUps, rescheduleFieldFollowUp, type FieldFollowUp, type FieldFollowUpActivity } from "../services/api";

type ViewId = "overdue" | "today" | "upcoming" | "completed";
type Daypart = "MORNING" | "AFTERNOON" | "EVENING";
type Draft = { homeownerName: string; phone: string; email: string; addressLine1: string; city: string; state: string; postalCode: string; date: string; time: string; daypart: string; reason: string; otherReason: string; note: string };
type ScheduleDraft = { date: string; time: string; daypart: string };
type ActivityEvent = { body?: unknown; dueAt?: unknown; dueDaypart?: unknown; leadId?: unknown };

const reasons = ["Need bill", "New roof", "Spouse/decision maker", "Call back", "Not home", "Thinking about it", "Credit timing", "Future interest", "Other"];
const dayparts: Array<{ value: Daypart; label: string }> = [{ value: "MORNING", label: "Morning" }, { value: "AFTERNOON", label: "Afternoon" }, { value: "EVENING", label: "Evening" }];
const followUps = ref<FieldFollowUp[]>([]);
const error = ref("");
const saving = ref(false);
const showCreate = ref(false);
const activeView = ref<ViewId>("today");
const searchQuery = ref("");
const converting = ref<Record<string, boolean>>({});
const rescheduleOpen = ref<Record<string, boolean>>({});
const noteOpen = ref<Record<string, boolean>>({});
const expandedRows = ref<Record<string, boolean>>({});
const rescheduleDraft = ref<Record<string, ScheduleDraft>>({});
const noteDraft = ref<Record<string, string>>({});
const draft = ref<Draft>({ homeownerName: "", phone: "", email: "", addressLine1: "", city: "", state: "", postalCode: "", date: todayInput(), time: "", daypart: "AFTERNOON", reason: "", otherReason: "", note: "" });

const activeFollowUps = computed(() => followUps.value.filter(isOpen));
const completedItems = computed(() => followUps.value.filter((item) => !isOpen(item)));
const overdueItems = computed(() => activeFollowUps.value.filter((item) => bucket(item) === "overdue"));
const todayItems = computed(() => activeFollowUps.value.filter((item) => bucket(item) === "today"));
const upcomingItems = computed(() => activeFollowUps.value.filter((item) => bucket(item) === "upcoming"));
const overdueCount = computed(() => overdueItems.value.length);
const todayCount = computed(() => todayItems.value.length);
const activeCount = computed(() => activeFollowUps.value.length);
const completedCount = computed(() => completedItems.value.length);
const tabs = computed(() => [{ id: "overdue" as ViewId, label: "Overdue", count: overdueCount.value }, { id: "today" as ViewId, label: "Today", count: todayCount.value }, { id: "upcoming" as ViewId, label: "Upcoming", count: upcomingItems.value.length }, { id: "completed" as ViewId, label: "Completed", count: completedCount.value }]);
const currentTab = computed(() => tabs.value.find((tab) => tab.id === activeView.value) ?? tabs.value[1]);
const viewItems = computed(() => activeView.value === "overdue" ? sortActive(overdueItems.value) : activeView.value === "today" ? sortActive(todayItems.value) : activeView.value === "upcoming" ? sortActive(upcomingItems.value) : [...completedItems.value].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
const visibleViewItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return viewItems.value;
  return viewItems.value.filter((item) => [displayName(item), addressLabel(item), item.phone, item.email, item.reason, latestNote(item)].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
});

useOperationalRefresh(load);

async function load() { error.value = ""; try { followUps.value = await getFieldFollowUps(); if (overdueItems.value.length > 0) activeView.value = "overdue"; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to load follow-ups."; } }
async function create() {
  const reason = draft.value.reason === "Other" ? draft.value.otherReason.trim() : draft.value.reason;
  if (!draft.value.addressLine1.trim() || !draft.value.date || !reason || !draft.value.note.trim() || (!draft.value.time && !draft.value.daypart)) return;
  saving.value = true; error.value = "";
  try {
    const created = await createFieldFollowUp({ homeownerName: draft.value.homeownerName.trim() || null, phone: draft.value.phone.trim() || null, email: draft.value.email.trim() || null, addressLine1: draft.value.addressLine1.trim(), city: draft.value.city.trim() || null, state: draft.value.state.trim() || null, postalCode: draft.value.postalCode.trim() || null, dueAt: scheduleIso(draft.value.date, draft.value.time), dueDaypart: draft.value.time ? null : draft.value.daypart, reason, note: draft.value.note.trim() });
    followUps.value = [created, ...followUps.value]; activeView.value = bucket(created) === "overdue" ? "overdue" : bucket(created) === "today" ? "today" : "upcoming"; draft.value = { homeownerName: "", phone: "", email: "", addressLine1: "", city: "", state: "", postalCode: "", date: todayInput(), time: "", daypart: "AFTERNOON", reason: "", otherReason: "", note: "" }; showCreate.value = false;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create follow-up."; } finally { saving.value = false; }
}
async function complete(followUp: FieldFollowUp) { await runAction(() => completeFieldFollowUp(followUp.id), "Unable to complete follow-up."); }
async function reschedule(followUp: FieldFollowUp) { const value = rescheduleDraft.value[followUp.id]; if (!value?.date || (!value.time && !value.daypart)) return; await runAction(() => rescheduleFieldFollowUp(followUp.id, { dueAt: scheduleIso(value.date, value.time), dueDaypart: value.time ? null : value.daypart }), "Unable to reschedule follow-up."); rescheduleOpen.value[followUp.id] = false; }
async function addNote(followUp: FieldFollowUp) { const body = noteDraft.value[followUp.id]?.trim(); if (!body) return; await runAction(() => addFieldFollowUpNote(followUp.id, body), "Unable to add note."); noteDraft.value[followUp.id] = ""; noteOpen.value[followUp.id] = false; }
async function convert(followUp: FieldFollowUp) { if (followUp.convertedLeadId) return; converting.value[followUp.id] = true; error.value = ""; try { const result = await convertFieldFollowUpToLead(followUp.id); replace(result.followUp); activeView.value = "completed"; } catch (cause) { error.value = cause instanceof Error ? cause.message : "Unable to create lead from follow-up."; } finally { converting.value[followUp.id] = false; } }
async function runAction(action: () => Promise<FieldFollowUp>, fallback: string) { saving.value = true; error.value = ""; try { replace(await action()); } catch (cause) { error.value = cause instanceof Error ? cause.message : fallback; } finally { saving.value = false; } }
function toggleDetails(followUp: FieldFollowUp) { expandedRows.value[followUp.id] = !expandedRows.value[followUp.id]; }
function toggleReschedule(followUp: FieldFollowUp) { rescheduleOpen.value[followUp.id] = !rescheduleOpen.value[followUp.id]; if (rescheduleOpen.value[followUp.id]) { expandedRows.value[followUp.id] = true; const due = followUp.dueAt ? new Date(followUp.dueAt) : new Date(); rescheduleDraft.value[followUp.id] = { date: localDateInput(due), time: followUp.dueDaypart ? "" : localTimeInput(due), daypart: followUp.dueDaypart ?? "AFTERNOON" }; } }
function toggleNote(followUp: FieldFollowUp) { noteOpen.value[followUp.id] = !noteOpen.value[followUp.id]; if (noteOpen.value[followUp.id]) expandedRows.value[followUp.id] = true; }
function replace(updated: FieldFollowUp) { followUps.value = followUps.value.map((item) => item.id === updated.id ? updated : item); }
function isOpen(item: FieldFollowUp) { return item.status === "OPEN" || item.status === "SNOOZED"; }
function canReschedule(item: FieldFollowUp) { return item.status !== "CONVERTED" && item.status !== "CONVERTED_TO_APPOINTMENT"; }
function displayName(item: FieldFollowUp) { return item.homeownerName || `Homeowner at ${item.addressLine1}`; }
function addressLabel(item: FieldFollowUp) { return [item.addressLine1, item.city, item.state, item.postalCode].filter(Boolean).join(", "); }
function statusLabel(status: string) { return status.replaceAll("_", " "); }
function statusClass(item: FieldFollowUp) { return item.status === "DONE" || item.status === "CONVERTED" ? "bg-emerald-50 text-emerald-700" : item.status === "CANCELLED" ? "bg-slate-100 text-slate-500" : bucket(item) === "overdue" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"; }
function latestNote(item: FieldFollowUp) { const notes = item.activities.filter((activity) => activity.eventType === "FOLLOW_UP_NOTE_ADDED").map((activity) => eventOf(activity).body).filter((body): body is string => typeof body === "string" && Boolean(body.trim())); return notes.at(-1) ?? item.note; }
function formatDue(item: FieldFollowUp) { const day = item.dueAt ? new Date(item.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Date not set"; if (item.dueDaypart) return `${day} · ${item.dueDaypart.toLowerCase()}`; return item.dueAt ? new Date(item.dueAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : day; }
function formatActivityDate(value: string) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function eventOf(activity: FieldFollowUpActivity): ActivityEvent { return activity.event && typeof activity.event === "object" ? activity.event as ActivityEvent : {}; }
function activityLabel(activity: FieldFollowUpActivity) { const event = eventOf(activity); if (activity.eventType === "FOLLOW_UP_CREATED") return "Follow-up created"; if (activity.eventType === "FOLLOW_UP_RESCHEDULED") return `Rescheduled${event.dueDaypart ? ` to ${String(event.dueDaypart).toLowerCase()}` : ""}`; if (activity.eventType === "FOLLOW_UP_NOTE_ADDED") return `Note added: ${String(event.body ?? "")}`; if (activity.eventType === "FOLLOW_UP_COMPLETED") return "Follow-up completed"; if (activity.eventType === "FOLLOW_UP_CONVERTED") return "Converted into a canonical lead"; if (activity.eventType === "FOLLOW_UP_CONVERTED_TO_APPOINTMENT") return "Converted into an appointment"; return statusLabel(activity.eventType); }
function bucket(item: FieldFollowUp): ViewId { if (!isOpen(item)) return "completed"; if (!item.dueAt) return "upcoming"; const due = new Date(item.dueAt); const start = new Date(); start.setHours(0, 0, 0, 0); const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1); return due < start ? "overdue" : due < tomorrow ? "today" : "upcoming"; }
function sortActive(items: FieldFollowUp[]) { return [...items].sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER) - (b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER)); }
function navigate(item: FieldFollowUp) { const query = addressLabel(item); if (!query) return; window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer"); }
function scheduleIso(date: string, time: string) { return new Date(`${date}T${time || "12:00"}`).toISOString(); }
function todayInput() { return localDateInput(new Date()); }
function localDateInput(value: Date) { const year = value.getFullYear(); const month = String(value.getMonth() + 1).padStart(2, "0"); const day = String(value.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
function localTimeInput(value: Date) { return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`; }
</script>
