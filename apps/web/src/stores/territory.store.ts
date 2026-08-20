import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getCommandCenter, scanAroundMe } from "../services/api";
import type { DiscoverResponse, NeighborhoodMarket, RevenueCommandCenter, TodayLeadCard } from "@solar/contracts";

export const useTerritoryStore = defineStore("territory", () => {
  const commandCenter = ref<RevenueCommandCenter | null>(null);
  const neighborhoods = ref<NeighborhoodMarket[]>([]);
  const properties = ref<TodayLeadCard[]>([]);
  const discovery = ref<DiscoverResponse | null>(null);
  const radiusMiles = ref(10);
  const loading = ref(false);

  const loadCommandCenter = async () => {
    loading.value = true;
    try {
      commandCenter.value = (await getCommandCenter()) ?? null;
    } finally {
      loading.value = false;
    }
  };

  const loadNeighborhoods = async () => {
    loading.value = true;
    try {
      discovery.value = (await scanAroundMe(radiusMiles.value)) ?? emptyDiscoverResponse(radiusMiles.value);
      neighborhoods.value = discovery.value.neighborhoods;
      properties.value = discovery.value.properties;
      return discovery.value;
    } finally {
      loading.value = false;
    }
  };

  const topTerritory = computed(() => commandCenter.value?.topTerritory ?? "");

  return {
    commandCenter,
    neighborhoods,
    properties,
    discovery,
    radiusMiles,
    loading,
    topTerritory,
    loadCommandCenter,
    loadNeighborhoods,
  };
});

function emptyDiscoverResponse(radiusMiles: number): DiscoverResponse {
  return {
    currentLocation: "",
    radiusMiles,
    neighborhoods: [],
    properties: [],
  };
}
