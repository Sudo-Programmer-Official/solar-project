import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  analyzeProperty,
  getProperty,
  getTopLeads,
  updateLeadOutcome,
  type PropertyDetailPayload,
} from "../services/api";
import type { LeadOutcome, TodayDashboard, TodayLeadCard } from "@solar/contracts";
import type { SearchFilters } from "./search-context.store";
import { useSearchContextStore } from "./search-context.store";

export const useLeadStore = defineStore("leads", () => {
  const dashboard = ref<TodayDashboard | null>(null);
  const leadDetail = ref<PropertyDetailPayload | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const activeFilter = ref<"all" | "whales" | "high_priority" | "revisit" | "needs_bill">("all");
  const searchStore = useSearchContextStore();

  const leads = computed(() => dashboard.value?.leads ?? []);
  const summary = computed(() => dashboard.value?.summary);
  const filteredLeads = computed(() => {
    return leads.value.filter((lead) => matchesGlobalFilters(lead, searchStore.filters));
  });

  const loadTopLeads = async () => {
    loading.value = true;
    error.value = null;
    try {
      dashboard.value = (await getTopLeads()) ?? emptyDashboard();
      return dashboard.value;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unable to load leads";
      dashboard.value = emptyDashboard();
      throw cause;
    } finally {
      loading.value = false;
    }
  };

  const loadLead = async (id: string) => {
    loading.value = true;
    error.value = null;
    leadDetail.value = null;
    try {
      leadDetail.value = await getProperty(id);
      return leadDetail.value;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Unable to load property";
      throw cause;
    } finally {
      loading.value = false;
    }
  };

  const analyzeLead = async (address: string) => analyzeProperty(address);

  const setFilter = (filter: typeof activeFilter.value) => {
    activeFilter.value = filter;
  };

  const refreshLeadOutcome = async (propertyId: string, outcome: LeadOutcome["outcome"], notes: string | null = null) => {
    const updated = await updateLeadOutcome(propertyId, outcome, notes);
    if (dashboard.value) {
      dashboard.value = {
        ...dashboard.value,
        leads: dashboard.value.leads.map((lead) => {
          if (lead.propertyId !== propertyId) return lead;
          return { ...lead, outcome: updated?.outcome ?? outcome };
        }),
      };
    }
    return updated;
  };

  const leadById = computed(() => {
    const map = new Map<string, TodayLeadCard>();
    for (const lead of leads.value) {
      if (lead.propertyId) map.set(lead.propertyId, lead);
      map.set(lead.id, lead);
    }
    return (id: string) => map.get(id) ?? null;
  });

  return {
    dashboard,
    leadDetail,
    loading,
    error,
    activeFilter,
    leads,
    summary,
    filteredLeads,
    loadTopLeads,
    loadLead,
    analyzeLead,
    setFilter,
    refreshLeadOutcome,
    leadById,
  };
});

function emptyDashboard(): TodayDashboard {
  return {
    territory: "",
    summary: {
      priorityLeads: 0,
      whaleCandidates: 0,
      revisits: 0,
      needsBill: 0,
      total: 0,
    },
    filters: [],
    leads: [],
  };
}

function matchesGlobalFilters(
  lead: TodayLeadCard,
  filters: SearchFilters,
): boolean {
  if (filters.whaleCandidates && lead.whaleScore < 60) {
    return false;
  }
  if (filters.highPriority && lead.opportunityScore < 70) {
    return false;
  }
  if (filters.revisit && lead.outcome !== "NOT_HOME" && lead.outcome !== "BILL_REQUESTED") {
    return false;
  }
  if (filters.recentRoofPermit && !lead.signals.some((signal) => signal.toLowerCase().includes("permit"))) {
    return false;
  }
  if (filters.noDetectedSolar && lead.signals.some((signal) => signal.toLowerCase().includes("existing solar"))) {
    return false;
  }
  if (filters.largeProperty && !lead.signals.some((signal) => signal.toLowerCase().includes("large"))) {
    return false;
  }
  if (filters.highValueArea && !lead.signals.some((signal) => signal.toLowerCase().includes("value area"))) {
    return false;
  }
  if (filters.minimumSystemKw != null && (lead.maxRoofSolarCapacityKw ?? lead.maxSystemKw ?? 0) < filters.minimumSystemKw) {
    return false;
  }
  return true;
}
