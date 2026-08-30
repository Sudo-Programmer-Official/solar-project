import { defineStore } from "pinia";
import { ref } from "vue";

const STORAGE_KEY = "blackops-field-shell-preferences";

type StoredShellPreferences = {
  sidebarCollapsed?: boolean;
  sidebarLocked?: boolean;
};

export const useShellPreferencesStore = defineStore("shellPreferences", () => {
  const stored = readStoredPreferences();
  const sidebarCollapsed = ref(stored.sidebarCollapsed ?? false);
  const sidebarLocked = ref(stored.sidebarLocked ?? true);

  function toggleSidebarCollapsed(): void {
    if (sidebarLocked.value) return;
    sidebarCollapsed.value = !sidebarCollapsed.value;
    persist();
  }

  function toggleSidebarLocked(): void {
    sidebarLocked.value = !sidebarLocked.value;
    persist();
  }

  function persist(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sidebarCollapsed: sidebarCollapsed.value,
        sidebarLocked: sidebarLocked.value,
      } satisfies StoredShellPreferences));
    } catch {
      // Storage can be unavailable in private browsing or restricted web views.
    }
  }

  return {
    sidebarCollapsed,
    sidebarLocked,
    toggleSidebarCollapsed,
    toggleSidebarLocked,
  };
});

function readStoredPreferences(): StoredShellPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const candidate = parsed as StoredShellPreferences;
    return {
      ...(typeof candidate.sidebarCollapsed === "boolean" ? { sidebarCollapsed: candidate.sidebarCollapsed } : {}),
      ...(typeof candidate.sidebarLocked === "boolean" ? { sidebarLocked: candidate.sidebarLocked } : {}),
    };
  } catch {
    return {};
  }
}
