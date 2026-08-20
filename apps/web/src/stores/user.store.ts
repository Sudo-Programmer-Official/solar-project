import { defineStore } from "pinia";
import { ref } from "vue";

export const useUserStore = defineStore("user", () => {
  const repName = ref("");
  const territoryName = ref("");
  const currentView = ref<"today" | "discover" | "map" | "leads">("today");

  return { repName, territoryName, currentView };
});
