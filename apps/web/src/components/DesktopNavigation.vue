<template>
  <aside
    class="border-slate-200 bg-white transition-[width,padding,transform] duration-200 ease-out"
    :class="mode === 'desktop'
      ? ['hidden', 'min-h-[calc(100vh-4rem)]', 'border-r', 'lg:block', collapsed ? 'px-2 py-6' : 'px-4 py-6']
      : ['flex', 'h-full', 'w-full', 'flex-col', 'border-r', 'px-3', 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]', 'pt-[calc(1.25rem+env(safe-area-inset-top))]']"
  >
    <div class="flex items-center justify-between gap-2" :class="collapsed && mode === 'desktop' ? 'flex-col' : ''">
      <p v-if="mode === 'drawer' || !collapsed" class="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-400">WORKSPACE</p>
      <span v-else class="sr-only">Workspace navigation</span>
      <div class="flex items-center gap-1" :class="collapsed && mode === 'desktop' ? 'flex-col' : ''">
        <button
          v-if="mode === 'desktop'"
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          type="button"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="$emit('toggle-collapse')"
        >
          <svg v-if="collapsed" class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M7 4.5 12.5 10 7 15.5M3.5 4.5 9 10l-5.5 5.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="m13 4.5-5.5 5.5 5.5 5.5M16.5 4.5 11 10l5.5 5.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          v-if="mode === 'desktop'"
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-cyan-500"
          :class="locked ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'"
          type="button"
          :aria-label="locked ? 'Unlock sidebar' : 'Lock sidebar'"
          :aria-pressed="locked"
          :title="locked ? 'Unlock sidebar' : 'Lock sidebar'"
          @click="$emit('toggle-lock')"
        >
          <svg v-if="locked" class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <rect x="4.5" y="8.5" width="11" height="8" rx="1.75" />
            <path d="M6.75 8.5V6.75a3.25 3.25 0 0 1 6.5 0V8.5" stroke-linecap="round" />
          </svg>
          <svg v-else class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <rect x="4.5" y="8.5" width="11" height="8" rx="1.75" />
            <path d="M7 8.5V6.75a3.25 3.25 0 0 1 5.95-1.79" stroke-linecap="round" />
          </svg>
          <span class="sr-only">{{ locked ? "Locked" : "Unlocked" }}</span>
        </button>
        <button
          v-else
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          type="button"
          aria-label="Close navigation"
          @click="$emit('close')"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <nav :class="mode === 'drawer' ? 'mt-3 min-h-0 grid content-start gap-2 overflow-y-auto' : 'mt-3 min-h-0 flex-1 grid gap-1 overflow-y-auto'" :aria-label="mode === 'drawer' ? 'Primary navigation' : 'Workspace navigation'">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="item.route"
        class="group flex items-center rounded-2xl text-sm font-medium transition"
        :aria-label="item.label"
        :title="collapsed && mode === 'desktop' ? item.label : undefined"
        :aria-current="isActive(item.route) ? 'page' : undefined"
        @click="$emit('navigate')"
        :class="[
          isActive(item.route) ? 'bg-cyan-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950',
          collapsed && mode === 'desktop' ? 'min-h-touch justify-center px-3 py-2.5' : mode === 'drawer' ? 'min-h-[50px] gap-3 px-4 py-3' : 'min-h-touch gap-3 px-3 py-2.5',
        ]"
      >
        <span v-if="collapsed && mode === 'desktop'" class="inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold" :class="isActive(item.route) ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-600'">{{ item.label.charAt(0) }}</span>
        <span v-else>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div v-if="mode === 'drawer'" class="mt-auto border-t border-slate-200 pt-4">
      <div class="rounded-2xl bg-slate-50 p-3">
        <p class="truncate text-sm font-semibold text-slate-900">{{ user.displayName }}</p>
        <p class="mt-1 truncate text-xs text-slate-500">{{ user.email || "Team account" }}</p>
        <div class="mt-3 grid gap-2">
          <RouterLink
            to="/more"
            class="flex min-h-[48px] items-center rounded-xl px-3 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
            @click="$emit('navigate')"
          >
            Profile
          </RouterLink>
          <button
            class="flex min-h-[48px] w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
            type="button"
            @click="handleLogout"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PlatformRole, PLATFORM_MODULE_REGISTRY } from "@solar/contracts";
import { useUserStore } from "../stores/user.store";

withDefaults(defineProps<{ mode?: "desktop" | "drawer"; collapsed?: boolean; locked?: boolean }>(), {
  mode: "desktop",
  collapsed: false,
  locked: true,
});

const emit = defineEmits<{
  navigate: [];
  close: [];
  "toggle-collapse": [];
  "toggle-lock": [];
}>();

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const items = computed(() => PLATFORM_MODULE_REGISTRY.filter((definition) => {
  if (!user.hasModule(definition.id) || definition.parent || definition.id === "MORE") return false;
  if (definition.id === "HOME" && (user.hasModule("OPERATIONS") || (user.roles.includes(PlatformRole.CLOSER) && !user.roles.includes(PlatformRole.SETTER)))) return false;
  return true;
}));

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

async function handleLogout(): Promise<void> {
  emit("close");
  await user.logout();
  await router.replace("/");
}
</script>
