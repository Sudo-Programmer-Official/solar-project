<template>
  <main class="px-4 pb-4">
    <MobileHeader
      eyebrow="BLACKOPS FIELD"
      title="Leads"
      subtitle="Persisted outcomes across saved, skipped, and revisit leads."
    />

    <section class="page-surface p-4">
      <p class="field-label">Lead history</p>
      <p class="mt-1 text-lg font-semibold text-slate-900">Global lead queue</p>
      <p class="mt-1 text-sm text-slate-500">{{ leadCountLabel }}</p>
    </section>

    <section class="mt-4 page-surface p-4">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="touch-target rounded-2xl border px-3 py-3 text-sm font-semibold transition"
          :class="activeTab === tab.key ? activeTabClasses : inactiveTabClasses"
          type="button"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </section>

    <section class="mt-4 grid gap-4">
      <LoadingCard v-if="loading" />

      <EmptyState
        v-else-if="errorMessage"
        title="Couldn't load your leads."
        :message="errorMessage"
        action-label="Retry"
        @action="reload"
      />

      <EmptyState
        v-else-if="tabbedLeads.length === 0"
        title="No leads yet."
        message="Saved, skipped, and revisit outcomes will appear here after you swipe or update a property."
      />

      <template v-else>
        <div v-for="lead in tabbedLeads" :key="lead.id" class="space-y-2">
          <LeadCard
            :lead="lead"
            :selected="selectedIds.has(lead.propertyId ?? lead.id)"
            @navigate="navigate(lead)"
            @toggle="toggleLead(lead)"
            @open="openLead(lead)"
          />

          <div class="page-surface flex flex-wrap items-center gap-2 p-3">
            <p class="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Change status</p>
            <button
              v-for="option in statusActions"
              :key="option.outcome"
              class="rounded-full border px-3 py-2 text-xs font-semibold transition"
              :class="lead.outcome === option.outcome ? activeOutcomeClasses : inactiveOutcomeClasses"
              :aria-label="`Set lead status to ${option.label}`"
              type="button"
              @click="setOutcome(lead, option.outcome)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { LeadOutcome, LeadOutcomeCard } from "@solar/contracts";
import { useLeadOutcomeStore } from "../stores/lead-outcome.store";
import LeadCard from "../components/LeadCard.vue";
import MobileHeader from "../components/MobileHeader.vue";
import LoadingCard from "../components/LoadingCard.vue";
import EmptyState from "../components/EmptyState.vue";
import { useLeadActions } from "../composables/useLeadActions";
import { useHuntStore } from "../stores/hunt.store";

const router = useRouter();
const leadOutcomeStore = useLeadOutcomeStore();
const hunt = useHuntStore();
const { outcomes, loading, error, summary } = storeToRefs(leadOutcomeStore);
const { updateOutcome, openDirections } = useLeadActions();
const selectedIds = computed(() => new Set(hunt.selectedPropertyIds));
const tabs = [
  { key: "all", label: "All" },
  { key: "saved", label: "Saved" },
  { key: "skipped", label: "Skipped" },
  { key: "revisit", label: "Revisit" },
] as const;
const activeTab = ref<(typeof tabs)[number]["key"]>("all");
const activeTabClasses = "border-primary-300 bg-primary-50 text-slate-900 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]";
const inactiveTabClasses = "border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-slate-50";
const activeOutcomeClasses = "border-primary-300 bg-primary-50 text-slate-900";
const inactiveOutcomeClasses = "border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:bg-slate-50";
const statusActions = [
  { outcome: "SAVED", label: "Saved" },
  { outcome: "SKIPPED", label: "Skipped" },
  { outcome: "REVISIT", label: "Revisit" },
] as const satisfies ReadonlyArray<{ outcome: LeadOutcome["outcome"]; label: string }>;

const tabbedLeads = computed(() => outcomes.value.filter((lead) => matchesTab(lead, activeTab.value)));
const leadCountLabel = computed(
  () => `${summary.value.all} leads · ${summary.value.saved} saved · ${summary.value.skipped} skipped · ${summary.value.revisit} revisits`,
);
const errorMessage = computed(() => error.value ?? null);

onMounted(async () => {
  await reload();
});

async function reload() {
  try {
    await leadOutcomeStore.fetchOutcomes("ALL");
  } catch {
    // Error state is surfaced through the store.
  }
}

function navigate(lead: LeadOutcomeCard) {
  const propertyId = lead.propertyId ?? lead.id;
  if (lead.latitude != null && lead.longitude != null) {
    openDirections(lead.latitude, lead.longitude);
    return;
  }
  router.push(`/properties/${propertyId}`);
}

function openLead(lead: LeadOutcomeCard) {
  navigate(lead);
}

async function setOutcome(lead: LeadOutcomeCard, outcome: LeadOutcome["outcome"]) {
  const propertyId = lead.propertyId ?? lead.id;
  await updateOutcome(propertyId, outcome, lead);
}

function toggleLead(lead: LeadOutcomeCard) {
  hunt.selectLead(lead.propertyId ?? lead.id);
}

function matchesTab(lead: LeadOutcomeCard, tab: (typeof tabs)[number]["key"]) {
  if (tab === "all") {
    return true;
  }
  if (tab === "saved") {
    return lead.outcome === "SAVED";
  }
  if (tab === "skipped") {
    return lead.outcome === "SKIPPED";
  }
  return lead.outcome === "REVISIT" || lead.outcome === "NOT_HOME" || lead.outcome === "BILL_REQUESTED";
}
</script>
