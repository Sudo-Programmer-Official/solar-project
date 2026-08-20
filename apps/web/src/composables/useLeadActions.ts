import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl } from "../services/imagery";
import { ElNotification } from "element-plus";
import type { LeadOutcome } from "@solar/contracts";
import { useLeadStore } from "../stores/lead.store";

export function useLeadActions() {
  const leadStore = useLeadStore();

  const updateOutcome = async (propertyId: string, outcome: LeadOutcome["outcome"], notes: string | null = null) => {
    const updated = await leadStore.refreshLeadOutcome(propertyId, outcome, notes);
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
