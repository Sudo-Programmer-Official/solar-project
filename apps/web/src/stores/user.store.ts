import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  DEFAULT_PLATFORM_FEATURE_FLAGS,
  primaryPlatformRoute,
  PLATFORM_ROLE_PERMISSIONS,
  PlatformRole,
  resolvePlatformModules,
  type PlatformFeatureFlag,
  type PlatformFeatureFlags,
  type PlatformModule,
  type PlatformPermission,
  type PlatformUserContext,
} from "@solar/contracts";
import {
  changePassword as changePasswordRequest,
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  type PlatformAuthUser,
} from "../services/api";

export const useUserStore = defineStore("user", () => {
  const authRequired = readBooleanEnv("VITE_AUTH_REQUIRED", true);
  const id = ref<string | null>(null);
  const repName = ref("");
  const territoryName = ref("");
  const currentView = ref<"today" | "discover" | "map" | "leads">("today");
  const roles = ref<PlatformUserContext["roles"]>(readConfiguredRoles());
  const role = computed(() => primaryRole(roles.value));
  const displayName = ref(import.meta.env.VITE_DEMO_USER_NAME || "Solar operator");
  const featureFlags = ref<PlatformFeatureFlags>(readFeatureFlags());
  const remotePermissions = ref<readonly PlatformPermission[] | readonly ["*"] | null>(null);
  const remoteModules = ref<readonly PlatformModule[] | null>(null);
  const permissions = computed<readonly PlatformPermission[] | readonly ["*"]>(() => {
    if (remotePermissions.value) return remotePermissions.value;
    if (roles.value.includes(PlatformRole.SUPER_ADMIN)) return ["*"];
    const all = new Set<PlatformPermission>();
    for (const nextRole of roles.value) {
      for (const permission of PLATFORM_ROLE_PERMISSIONS[nextRole]) all.add(permission as PlatformPermission);
    }
    return [...all];
  });
  const modules = computed<readonly PlatformModule[]>(() => remoteModules.value ?? resolvePlatformModules(permissions.value, featureFlags.value));
  const primaryLandingPath = computed(() => primaryPlatformRoute(modules.value));
  const roleLabel = computed(() => roles.value.map((nextRole) => nextRole.replaceAll("_", " ")).join(" · "));
  const teamIds = ref<string[]>([]);
  const isHydrating = ref(true);
  const isAuthenticated = ref(false);
  const mustChangePassword = ref(false);
  const authError = ref("");

  function can(permission: PlatformPermission): boolean {
    const granted = permissions.value as readonly string[];
    if (granted.includes("*")) return true;
    return granted.includes(permission);
  }

  function hasFeature(feature: PlatformFeatureFlag): boolean {
    return featureFlags.value[feature];
  }

  function hasModule(module: PlatformModule): boolean {
    return modules.value.includes(module);
  }

  function setRole(nextRole: PlatformUserContext["roles"][number]): void {
    setRoles([nextRole]);
  }

  function setRoles(nextRoles: readonly PlatformUserContext["roles"][number][]): void {
    roles.value = nextRoles.length > 0 ? [...nextRoles] : [PlatformRole.SETTER];
    remotePermissions.value = null;
    remoteModules.value = null;
    if (!authRequired && typeof window !== "undefined") {
      window.localStorage.setItem("solar-platform-roles", JSON.stringify(roles.value));
    }
  }

  function setFeatureFlags(nextFlags: Partial<PlatformFeatureFlags>): void {
    featureFlags.value = { ...featureFlags.value, ...nextFlags };
  }

  async function hydrate(): Promise<void> {
    isHydrating.value = true;
    authError.value = "";
    const current = await getCurrentUser();
    if (current) {
      applyAuthUser(current);
      isAuthenticated.value = true;
      isHydrating.value = false;
      return;
    }
    if (!authRequired) {
      isAuthenticated.value = true;
      isHydrating.value = false;
      return;
    }
    try {
      const refreshed = await refreshSession();
      applyAuthUser(refreshed);
      isAuthenticated.value = true;
    } catch {
      isAuthenticated.value = !authRequired;
      if (authRequired) authError.value = "Your session has expired. Please sign in again.";
    } finally {
      isHydrating.value = false;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    authError.value = "";
    const authenticated = await loginRequest(email, password);
    applyAuthUser(authenticated);
    isAuthenticated.value = true;
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const authenticated = await changePasswordRequest(currentPassword, newPassword);
    applyAuthUser(authenticated);
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } finally {
      id.value = null;
      mustChangePassword.value = false;
      isAuthenticated.value = !authRequired;
      if (authRequired) {
        roles.value = [PlatformRole.SETTER];
        remotePermissions.value = null;
        remoteModules.value = null;
        teamIds.value = [];
        featureFlags.value = readFeatureFlags();
      }
    }
  }

  function applyAuthUser(user: PlatformAuthUser): void {
    id.value = user.id;
    displayName.value = user.displayName;
    roles.value = user.roles;
    remotePermissions.value = user.permissions;
    teamIds.value = user.teamIds;
    featureFlags.value = user.featureFlags;
    remoteModules.value = Array.isArray(user.modules) ? user.modules : null;
    mustChangePassword.value = user.mustChangePassword;
  }

  return {
    id,
    repName,
    territoryName,
    currentView,
    roles,
    role,
    roleLabel,
    displayName,
    permissions,
    modules,
    primaryLandingPath,
    featureFlags,
    teamIds,
    authRequired,
    isHydrating,
    isAuthenticated,
    mustChangePassword,
    authError,
    can,
    hasFeature,
    hasModule,
    setRole,
    setRoles,
    setFeatureFlags,
    hydrate,
    login,
    changePassword,
    logout,
  };
});

