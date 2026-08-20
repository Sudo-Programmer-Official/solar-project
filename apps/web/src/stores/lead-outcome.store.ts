import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { LeadOutcome, LeadOutcomeCard } from "@solar/contracts";
import { getLeadOutcomes, updateLeadOutcome } from "../services/api";

type OutcomeFilter = "ALL" | "SAVED" | "SKIPPED" | "REVISIT";

interface OutcomeMutation {
  propertyId: string;
  previousOutcome: LeadOutcome["outcome"];
  nextOutcome: LeadOutcome["outcome"];
  previousCard: LeadOutcomeCard | null;
  nextCard: LeadOutcomeCard | null;
}

interface OutcomeMutationInput {
  lead?: LeadOutcomeCard | null;
  notes?: string | null;
}

export const useLeadOutcomeStore = defineStore("lead-outcomes", () => {
  const outcomesByPropertyId = ref<Record<string, LeadOutcomeCard>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastMutation = ref<OutcomeMutation | null>(null);

  const outcomes = computed(() =>
    Object.values(outcomesByPropertyId.value).sort((left, right) => {
      const updatedAtDiff = right.updatedAt.localeCompare(left.updatedAt);
      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }
      return left.address.localeCompare(right.address);
    }),
  );

  const summary = computed(() => {
    const totals = {
      all: outcomes.value.length,
      saved: 0,
      skipped: 0,
      revisit: 0,
    };
    for (const outcome of outcomes.value) {
      if (outcome.outcome === "SAVED") {
        totals.saved += 1;
      } else if (outcome.outcome === "SKIPPED") {
        totals.skipped += 1;
      } else if (outcome.outcome === "REVISIT") {
        totals.revisit += 1;
      }
    }
    return totals;
  });

  async function fetchOutcomes(filter: OutcomeFilter = "ALL") {
    loading.value = true;
    error.value = null;
    try {
      const items = await getLeadOutcomes(filter);
      if (items == null) {
        throw new Error("Couldn't load your leads.");
      }
      replaceOutcomes(items);
      return items;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "Couldn't load your leads.";
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function saveLead(propertyId: string, input: OutcomeMutationInput = {}) {
    return setOutcome(propertyId, "SAVED", input);
  }

  async function skipLead(propertyId: string, input: OutcomeMutationInput = {}) {
    return setOutcome(propertyId, "SKIPPED", input);
  }

  async function markRevisit(propertyId: string, input: OutcomeMutationInput = {}) {
    return setOutcome(propertyId, "REVISIT", input);
  }

  async function undoOutcome() {
    const mutation = lastMutation.value;
    if (!mutation) {
      return null;
    }

    lastMutation.value = null;
    const revertedCard = mutation.previousCard
      ? { ...mutation.previousCard, updatedAt: nowIso(), outcome: mutation.previousOutcome }
      : mutation.nextCard
        ? { ...mutation.nextCard, updatedAt: nowIso(), outcome: mutation.previousOutcome }
        : null;

    if (revertedCard) {
      upsertOutcomeCard(revertedCard);
    }

    try {
      const updated = await updateLeadOutcome(mutation.propertyId, mutation.previousOutcome, null);
      if (updated && revertedCard) {
        upsertOutcomeCard({
          ...revertedCard,
          updatedAt: updated.updatedAt,
          outcome: updated.outcome,
        });
      }
      return updated;
    } catch (cause) {
      const rollbackCard = mutation.nextCard
        ? { ...mutation.nextCard, updatedAt: nowIso(), outcome: mutation.nextOutcome }
        : null;
      if (rollbackCard) {
        upsertOutcomeCard(rollbackCard);
      } else {
        deleteOutcomeCard(mutation.propertyId);
      }
      lastMutation.value = mutation;
      throw cause;
    }
  }

  async function setOutcome(
    propertyId: string,
    nextOutcome: LeadOutcome["outcome"],
    input: OutcomeMutationInput = {},
  ) {
    const existingCard = outcomesByPropertyId.value[propertyId] ?? null;
    const previousOutcome = existingCard?.outcome ?? "NEW";
    const optimisticCard = input.lead
      ? normalizeCard(input.lead, nextOutcome)
      : existingCard
        ? { ...existingCard, outcome: nextOutcome, updatedAt: nowIso() }
        : null;

    const mutation: OutcomeMutation = {
      propertyId,
      previousOutcome,
      nextOutcome,
      previousCard: existingCard,
      nextCard: optimisticCard,
    };

    if (optimisticCard) {
      upsertOutcomeCard(optimisticCard);
    }

    try {
      const updated = await updateLeadOutcome(propertyId, nextOutcome, input.notes ?? null);
      if (optimisticCard) {
        upsertOutcomeCard({
          ...optimisticCard,
          outcome: updated?.outcome ?? nextOutcome,
          updatedAt: updated?.updatedAt ?? optimisticCard.updatedAt,
        });
      } else {
        await fetchOutcomes("ALL");
      }
      lastMutation.value = mutation;
      return updated;
    } catch (cause) {
      if (existingCard) {
        upsertOutcomeCard(existingCard);
      } else {
        deleteOutcomeCard(propertyId);
      }
      throw cause;
    }
  }

  function replaceOutcomes(items: LeadOutcomeCard[]) {
    const next: Record<string, LeadOutcomeCard> = {};
    for (const item of items) {
      const propertyId = item.propertyId ?? item.id;
      next[propertyId] = normalizeCard({ ...item, propertyId }, item.outcome);
    }
    outcomesByPropertyId.value = next;
  }

  function upsertOutcomeCard(card: LeadOutcomeCard) {
    const propertyId = card.propertyId ?? card.id;
    outcomesByPropertyId.value = {
      ...outcomesByPropertyId.value,
      [propertyId]: normalizeCard({ ...card, propertyId }, card.outcome),
    };
  }

  function deleteOutcomeCard(propertyId: string) {
    if (!(propertyId in outcomesByPropertyId.value)) {
      return;
    }
    const next = { ...outcomesByPropertyId.value };
    delete next[propertyId];
    outcomesByPropertyId.value = next;
  }

  function normalizeCard(card: LeadOutcomeCard, outcome: LeadOutcome["outcome"]): LeadOutcomeCard {
    return {
      ...card,
      outcome,
      propertyId: card.propertyId ?? card.id,
      updatedAt: card.updatedAt ?? nowIso(),
    };
  }

  return {
    outcomesByPropertyId,
    outcomes,
    summary,
    loading,
    error,
    fetchOutcomes,
    setOutcome,
    saveLead,
    skipLead,
    markRevisit,
    undoOutcome,
    upsertOutcomeCard,
    deleteOutcomeCard,
  };
});

function nowIso(): string {
  return new Date().toISOString();
}
