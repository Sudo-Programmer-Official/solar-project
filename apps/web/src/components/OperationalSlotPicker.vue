<template>
  <section class="operational-slot-picker box-border w-full min-w-0 max-w-full overflow-hidden">
    <div class="w-full min-w-0 max-w-full">
      <p class="field-label text-primary-700">CHOOSE APPOINTMENT</p>
      <p class="mt-1 text-sm text-slate-500">Pick one of the six fixed field times.</p>
    </div>

    <div v-if="dateOptions.length" class="operational-slot-date-scroller mt-5 flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-auto overscroll-x-contain px-0 pb-2" role="tablist" aria-label="Appointment date">
      <button
        v-for="date in dateOptions"
        :key="date"
        class="flex min-h-[52px] min-w-[88px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl border px-3 py-2 text-center transition focus:outline-none focus:ring-2 focus:ring-primary-300"
        :class="selectedDate === date ? 'border-primary-500 bg-primary-50 text-slate-950 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300'"
        :aria-selected="selectedDate === date"
        role="tab"
        type="button"
        @click="selectDate(date)"
      >
        <span class="text-[11px] font-bold uppercase tracking-[0.08em]">{{ dateWeekday(date) }}</span>
        <span class="mt-0.5 text-sm font-semibold">{{ dateShort(date) }}</span>
      </button>
    </div>

    <div v-if="selectedDateSlots.length" class="operational-slot-grid mt-4 grid w-full min-w-0 max-w-full gap-3" role="list" aria-label="Operational appointment times">
      <button
        v-for="slot in selectedDateSlots"
        :key="slot.id"
        class="relative box-border flex w-full min-w-0 max-w-full min-h-[60px] flex-col items-start justify-center rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
        :class="slotClasses(slot)"
        :aria-label="slotAriaLabel(slot)"
        :aria-pressed="modelValue === slot.id"
        :disabled="isBlocked(slot)"
        type="button"
        @click="selectSlot(slot)"
      >
        <span class="min-w-0 pr-6 text-base font-bold text-slate-950">{{ formatOperationalTime(slot.startTime) }}</span>
        <span class="mt-1 max-w-full break-words text-xs font-semibold" :class="isOverflowAvailable(slot) ? 'text-amber-700' : 'text-slate-500'">{{ operationalSlotStateLabel(slot) }}</span>
        <span v-if="modelValue === slot.id" class="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-sm font-black text-slate-950" aria-hidden="true">✓</span>
      </button>
    </div>

    <p v-else class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No operational times are available for this date.</p>

    <label v-if="selectedSlot && isOverflowAvailable(selectedSlot)" class="box-border flex w-full min-w-0 max-w-full mt-4 min-h-[60px] items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <input
        class="mt-1 h-5 w-5 accent-cyan-500"
        type="checkbox"
        :checked="allowOverflow"
        @change="emit('update:allowOverflow', ($event.target as HTMLInputElement).checked)"
      />
      <span><strong class="block">Add to overflow</strong><span class="mt-0.5 block text-xs leading-5 text-amber-800">This time is full. Confirming adds the appointment beyond standard capacity.</span></span>
    </label>

    <div v-if="showCta" :class="sticky ? 'sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-5 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none' : 'mt-5 border-t border-slate-200 pt-4 sm:border-0 sm:pt-5'">
      <button class="box-border min-h-[60px] w-full min-w-0 max-w-full rounded-2xl bg-cyan-700 px-4 py-3 text-center text-base font-bold text-white shadow-lg shadow-cyan-900/10 transition hover:bg-cyan-800 active:bg-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100" :disabled="!canConfirm" type="button" @click="emit('confirm')">
        {{ ctaLabel }}{{ selectedSlot ? ` ${formatOperationalTime(selectedSlot.startTime)}` : "" }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { FieldOperationalSlot } from "../services/api";
import { formatOperationalDate, formatOperationalTime, oneSlotPerDateAndTime, operationalSlotStateLabel } from "../utils/operational-slots";

const props = withDefaults(defineProps<{
  slots: FieldOperationalSlot[];
  modelValue: string;
  allowOverflow: boolean;
  ctaVerb?: string;
  sticky?: boolean;
  showCta?: boolean;
}>(), { ctaVerb: "Book", sticky: true, showCta: true });

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:allowOverflow": [value: boolean];
  confirm: [];
}>();

