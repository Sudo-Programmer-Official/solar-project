<template>
  <main class="min-w-0 overflow-x-hidden px-4 pb-28">
    <MobileHeader eyebrow="APPOINTMENTS" :title="isManagerBoard ? 'Assignment board' : 'Your appointment queue'" :subtitle="isManagerBoard ? 'Assign the right closer from the row and keep the field team moving.' : 'Open the full lead context, record the outcome, and keep the setter loop current.'">
      <template #action>
        <div class="flex min-w-0 items-center gap-2">
          <RouterLink v-if="user.can('lead:create')" to="/leads/new" class="touch-target inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold leading-5 text-white shadow-sm transition hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200">+ New lead</RouterLink>
          <span class="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{{ appointments.length }} total</span>
        </div>
      </template>
    </MobileHeader>

    <section v-if="error" class="page-surface border-amber-200 bg-amber-50 p-5">
      <p class="field-label text-amber-700">Appointments unavailable</p>
      <p class="mt-2 text-sm text-amber-900">{{ error }}</p>
      <button class="touch-target mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white" type="button" @click="load">Try again</button>
    </section>

    <template v-else>
      <section v-if="isManagerBoard" class="page-surface min-w-0 p-4">
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="field-label text-primary-600">MANAGER WORKSPACE</p>
            <h2 class="mt-1 text-xl font-semibold tracking-tight text-slate-900">Appointment assignment</h2>
            <p class="mt-1 text-sm text-slate-500">Unassigned appointments stay at the top. Available closers are checked against status and time conflicts.</p>
          </div>
          <button class="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left" type="button" @click="statusFilter = 'UNASSIGNED'; dateFilter = 'TODAY'">
            <span class="block text-xs font-semibold text-amber-700">Need assignment</span>
            <strong class="mt-1 block text-2xl tracking-tight text-amber-950">{{ unassignedTodayCount }}</strong>
          </button>
          <div class="rounded-2xl bg-slate-50 p-3"><span class="block text-xs text-slate-500">Today</span><strong class="mt-1 block text-2xl tracking-tight text-slate-900">{{ todayCount }}</strong></div>
          <div class="rounded-2xl bg-slate-50 p-3"><span class="block text-xs text-slate-500">Assigned</span><strong class="mt-1 block text-2xl tracking-tight text-slate-900">{{ assignedCount }}</strong></div>
          <div class="rounded-2xl bg-slate-50 p-3"><span class="block text-xs text-slate-500">Completed</span><strong class="mt-1 block text-2xl tracking-tight text-slate-900">{{ completedCount }}</strong></div>
          <button class="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left" type="button" @click="statusFilter = 'NEEDS_REVIEW'; dateFilter = 'ALL'"><span class="block text-xs font-semibold text-amber-700">Closer review</span><strong class="mt-1 block text-2xl tracking-tight text-amber-950">{{ needsReviewCount }}</strong></button>
        </div>

        <div class="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-500">Date
            <select v-model="dateFilter" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"><option value="TODAY">Today</option><option value="UPCOMING">Upcoming</option><option value="ALL">All dates</option></select>
          </label>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-500">Status
            <select v-model="statusFilter" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"><option value="PRIORITY">Priority · review first</option><option value="NEEDS_REVIEW">Closer needs review</option><option value="UNASSIGNED">Unassigned</option><option value="ASSIGNED">Assigned</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="ALL">All statuses</option></select>
          </label>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-500">Closer
            <select v-model="closerFilter" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"><option value="ALL">All closers</option><option v-for="closer in closerOptions" :key="closer.id" :value="closer.id">{{ closer.displayName }}</option></select>
          </label>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-500">Setter
            <select v-model="setterFilter" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"><option value="ALL">All setters</option><option v-for="setter in setterOptions" :key="setter.id" :value="setter.id">{{ setter.displayName }}</option></select>
          </label>
          <label class="grid min-w-0 gap-1 text-xs font-semibold text-slate-500">Time
            <select v-model="timeFilter" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800"><option value="ALL">Any time</option><option value="MORNING">Morning · before noon</option><option value="AFTERNOON">Afternoon · 12–5</option><option value="EVENING">Evening · after 5</option></select>
          </label>
        </div>

        <p v-if="assignmentNotice" class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700" role="status">{{ assignmentNotice }}</p>
        <p class="mt-4 text-xs font-semibold text-slate-500">{{ visibleAppointments.length }} shown · {{ unassignedTodayCount }} need assignment today</p>

        <div v-if="visibleAppointments.length === 0" class="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">No appointments match these filters.</div>

        <div v-else class="mt-3 hidden overflow-x-auto md:block">
          <table class="w-full min-w-[980px] border-separate border-spacing-0 text-left">
            <thead>
              <tr class="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Time</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Customer</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">City</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Setter</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Bill</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Status</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Closer</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold">Result</th>
                <th class="border-b border-slate-200 px-3 py-3 font-semibold"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="appointment in visibleAppointments" :key="appointment.id" class="align-top text-sm text-slate-700">
                <td class="border-b border-slate-100 px-3 py-4 whitespace-nowrap"><strong class="block text-slate-900">{{ formatTime(appointment.scheduledStart) }}</strong><span class="text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }}</span></td>
                <td class="max-w-[190px] border-b border-slate-100 px-3 py-4"><button class="text-left font-semibold text-slate-900 hover:text-primary-600" type="button" @click="openAppointment(appointment.id)">{{ customerName(appointment) }}</button><span class="mt-1 block truncate text-xs text-slate-500">{{ address(appointment) }}</span></td>
                <td class="border-b border-slate-100 px-3 py-4">{{ city(appointment) }}</td>
                <td class="border-b border-slate-100 px-3 py-4">{{ setterName(appointment) }}</td>
                <td class="border-b border-slate-100 px-3 py-4"><span class="rounded-full px-2.5 py-1 text-[11px] font-bold" :class="appointment.hasBill ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ appointment.hasBill ? '✓ Bill' : 'Missing' }}</span></td>
                <td class="border-b border-slate-100 px-3 py-4"><span class="rounded-full px-2.5 py-1 text-[11px] font-bold" :class="statusClasses(appointment)">{{ statusLabel(appointment.status) }}</span><span v-if="appointment.needsCloserReview" class="mt-2 block w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">Closer unavailable · review</span></td>
                <td class="border-b border-slate-100 px-3 py-4">
                  <div v-if="isAssignmentRow(appointment)" class="min-w-[220px]">
                    <div class="flex items-center gap-2">
                      <select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs" :disabled="assigning[appointment.id]" @focus="ensureAvailableClosers(appointment)">
                        <option value="">{{ appointment.closerId ? closerName(appointment) : 'Select available closer' }}</option>
                        <option v-for="closer in availableClosers[appointment.id] ?? []" :key="closer.id" :value="closer.id">{{ closer.displayName }} · {{ closer.appointmentsToday }} today</option>
                      </select>
                      <button class="min-h-touch rounded-2xl bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id] || assigning[appointment.id]" type="button" @click="assign(appointment)">{{ assigning[appointment.id] ? 'Assigning…' : appointment.closerId ? 'Save' : 'Assign' }}</button>
                    </div>
                    <span v-if="!availableClosers[appointment.id]" class="mt-1 block text-[11px] text-slate-400">Checking available closers…</span>
                    <span v-else-if="availableClosers[appointment.id].length === 0" class="mt-1 block text-[11px] leading-4 text-amber-700">No AVAILABLE closer is free for this time. Update status in Team or choose another closer.</span>
                    <span v-if="assignmentError[appointment.id]" class="mt-1 block text-[11px] leading-4 text-red-600">{{ assignmentError[appointment.id] }}</span>
                    <span v-if="assignmentMessage[appointment.id]" class="mt-1 block text-[11px] font-semibold text-emerald-700">{{ assignmentMessage[appointment.id] }}</span>
                  </div>
                  <span v-else>{{ closerName(appointment) }}</span>
                </td>
                <td class="border-b border-slate-100 px-3 py-4 whitespace-nowrap">{{ appointment.outcome ? statusLabel(appointment.outcome) : '—' }}</td>
                <td class="border-b border-slate-100 px-3 py-4"><button class="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700" type="button" @click="openAppointment(appointment.id)">Open</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="visibleAppointments.length" class="mt-3 grid gap-3 md:hidden">
          <article v-for="appointment in visibleAppointments" :key="appointment.id" class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex min-w-0 items-start justify-between gap-3">
              <button class="min-w-0 text-left" type="button" @click="openAppointment(appointment.id)"><strong class="block text-lg tracking-tight text-slate-900">{{ formatTime(appointment.scheduledStart) }}</strong><span class="mt-1 block truncate text-sm font-semibold text-slate-800">{{ customerName(appointment) }}</span><span class="mt-1 block truncate text-xs text-slate-500">{{ city(appointment) }} · Setter: {{ setterName(appointment) }}</span></button>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" :class="statusClasses(appointment)">{{ statusLabel(appointment.status) }}</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs"><span class="rounded-full px-2.5 py-1 font-bold" :class="appointment.hasBill ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ appointment.hasBill ? '✓ Bill' : 'Bill missing' }}</span><span v-if="appointment.isOverflow" class="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Overflow</span><span v-if="appointment.needsCloserReview" class="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Closer unavailable · review</span><span v-if="appointment.outcome" class="text-slate-500">Result: {{ statusLabel(appointment.outcome) }}</span></div>
            <div v-if="isAssignmentRow(appointment)" class="mt-3 rounded-2xl bg-slate-50 p-3">
              <p class="text-xs font-semibold text-slate-500">{{ appointment.closerId ? 'Closer' : 'Closer assignment' }}</p>
              <div class="mt-2 grid gap-2 sm:flex">
                <select v-model="assignmentDraft[appointment.id]" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm" :disabled="assigning[appointment.id]" @focus="ensureAvailableClosers(appointment)"><option value="">{{ appointment.closerId ? closerName(appointment) : 'Select closer' }}</option><option v-for="closer in availableClosers[appointment.id] ?? []" :key="closer.id" :value="closer.id">{{ closer.displayName }} · {{ closer.appointmentsToday }} today</option></select><button class="touch-target rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="!assignmentDraft[appointment.id] || assigning[appointment.id]" type="button" @click="assign(appointment)">{{ assigning[appointment.id] ? 'Assigning…' : appointment.closerId ? 'Reassign' : 'Assign' }}</button>
              </div>
              <p v-if="!availableClosers[appointment.id]" class="mt-2 text-xs text-slate-400">Checking available closers…</p><p v-else-if="availableClosers[appointment.id].length === 0" class="mt-2 text-xs leading-5 text-amber-700">No AVAILABLE closer is free for this time. Update status in Team or choose another closer.</p><p v-if="assignmentError[appointment.id]" class="mt-2 text-xs leading-5 text-red-600">{{ assignmentError[appointment.id] }}</p><p v-if="assignmentMessage[appointment.id]" class="mt-2 text-xs font-semibold text-emerald-700">{{ assignmentMessage[appointment.id] }}</p>
            </div>
            <p v-else class="mt-3 text-sm text-slate-700">Closer: <strong>{{ closerName(appointment) }}</strong></p>
            <button class="mt-3 min-h-touch rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700" type="button" @click="openAppointment(appointment.id)">Open appointment</button>
          </article>
        </div>
      </section>

      <section v-else class="page-surface min-w-0 p-4">
        <div class="flex min-w-0 items-start justify-between gap-3"><div><p class="field-label">FIELD QUEUE</p><h2 class="mt-1 text-lg font-semibold text-slate-900">Appointments</h2></div><button class="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="load">Refresh</button></div>
        <div class="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2"><label class="text-xs font-semibold text-slate-500">Filter <select v-model="statusFilter" class="ml-1 min-h-touch max-w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"><option value="PRIORITY">Active · unassigned first</option><option value="ACTIVE">Active</option><option value="UNASSIGNED">Unassigned</option><option value="CANCELLED">Cancelled</option><option value="RESCHEDULED">Rescheduled</option><option value="COMPLETED">Completed</option><option value="ALL">All</option></select></label><span class="text-xs text-slate-500">{{ visibleAppointments.length }} shown · {{ appointments.length }} total</span></div>
        <div v-if="visibleAppointments.length === 0" class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No appointments match this filter.</div>
        <div v-else class="mt-4 grid min-w-0 gap-3">
          <article v-for="appointment in visibleAppointments" :key="appointment.id" class="min-w-0 rounded-2xl border border-slate-200 p-4">
            <button class="w-full min-w-0 text-left" type="button" @click="openAppointment(appointment.id)"><div class="flex min-w-0 items-start justify-between gap-3"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-900">{{ customerName(appointment) }}</p><p class="mt-1 text-xs text-slate-500">{{ formatDate(appointment.scheduledStart) }} · {{ formatTime(appointment.scheduledStart) }}</p><p class="mt-1 truncate text-xs text-slate-500">{{ address(appointment) }} · Setter: {{ setterName(appointment) }}</p></div><span class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{{ statusLabel(appointment.outcome ?? appointment.status) }}</span></div></button>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>Closer: <strong class="text-slate-700">{{ closerName(appointment) }}</strong></span><span class="rounded-full px-2.5 py-1 font-semibold" :class="appointment.hasBill ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ appointment.hasBill ? '✓ Bill' : 'Bill missing' }}</span><span v-if="appointment.outcomeNotes" class="max-w-full truncate">{{ appointment.outcomeNotes }}</span></div>
            <div v-if="(user.can('appointment:cancel') || user.can('appointment:reschedule')) && !['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(appointment.status)" class="mt-3 grid min-w-0 gap-2 sm:grid-cols-[1fr_auto_auto]"><template v-if="user.can('appointment:cancel')"><input v-model="cancelReason[appointment.id]" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 px-3 text-xs" placeholder="Cancellation reason" /><button class="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50" :disabled="!cancelReason[appointment.id]?.trim()" type="button" @click="cancel(appointment)">Cancel</button></template><button v-if="user.can('appointment:reschedule')" class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="toggleReschedule(appointment.id)">Reschedule</button></div>
            <div v-if="rescheduleTarget === appointment.id" class="mt-3 rounded-2xl border border-primary-200 bg-primary-50 p-4"><OperationalSlotPicker v-model="rescheduleSlot[appointment.id]" v-model:allow-overflow="rescheduleOverflow[appointment.id]" :slots="operationalSlots" :sticky="false" cta-verb="Move to" @confirm="reschedule(appointment)" /></div>
            <div v-if="user.can('appointment:update-outcome') && appointment.closerId === user.id && ['ASSIGNED', 'STARTED', 'RESCHEDULED'].includes(appointment.status)" class="mt-3 rounded-2xl bg-primary-50 p-3"><p class="field-label text-primary-700">CLOSER RESULT</p><div class="mt-2 flex flex-wrap gap-2"><button v-for="outcome in outcomes" :key="outcome" class="rounded-full border px-3 py-2 text-xs font-semibold" :class="selectedOutcome === outcome ? 'border-primary-600 bg-primary-600 text-white' : 'border-primary-200 bg-white text-primary-700'" type="button" @click="selectedOutcome = outcome">{{ outcome.replaceAll('_', ' ') }}</button></div><textarea v-model="closerNoteDraft" class="mt-3 min-h-20 w-full rounded-2xl border border-primary-200 bg-white p-3 text-sm" placeholder="What happened at the appointment?" /><button class="mt-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" :disabled="!selectedOutcome" type="button" @click="recordOutcome(appointment)">Save result</button></div>
          </article>
        </div>
      </section>

      <section v-if="selectedContext" class="page-surface mt-4 min-w-0 p-4">
        <div class="flex min-w-0 items-start justify-between gap-3"><div class="min-w-0"><p class="field-label text-primary-600">APPOINTMENT LIFECYCLE</p><h2 class="mt-1 truncate text-lg font-semibold text-slate-900">{{ selectedContext.context.lead.homeownerName }}</h2><p class="mt-1 truncate text-sm text-slate-500">{{ selectedContext.context.lead.addressLine1 }}</p></div><button class="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" type="button" @click="selectedContext = null">Close</button></div>
        <div class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Appointment</span><strong class="mt-1 block text-slate-900">{{ formatDate(selectedContext.appointment.scheduledStart) }} · {{ formatTime(selectedContext.appointment.scheduledStart) }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Closer</span><strong class="mt-1 block truncate text-slate-900">{{ closerName(selectedContext.appointment) }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Status</span><strong class="mt-1 block text-slate-900">{{ statusLabel(selectedContext.appointment.status) }}</strong></div><div class="rounded-2xl bg-slate-50 p-3"><span class="text-slate-500">Result</span><strong class="mt-1 block text-slate-900">{{ selectedContext.appointment.outcome ? statusLabel(selectedContext.appointment.outcome) : '—' }}</strong></div></div>
        <div class="mt-3 flex flex-wrap gap-2 text-xs"><span class="rounded-full px-3 py-2 font-semibold" :class="selectedContext.context.bills.filter((bill) => bill.replacedBy == null).length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">{{ selectedContext.context.bills.filter((bill) => bill.replacedBy == null).length ? '✓ Bill on file' : 'Bill missing' }}</span><span v-if="selectedContext.appointment.outcomeNotes" class="rounded-full bg-primary-50 px-3 py-2 text-primary-700">Closer note: {{ selectedContext.appointment.outcomeNotes }}</span></div>
        <div v-if="selectedContext.context.bills.filter((bill) => bill.replacedBy == null).length" class="mt-3 grid gap-2"><div v-for="bill in selectedContext.context.bills.filter((bill) => bill.replacedBy == null)" :key="bill.id" class="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3"><span class="min-w-0 truncate text-sm font-semibold text-slate-800">{{ bill.fileName }}</span><div v-if="user.can('bill:view-own') || user.can('bill:view-assigned') || user.can('bill:view-all')" class="flex shrink-0 gap-2"><button class="touch-target rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="viewBill(bill.id)">View</button><button class="touch-target rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white" type="button" @click="downloadBill(bill.id)">Download</button></div></div></div>
        <p v-if="billError" class="mt-2 text-xs font-semibold text-red-700" role="alert">{{ billError }}</p>

        <div v-if="canAppointmentActions(selectedContext.appointment)" class="mt-4 rounded-2xl border border-slate-200 p-3"><div class="grid min-w-0 gap-2 sm:grid-cols-[1fr_auto_auto]"><input v-if="user.can('appointment:cancel')" v-model="cancelReason[selectedContext.appointment.id]" class="min-h-touch min-w-0 rounded-2xl border border-slate-200 px-3 text-xs" placeholder="Cancellation reason" /><span v-else></span><button v-if="user.can('appointment:cancel')" class="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50" :disabled="!cancelReason[selectedContext.appointment.id]?.trim()" type="button" @click="cancel(selectedContext.appointment)">Cancel</button><button v-if="user.can('appointment:reschedule')" class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" type="button" @click="toggleReschedule(selectedContext.appointment.id)">Reschedule</button></div><div v-if="rescheduleTarget === selectedContext.appointment.id" class="mt-3 rounded-2xl border border-primary-200 bg-primary-50 p-3"><OperationalSlotPicker v-model="rescheduleSlot[selectedContext.appointment.id]" v-model:allow-overflow="rescheduleOverflow[selectedContext.appointment.id]" :slots="operationalSlots" :sticky="false" cta-verb="Move to" @confirm="reschedule(selectedContext.appointment)" /></div></div>

        <div class="mt-4 grid min-w-0 gap-3"><div><p class="field-label">SETTER NOTES</p><div v-for="note in selectedContext.context.notes.filter((note) => !isCloserNote(note))" :key="note.id" class="mt-2 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700"><p>{{ note.body }}</p><p class="mt-1 text-[11px] text-slate-400">{{ note.authorName || 'Setter' }} · {{ formatDate(note.createdAt) }}</p></div><p v-if="selectedContext.context.notes.filter((note) => !isCloserNote(note)).length === 0" class="mt-2 text-sm text-slate-500">No setter notes.</p></div><div><p class="field-label">CLOSER NOTES</p><div v-for="note in selectedContext.context.notes.filter(isCloserNote)" :key="note.id" class="mt-2 rounded-2xl border border-primary-200 bg-primary-50 p-3 text-sm text-slate-700"><p>{{ note.body }}</p><p class="mt-1 text-[11px] text-slate-500">{{ note.authorName || 'Closer' }} · {{ formatDate(note.createdAt) }}</p></div><p v-if="selectedContext.context.notes.filter(isCloserNote).length === 0" class="mt-2 text-sm text-slate-500">No closer notes.</p></div><div><p class="field-label">ACTIVITY HISTORY</p><div v-for="activity in selectedContext.context.activities.slice(0, 12)" :key="activity.id" class="mt-2 text-xs text-slate-500">{{ statusLabel(activity.eventType) }} · {{ activity.actorName || 'System' }} · {{ formatDate(activity.createdAt) }}</div></div></div>
        <form v-if="user.can('lead:update-own') || user.can('lead:update-all')" class="mt-4 flex min-w-0 gap-2" @submit.prevent="addNote"><input v-model="noteDraft" class="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 text-sm" placeholder="Add a note" required /><button class="touch-target shrink-0 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="submit">Add note</button></form>
        <div v-if="user.can('appointment:update-outcome') && selectedContext.appointment.closerId === user.id && ['ASSIGNED', 'STARTED', 'RESCHEDULED'].includes(selectedContext.appointment.status)" class="mt-4 rounded-2xl bg-primary-50 p-3"><p class="field-label text-primary-700">CLOSER RESULT</p><div class="mt-2 flex flex-wrap gap-2"><button v-for="outcome in outcomes" :key="outcome" class="rounded-full border px-3 py-2 text-xs font-semibold" :class="selectedOutcome === outcome ? 'border-primary-600 bg-primary-600 text-white' : 'border-primary-200 bg-white text-primary-700'" type="button" @click="selectedOutcome = outcome">{{ outcome.replaceAll('_', ' ') }}</button></div><textarea v-model="closerNoteDraft" class="mt-3 min-h-20 w-full rounded-2xl border border-primary-200 bg-white p-3 text-sm" placeholder="What happened at the appointment?" /><button class="mt-2 touch-target rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="!selectedOutcome" type="button" @click="recordOutcome(selectedContext.appointment)">Save result</button></div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MobileHeader from "../components/MobileHeader.vue";
import OperationalSlotPicker from "../components/OperationalSlotPicker.vue";
import { useOperationalRefresh } from "../composables/useOperationalRefresh";
import { addFieldNote, assignFieldAppointment, cancelFieldAppointment, downloadFieldBill, getAvailableFieldClosers, getFieldAppointment, getFieldAppointments, getFieldBillDownloadUrl, getFieldClosers, getFieldLeads, getFieldOperationalSlots, rescheduleFieldAppointment, updateFieldOutcome, type AvailableCloser, type FieldAppointment, type FieldLead, type FieldLeadContext, type FieldOperationalSlot } from "../services/api";
import { useUserStore } from "../stores/user.store";

type ManagerStatusFilter = "PRIORITY" | "NEEDS_REVIEW" | "UNASSIGNED" | "ASSIGNED" | "COMPLETED" | "CANCELLED" | "ALL" | "ACTIVE";
type DateFilter = "TODAY" | "UPCOMING" | "ALL";
type TimeFilter = "ALL" | "MORNING" | "AFTERNOON" | "EVENING";

const user = useUserStore();
const appointments = ref<FieldAppointment[]>([]);
const leads = ref<FieldLead[]>([]);
const operationalSlots = ref<FieldOperationalSlot[]>([]);
const closers = ref<Array<{ id: string; displayName: string; teamIds: string[] }>>([]);
const availableClosers = ref<Record<string, AvailableCloser[]>>({});
const selectedContext = ref<{ context: FieldLeadContext; appointment: FieldAppointment } | null>(null);
const assignmentDraft = ref<Record<string, string>>({});
const assigning = ref<Record<string, boolean>>({});
const assignmentError = ref<Record<string, string>>({});
const assignmentMessage = ref<Record<string, string>>({});
const assignmentNotice = ref("");
const billError = ref("");
const noteDraft = ref("");
const closerNoteDraft = ref("");
const selectedOutcome = ref("");
const cancelReason = ref<Record<string, string>>({});
const rescheduleTarget = ref("");
const rescheduleSlot = ref<Record<string, string>>({});
const rescheduleOverflow = ref<Record<string, boolean>>({});
const statusFilter = ref<ManagerStatusFilter>("PRIORITY");
const dateFilter = ref<DateFilter>("ALL");
const closerFilter = ref("ALL");
const setterFilter = ref("ALL");
const timeFilter = ref<TimeFilter>("ALL");
const error = ref("");
const outcomes = ["CLOSED", "SAT_NOT_CLOSED", "DID_NOT_SIT", "CREDIT_FAIL", "NO_SHOW", "NOT_QUALIFIED", "FOLLOW_UP", "RESCHEDULED", "CANCELLED"] as const;
const isManagerBoard = computed(() => user.can("appointment:assign") || user.can("appointment:reassign"));

const closerOptions = computed(() => {
  if (closers.value.length) return closers.value;
  const seen = new Map<string, { id: string; displayName: string; teamIds: string[] }>();
  appointments.value.forEach((appointment) => { if (appointment.closerId) seen.set(appointment.closerId, { id: appointment.closerId, displayName: closerName(appointment), teamIds: [] }); });
  return [...seen.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
});
const setterOptions = computed(() => {
  const seen = new Map<string, { id: string; displayName: string }>();
  appointments.value.forEach((appointment) => { if (appointment.setterId) seen.set(appointment.setterId, { id: appointment.setterId, displayName: setterName(appointment) }); });
  return [...seen.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
});
const todayCount = computed(() => appointments.value.filter((appointment) => isToday(appointment.scheduledStart)).length);
const unassignedTodayCount = computed(() => appointments.value.filter((appointment) => isToday(appointment.scheduledStart) && appointment.status === "UNASSIGNED").length);
const assignedCount = computed(() => appointments.value.filter((appointment) => Boolean(appointment.closerId) && !["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status)).length);
const needsReviewCount = computed(() => appointments.value.filter((appointment) => appointment.needsCloserReview).length);
const completedCount = computed(() => appointments.value.filter((appointment) => ["COMPLETED", "NO_SHOW"].includes(appointment.status)).length);
const visibleAppointments = computed(() => appointments.value.filter((appointment) => matchesFilters(appointment)).sort((a, b) => {
  if (statusFilter.value === "PRIORITY") {
    const priority = (item: FieldAppointment) => item.status === "UNASSIGNED" ? 0 : item.needsCloserReview ? 1 : ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(item.status) ? 3 : 2;
    const difference = priority(a) - priority(b);
    if (difference !== 0) return difference;
  }
  return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
}));

useOperationalRefresh(load);

async function load() {
  error.value = "";
  assignmentNotice.value = "";
  const results = await Promise.allSettled([
    getFieldAppointments(),
    getFieldLeads(),
    getFieldOperationalSlots(),
    isManagerBoard.value ? getFieldClosers() : Promise.resolve([]),
  ]);
  const [appointmentResult, leadResult, slotResult, closerResult] = results;
  if (appointmentResult.status === "fulfilled") appointments.value = appointmentResult.value;
  if (leadResult.status === "fulfilled") leads.value = leadResult.value;
  if (slotResult.status === "fulfilled") operationalSlots.value = slotResult.value;
  if (closerResult.status === "fulfilled") closers.value = closerResult.value;
  if (appointmentResult.status === "rejected") error.value = "The appointment queue could not be loaded.";
  availableClosers.value = {};
  if (appointmentResult.status === "fulfilled" && isManagerBoard.value) await refreshAvailableClosers(appointmentResult.value.filter(isAssignmentRow));
}

async function refreshAvailableClosers(items: FieldAppointment[]) {
  const candidates = await Promise.all(items.map(async (appointment) => [appointment.id, await getAvailableFieldClosers(appointment.id).catch(() => [])] as const));
  availableClosers.value = { ...availableClosers.value, ...Object.fromEntries(candidates) };
}

async function ensureAvailableClosers(appointment: FieldAppointment) {
  if (availableClosers.value[appointment.id]) return;
  await refreshAvailableClosers([appointment]);
}

async function openAppointment(id: string) {
  try { selectedContext.value = await getFieldAppointment(id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to load appointment context."; }
}

async function assign(appointment: FieldAppointment) {
  const closerId = assignmentDraft.value[appointment.id];
  if (!closerId || assigning.value[appointment.id]) return;
  assigning.value[appointment.id] = true;
  assignmentError.value[appointment.id] = "";
  assignmentMessage.value[appointment.id] = "";
  try {
    const updated = await assignFieldAppointment(appointment.id, closerId);
    replaceAppointment(updated);
    assignmentDraft.value[appointment.id] = "";
    assignmentMessage.value[appointment.id] = `Assigned to ${updated.closerName ?? closerOptions.value.find((item) => item.id === closerId)?.displayName ?? "closer"} ✓`;
    assignmentNotice.value = assignmentMessage.value[appointment.id];
    await ensureAvailableClosers(updated);
    if (selectedContext.value?.appointment.id === updated.id) selectedContext.value = await getFieldAppointment(updated.id).catch(() => selectedContext.value);
  } catch (caught) {
    assignmentError.value[appointment.id] = caught instanceof Error ? caught.message : "Unable to assign the closer. Choose another eligible closer.";
  } finally {
    assigning.value[appointment.id] = false;
  }
}

async function recordOutcome(appointment: FieldAppointment) {
  if (!selectedOutcome.value) return;
  if (selectedOutcome.value === "CANCELLED" && !window.confirm("Cancel this appointment? This will release its slot capacity.")) return;
  try { const updated = await updateFieldOutcome(appointment.id, selectedOutcome.value, closerNoteDraft.value.trim() || undefined); replaceAppointment(updated); selectedOutcome.value = ""; closerNoteDraft.value = ""; await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to record the outcome."; }
}

async function cancel(appointment: FieldAppointment) {
  const reason = cancelReason.value[appointment.id]?.trim();
  if (!reason) return;
  if (!window.confirm(`Cancel the appointment for ${customerName(appointment)}? This will release its slot capacity.`)) return;
  try { const updated = await cancelFieldAppointment(appointment.id, reason); replaceAppointment(updated); cancelReason.value[appointment.id] = ""; if (selectedContext.value?.appointment.id === updated.id) await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to cancel appointment."; }
}

async function reschedule(appointment: FieldAppointment) {
  const slotId = rescheduleSlot.value[appointment.id];
  if (!slotId) return;
  try { const updated = await rescheduleFieldAppointment(appointment.id, slotId, rescheduleOverflow.value[appointment.id] === true); replaceAppointment(updated); rescheduleTarget.value = ""; rescheduleSlot.value[appointment.id] = ""; rescheduleOverflow.value[appointment.id] = false; operationalSlots.value = await getFieldOperationalSlots(); if (selectedContext.value?.appointment.id === updated.id) await openAppointment(updated.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to reschedule appointment."; }
}

function toggleReschedule(id: string) { rescheduleTarget.value = rescheduleTarget.value === id ? "" : id; }

async function addNote() {
  if (!selectedContext.value || !noteDraft.value.trim()) return;
  try { await addFieldNote(selectedContext.value.context.lead.id, noteDraft.value.trim(), selectedContext.value.appointment.id); noteDraft.value = ""; await openAppointment(selectedContext.value.appointment.id); } catch (caught) { error.value = caught instanceof Error ? caught.message : "Unable to add note."; }
}

async function viewBill(billId: string) {
  billError.value = "";
  try { window.open(await getFieldBillDownloadUrl(billId), "_blank", "noopener,noreferrer"); } catch (caught) { billError.value = caught instanceof Error ? caught.message : "The bill could not be opened."; }
}

async function downloadBill(billId: string) {
  billError.value = "";
  try { await downloadFieldBill(billId); } catch (caught) { billError.value = caught instanceof Error ? caught.message : "The bill could not be downloaded."; }
}

function replaceAppointment(updated: FieldAppointment) { appointments.value = appointments.value.map((item) => item.id === updated.id ? updated : item); if (selectedContext.value?.appointment.id === updated.id) selectedContext.value.appointment = updated; }
function isAssignmentRow(appointment: FieldAppointment) { return appointment.status === "UNASSIGNED" ? user.can("appointment:assign") : ["ASSIGNED", "RESCHEDULED"].includes(appointment.status) && user.can("appointment:reassign"); }
function canAppointmentActions(appointment: FieldAppointment) { return (user.can("appointment:cancel") || user.can("appointment:reschedule")) && !["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status); }
function leadFor(id: string) { return leads.value.find((lead) => lead.id === id); }
function customerName(appointment: FieldAppointment) { return appointment.homeownerName ?? leadFor(appointment.leadId)?.homeownerName ?? `Lead ${appointment.leadId.slice(0, 8)}`; }
function address(appointment: FieldAppointment) { return appointment.addressLine1 ?? leadFor(appointment.leadId)?.addressLine1 ?? "Address unavailable"; }
function city(appointment: FieldAppointment) { return [appointment.city ?? leadFor(appointment.leadId)?.city, appointment.state ?? leadFor(appointment.leadId)?.state].filter(Boolean).join(", ") || "—"; }
function setterName(appointment: FieldAppointment) { return appointment.setterName ?? (appointment.setterId ? `Setter ${appointment.setterId.slice(0, 8)}` : "—"); }
function closerName(appointment: FieldAppointment) { return appointment.closerName ?? (appointment.closerId ? closers.value.find((closer) => closer.id === appointment.closerId)?.displayName ?? `Closer ${appointment.closerId.slice(0, 8)}` : "Unassigned"); }
function statusLabel(value: string) { return value.replaceAll("_", " "); }
function statusClasses(appointment: FieldAppointment) { if (appointment.status === "UNASSIGNED") return "bg-amber-50 text-amber-800"; if (["COMPLETED", "NO_SHOW"].includes(appointment.status)) return "bg-emerald-50 text-emerald-700"; if (appointment.status === "CANCELLED") return "bg-red-50 text-red-700"; return "bg-slate-100 text-slate-600"; }
function matchesFilters(appointment: FieldAppointment) {
  const start = new Date(appointment.scheduledStart);
  if (dateFilter.value === "TODAY" && !isToday(appointment.scheduledStart)) return false;
  if (dateFilter.value === "UPCOMING" && start.getTime() <= Date.now()) return false;
  if (statusFilter.value === "UNASSIGNED" && appointment.status !== "UNASSIGNED") return false;
  if (statusFilter.value === "NEEDS_REVIEW" && !appointment.needsCloserReview) return false;
  if (statusFilter.value === "ASSIGNED" && (!appointment.closerId || ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status))) return false;
  if (statusFilter.value === "COMPLETED" && !["COMPLETED", "NO_SHOW"].includes(appointment.status)) return false;
  if (statusFilter.value === "CANCELLED" && appointment.status !== "CANCELLED") return false;
  if ((statusFilter.value === "PRIORITY" || statusFilter.value === "ACTIVE" || statusFilter.value === "NEEDS_REVIEW") && ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(appointment.status)) return false;
  if (closerFilter.value !== "ALL" && appointment.closerId !== closerFilter.value) return false;
  if (setterFilter.value !== "ALL" && appointment.setterId !== setterFilter.value) return false;
  const hour = start.getHours();
  if (timeFilter.value === "MORNING" && hour >= 12) return false;
  if (timeFilter.value === "AFTERNOON" && (hour < 12 || hour >= 17)) return false;
  if (timeFilter.value === "EVENING" && hour < 17) return false;
  return true;
}
function isToday(value: string) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate(); }
function isCloserNote(note: FieldLeadContext["notes"][number]) { const appointment = selectedContext.value?.appointment; return note.authorRole === "CLOSER" || (Boolean(appointment?.closerId) && note.appointmentId === appointment?.id && note.authorId === appointment?.closerId); }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
</script>
