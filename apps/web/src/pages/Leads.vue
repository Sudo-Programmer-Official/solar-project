<template>
  <main class="px-4 pb-4">
    <MobileHeader eyebrow="SolarScout" title="Leads" subtitle="Fast outcome updates for the field." />

    <section class="page-surface p-4">
      <p class="field-label">Current context</p>
      <p class="mt-1 text-lg font-semibold text-slate-900">{{ searchContextStore.contextLabel || "Choose a location" }}</p>
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
      <LeadCard
        v-for="lead in tabbedLeads"
        :key="lead.id"
        :lead="lead"
        :selected="selectedIds.has(lead.propertyId ?? lead.id)"
        @navigate="navigate(lead)"
        @toggle="toggleLead(lead)"
        @open="openLead(lead)"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import type { LeadOutcome } from "@solar/contracts";
import { useLeadStore } from "../stores/lead.store";
import LeadCard from "../components/LeadCard.vue";
import MobileHeader from "../components/MobileHeader.vue";
import LoadingCard from "../components/LoadingCard.vue";
import { useLeadActions } from "../composables/useLeadActions";
import { useSearchContextStore } from "../stores/search-context.store";
import { useHuntStore } from "../stores/hunt.store";

const router = useRouter();
const leadStore = useLeadStore();
const hunt = useHuntStore();
const searchContextStore = useSearchContextStore();
const { filteredLeads, loading, summary } = storeToRefs(leadStore);
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
const tabbedLeads = computed(() => filteredLeads.value.filter((lead) => matchesTab(lead, activeTab.value)));

onMounted(async () => {
  if (leadStore.leads.length === 0) {
    await leadStore.loadTopLeads();
  }
});

watch(
  () => searchContextStore.context,
  () => {
    void leadStore.loadTopLeads();
  },
  { deep: true },
);

const leadCountLabel = computed(
  () => `${tabbedLeads.value.length} leads · ${summary.value?.whaleCandidates ?? 0} whales · ${summary.value?.revisits ?? 0} revisits`,
);

function navigate(lead: { propertyId?: string | null; address: string }) {
  const fullLead = leadStore.leadById(lead.propertyId ?? encodeURIComponent(lead.address));
  if (fullLead?.latitude != null && fullLead.longitude != null) {
    openDirections(fullLead.latitude, fullLead.longitude);
    return;
  }
  router.push(`/properties/${lead.propertyId ?? encodeURIComponent(lead.address)}`);
}

function openLead(lead: { propertyId?: string | null; address: string }) {
  navigate(lead);
}

async function setOutcome(lead: { propertyId?: string | null; address: string }, outcome: LeadOutcome["outcome"]) {
  await updateOutcome(lead.propertyId ?? encodeURIComponent(lead.address), outcome);
  await leadStore.loadTopLeads();
}

function toggleLead(lead: { propertyId?: string | null; address: string }) {
  hunt.selectLead(lead.propertyId ?? encodeURIComponent(lead.address));
}

function matchesTab(
  lead: { outcome: string },
  tab: (typeof tabs)[number]["key"],
) {
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
