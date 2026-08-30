<template>
  <div v-if="user.isHydrating" class="flex min-h-screen items-center justify-center bg-slate-950 text-sm font-semibold text-white">
    Restoring your session…
  </div>
  <Login v-else-if="user.authRequired && !user.isAuthenticated && !isInviteRoute" />
  <router-view v-else-if="isInviteRoute" />
  <ChangePassword v-else-if="user.mustChangePassword" />
  <div v-else class="app-shell">
    <header class="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#050816] px-4 pb-2 pt-[env(safe-area-inset-top)] text-white sm:px-6">
      <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <BlackOpsMark size="sm" inverted />
        <div class="min-w-0">
          <RouterLink class="block truncate text-[12px] font-bold tracking-[0.19em] text-white" to="/">BLACKOPS FIELD</RouterLink>
          <p class="mt-0.5 text-[11px] font-medium tracking-[0.04em] text-slate-400">{{ workspaceLabel }}</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <details class="relative hidden lg:block">
          <summary class="flex min-h-touch cursor-pointer list-none items-center gap-2 rounded-2xl px-2 text-sm font-semibold marker:hidden hover:bg-white/10"><span class="hidden text-white/70 sm:inline">{{ user.displayName }}</span><span class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-400 text-sm font-bold text-slate-950">{{ user.displayName.charAt(0).toUpperCase() }}</span></summary>
          <div class="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl"><p class="text-sm font-semibold">{{ user.displayName }}</p><p class="mt-1 text-xs text-slate-500">{{ user.roleLabel }}</p><button class="mt-3 min-h-touch w-full rounded-xl bg-slate-950 px-3 py-2 text-left text-sm font-semibold text-white" type="button" @click="user.logout">Log out</button></div>
        </details>
        <button
          ref="hamburgerRef"
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-transparent text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 lg:hidden"
          type="button"
          aria-label="Open navigation"
          aria-controls="mobile-navigation-drawer"
          :aria-expanded="mobileNavigationOpen"
          @click="openMobileNavigation"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>
    <div :inert="mobileNavigationOpen">
      <div class="lg:grid" :class="shellPreferences.sidebarCollapsed ? 'lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'">
        <DesktopNavigation
          :collapsed="shellPreferences.sidebarCollapsed"
          :locked="shellPreferences.sidebarLocked"
          @toggle-collapse="shellPreferences.toggleSidebarCollapsed"
          @toggle-lock="shellPreferences.toggleSidebarLocked"
        />
        <div class="min-w-0">
          <div v-if="user.hasModule('LABS')" class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
            <GlobalSearchBar />
          </div>
          <div v-if="user.hasModule('LABS') && showScanProgress" class="border-b border-slate-200 bg-white">
            <div class="mx-auto max-w-6xl px-4 pt-3">
              <ScanProgressPanel
                :location-label="scanLocationLabel"
                :stage="hunt.scanStatus"
                :is-scanning="hunt.isScanning"
                :is-complete="hunt.isComplete"
                :discovered-count="hunt.discoveredCount"
                :strong-lead-count="hunt.strongLeadCount"
                :solar-analyzed-count="hunt.solarAnalyzedCount"
                :solar-analysis-target="hunt.solarAnalysisTarget"
                :error="scanError"
                @retry="retryScan"
              />
            </div>
          </div>
          <router-view />
        </div>
      </div>
      <BottomNavigation />
    </div>

    <Transition name="shell-backdrop">
      <button
        v-if="mobileNavigationOpen"
        class="fixed inset-0 z-[70] cursor-default bg-slate-950/55 backdrop-blur-[1px] lg:hidden"
        type="button"
        aria-label="Close navigation"
        @click="closeMobileNavigation"
      />
    </Transition>
    <Transition name="shell-drawer">
      <div
        v-if="mobileNavigationOpen"
        id="mobile-navigation-drawer"
        ref="mobileNavigationRef"
        class="fixed inset-y-0 left-0 z-[80] w-[min(86vw,320px)] max-w-[320px] shadow-[18px_0_45px_rgba(2,8,23,0.24)] lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
      >
        <DesktopNavigation mode="drawer" @close="closeMobileNavigation" @navigate="closeMobileNavigation" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PlatformRole } from "@solar/contracts";
import BottomNavigation from "./components/BottomNavigation.vue";
import BlackOpsMark from "./components/BlackOpsMark.vue";
import DesktopNavigation from "./components/DesktopNavigation.vue";
import GlobalSearchBar from "./components/GlobalSearchBar.vue";
import ScanProgressPanel from "./components/ScanProgressPanel.vue";
import Login from "./pages/Login.vue";
import ChangePassword from "./pages/ChangePassword.vue";
import { useHuntStore } from "./stores/hunt.store";
import { useSearchContextStore } from "./stores/search-context.store";
import { useShellPreferencesStore } from "./stores/shell-preferences.store";
import { useUserStore } from "./stores/user.store";

