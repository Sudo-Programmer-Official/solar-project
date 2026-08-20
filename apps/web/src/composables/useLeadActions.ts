import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl } from "../services/imagery";
import { ElNotification } from "element-plus";
import type { LeadOutcome, LeadOutcomeCard } from "@solar/contracts";
import { useLeadOutcomeStore } from "../stores/lead-outcome.store";

export function useLeadActions() {
  const leadOutcomeStore = useLeadOutcomeStore();

  const updateOutcome = async (
    propertyId: string,
    outcome: LeadOutcome["outcome"],
    lead: LeadOutcomeCard | null = null,
    notes: string | null = null,
  ) => {
    const updated = await leadOutcomeStore.setOutcome(propertyId, outcome, {
      lead,
      notes,
    });
    ElNotification({
      title: "Lead updated",
      message: `Outcome saved as ${outcome.replaceAll("_", " ").toLowerCase()}.`,
      type: "success",
      duration: 1800,
    });
    return updated;
  };

  const openDirections = (latitude?: number | null, longitude?: number | null) => {
    if (latitude == null || longitude == null) {
      return;
    }
    window.open(buildGoogleMapsDirectionsUrl(latitude, longitude), "_blank", "noopener,noreferrer");
  };

  const openMapsSearch = (latitude?: number | null, longitude?: number | null) => {
    if (latitude == null || longitude == null) {
      return;
    }
    window.open(buildGoogleMapsSearchUrl(latitude, longitude), "_blank", "noopener,noreferrer");
  };

  return { updateOutcome, openDirections, openMapsSearch };
}
