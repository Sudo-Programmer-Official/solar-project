<template>
  <aside class="hidden border-r border-slate-200 bg-white px-3 py-5 lg:block">
    <p class="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-400">WORKSPACE</p>
    <nav class="mt-3 grid gap-1">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="item.route"
        class="rounded-2xl px-3 py-2.5 text-sm font-medium transition"
        :class="isActive(item.route) ? 'bg-cyan-50 text-slate-950' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { PlatformRole, PLATFORM_MODULE_REGISTRY } from "@solar/contracts";
import { useUserStore } from "../stores/user.store";

const route = useRoute();
const user = useUserStore();
const items = computed(() => PLATFORM_MODULE_REGISTRY.filter((definition) => {
  if (!user.hasModule(definition.id) || definition.parent || definition.id === "MORE") return false;
  if (definition.id === "HOME" && (user.hasModule("OPERATIONS") || (user.roles.includes(PlatformRole.CLOSER) && !user.roles.includes(PlatformRole.SETTER)))) return false;
  return true;
}));

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>