const hunt = useHuntStore();
const searchStore = useSearchContextStore();
const shellPreferences = useShellPreferencesStore();
const user = useUserStore();
const route = useRoute();
const router = useRouter();
const isInviteRoute = computed(() => route.path === "/invite");
const workspaceLabel = computed(() => {
  const commandRoles: PlatformRole[] = [PlatformRole.SUPER_ADMIN, PlatformRole.ADMIN, PlatformRole.MANAGER];
  return user.roles.some((role) => commandRoles.includes(role)) ? "Command Center" : "Field";
});
const mobileNavigationOpen = ref(false);
const hamburgerRef = ref<HTMLButtonElement | null>(null);
const mobileNavigationRef = ref<HTMLElement | null>(null);
const previousBodyOverflow = ref("");

if (route.path === "/invite") {
  user.isHydrating = false;
} else {
  void user.hydrate();
}

watch([() => user.isHydrating, () => user.isAuthenticated], ([hydrating, authenticated]) => {
  if (hydrating || !authenticated || isInviteRoute.value) return;
  if (route.path === "/" || route.name === "legacy-today" || (route.meta.module && !user.hasModule(route.meta.module))) {
    void router.replace(user.primaryLandingPath);
  }
});

watch(mobileNavigationOpen, async (isOpen) => {
  if (isOpen) {
    previousBodyOverflow.value = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    await nextTick();
    mobileNavigationRef.value?.querySelector<HTMLElement>("button:not([disabled]), a[href]")?.focus();
    return;
  }

  document.body.style.overflow = previousBodyOverflow.value;
  previousBodyOverflow.value = "";
  await nextTick();
  hamburgerRef.value?.focus();
});

watch(() => route.path, () => {
  if (mobileNavigationOpen.value) closeMobileNavigation();
});

onMounted(() => {
  document.addEventListener("keydown", handleShellKeydown);
  window.addEventListener("resize", closeDrawerOnDesktopResize);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleShellKeydown);
  window.removeEventListener("resize", closeDrawerOnDesktopResize);
  document.body.style.overflow = previousBodyOverflow.value;
});

function openMobileNavigation(): void {
  mobileNavigationOpen.value = true;
}

function closeMobileNavigation(): void {
  mobileNavigationOpen.value = false;
}

function closeDrawerOnDesktopResize(): void {
  if (window.innerWidth >= 1024 && mobileNavigationOpen.value) {
    closeMobileNavigation();
  }
}

function handleShellKeydown(event: KeyboardEvent): void {
  if (!mobileNavigationOpen.value) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeMobileNavigation();
    return;
  }

  if (event.key !== "Tab") return;
  const drawer = mobileNavigationRef.value;
  if (!drawer) return;
  const focusable = Array.from(drawer.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!drawer.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

const showScanProgress = computed(() => Boolean(hunt.scanStatus || hunt.isScanning || hunt.error));
const scanLocationLabel = computed(() => searchStore.contextLabel || "selected location");
const scanError = computed(() => {
  if (hunt.scan?.error) return formatDiscoveryScanError(hunt.scan.error);
  if (hunt.error) return hunt.error;
  if (hunt.scanStatus === "FAILED" || hunt.scanStatus === "DISCOVERY_FAILED") {
    return "We couldn't finish this scan.";
  }
  return null;
});

async function retryScan() {
  if (hunt.lastLatitude == null || hunt.lastLongitude == null) {
    return;
  }
  await hunt.runScan({ latitude: hunt.lastLatitude, longitude: hunt.lastLongitude }, {
    radiusMiles: searchStore.radiusMiles,
    filters: searchStore.filters,
  });
}

function formatDiscoveryScanError(error: { code: string; message: string } | null): string | null {
  if (!error) {
    return null;
  }
  switch (error.code) {
    case "DATA_COVERAGE_UNAVAILABLE":
      return "No residential data is available for this area yet.";
    case "PROVIDER_TEMPORARY_FAILURE":
      return "One of our data providers is temporarily unavailable.";
    case "PROVIDER_TIMEOUT":
    case "PROPERTY_DISCOVERY_TIMEOUT":
      return "Property discovery took too long, so the available leads are shown.";
    case "DATABASE_UNAVAILABLE":
    case "DATABASE_SCHEMA_MISMATCH":
    case "DATABASE_WRITE_FAILED":
    case "PERSISTENCE_FAILED":
      return "We couldn't access lead data right now.";
    case "GEOCODING_REQUEST_FAILED":
      return "We couldn't resolve that location.";
    case "GOOGLE_SOLAR_REQUEST_FAILED":
      return "Solar enrichment could not complete.";
    case "DISCOVERY_PROVIDER_FAILED":
      return "Residential data discovery could not complete.";
    default:
      return error.message;
  }
}
</script>

<style scoped>
.shell-backdrop-enter-active,
.shell-backdrop-leave-active {
  transition: opacity 180ms ease;
}

.shell-backdrop-enter-from,
.shell-backdrop-leave-to {
  opacity: 0;
}

.shell-drawer-enter-active,
.shell-drawer-leave-active {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-drawer-enter-from,
.shell-drawer-leave-to {
  transform: translateX(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .shell-backdrop-enter-active,
  .shell-backdrop-leave-active,
  .shell-drawer-enter-active,
  .shell-drawer-leave-active {
    transition-duration: 1ms;
  }
}
</style>