function readConfiguredRoles(): PlatformUserContext["roles"] {
  if (readBooleanEnv("VITE_AUTH_REQUIRED", true)) return [PlatformRole.SETTER];
  const configured = typeof import.meta.env.VITE_DEMO_ROLES === "string" ? import.meta.env.VITE_DEMO_ROLES : undefined;
  const stored = typeof window !== "undefined" ? window.localStorage.getItem("solar-platform-roles") : null;
  let candidates: string[] = [];
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      candidates = Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      candidates = [stored];
    }
  } else {
    candidates = (configured || "SUPER_ADMIN").split(",");
  }
  const configuredRoles = candidates
    .map((candidate) => candidate.trim().toUpperCase())
    .filter((candidate): candidate is PlatformUserContext["roles"][number] => Object.values(PlatformRole).includes(candidate as PlatformRole));
  return configuredRoles.length > 0 ? configuredRoles : [PlatformRole.SUPER_ADMIN];
}

function primaryRole(roles: readonly PlatformUserContext["roles"][number][]): PlatformUserContext["roles"][number] {
  const priority = [PlatformRole.SUPER_ADMIN, PlatformRole.ADMIN, PlatformRole.MANAGER, PlatformRole.CLOSER, PlatformRole.SETTER];
  return priority.find((candidate) => roles.includes(candidate)) ?? PlatformRole.SETTER;
}

function readFeatureFlags(): PlatformFeatureFlags {
  return {
    leadFinderEnabled: readBooleanEnv("VITE_LEAD_FINDER_ENABLED", DEFAULT_PLATFORM_FEATURE_FLAGS.leadFinderEnabled),
    routeOptimizerEnabled: readBooleanEnv("VITE_ROUTE_OPTIMIZER_ENABLED", DEFAULT_PLATFORM_FEATURE_FLAGS.routeOptimizerEnabled),
    installationSignalsEnabled: readBooleanEnv("VITE_INSTALLATION_SIGNALS_ENABLED", DEFAULT_PLATFORM_FEATURE_FLAGS.installationSignalsEnabled),
    aiTerritoryScoreEnabled: readBooleanEnv("VITE_AI_TERRITORY_SCORE_ENABLED", DEFAULT_PLATFORM_FEATURE_FLAGS.aiTerritoryScoreEnabled),
  };
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = import.meta.env[name] as string | undefined;
  return value == null ? fallback : value.toLowerCase() !== "false";
}