const selectedDate = ref("");
const allowedOperationalTimes = new Set(["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]);
const operationalSlots = computed(() => props.slots.filter((slot) => allowedOperationalTimes.has(slot.startTime)));
const dateOptions = computed(() => [...new Set(operationalSlots.value.map((slot) => slot.slotDate))].sort());
const selectedDateSlots = computed(() => oneSlotPerDateAndTime(operationalSlots.value.filter((slot) => slot.slotDate === selectedDate.value)).sort((a, b) => a.startTime.localeCompare(b.startTime)));
const selectedSlot = computed(() => operationalSlots.value.find((slot) => slot.id === props.modelValue) ?? null);
const canConfirm = computed(() => Boolean(selectedSlot.value) && !isBlocked(selectedSlot.value!) && (!isOverflowAvailable(selectedSlot.value!) || props.allowOverflow));
const ctaLabel = computed(() => props.ctaVerb);

watch(dateOptions, (dates) => {
  if (!dates.includes(selectedDate.value)) selectedDate.value = dates[0] ?? "";
}, { immediate: true });

watch(() => props.modelValue, (slotId) => {
  const slot = operationalSlots.value.find((candidate) => candidate.id === slotId);
  if (slot) selectedDate.value = slot.slotDate;
});

function selectDate(date: string) {
  selectedDate.value = date;
  const selected = operationalSlots.value.find((slot) => slot.id === props.modelValue);
  if (selected && selected.slotDate !== date) {
    emit("update:modelValue", "");
    emit("update:allowOverflow", false);
  }
}

function selectSlot(slot: FieldOperationalSlot) {
  emit("update:modelValue", slot.id);
  emit("update:allowOverflow", false);
}

function isOverflowAvailable(slot: FieldOperationalSlot): boolean {
  return isStandardCapacityExhausted(slot) && slot.overflowPolicy === "ALLOW_WITH_WARNING" && slot.status === "OPEN";
}

function isBlocked(slot: FieldOperationalSlot): boolean {
  return slot.status === "BLOCKED" || (isStandardCapacityExhausted(slot) && slot.overflowPolicy === "BLOCK");
}

function hasBooking(slot: FieldOperationalSlot): boolean {
  return slot.bookedCount > 0 || slot.appointments.length > 0;
}

function isStandardCapacityExhausted(slot: FieldOperationalSlot): boolean {
  return hasBooking(slot) && slot.remainingCapacity <= 0;
}

function slotClasses(slot: FieldOperationalSlot): string {
  if (props.modelValue === slot.id) return "border-primary-500 bg-primary-50 ring-2 ring-primary-200";
  if (isOverflowAvailable(slot)) return "border-amber-300 bg-amber-50/70 hover:border-amber-400";
  if (isBlocked(slot)) return "border-slate-200 bg-slate-50";
  return "border-slate-200 bg-white hover:border-primary-300";
}

function slotAriaLabel(slot: FieldOperationalSlot): string {
  const overflow = isOverflowAvailable(slot) ? " Select to review overflow confirmation." : "";
  return `${formatOperationalTime(slot.startTime)}, ${operationalSlotStateLabel(slot)}.${overflow}`;
}

function dateWeekday(date: string): string {
  return formatOperationalDate(date, { weekday: "short" });
}

function dateShort(date: string): string {
  return formatOperationalDate(date, { month: "short", day: "numeric" });
}
</script>

<style scoped>
.operational-slot-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 359px) {
  .operational-slot-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
