<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
    <div class="mx-auto grid max-w-md grid-cols-4 gap-1.5">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="item.route"
        class="touch-target flex min-w-0 flex-col items-center justify-center rounded-2xl border px-1 py-2 text-[10px] font-medium tracking-[0.06em] transition"
        :class="isActive(item.route) ? 'border-cyan-200 bg-cyan-50 text-slate-950 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-700'"
      >
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { PlatformRole, PLATFORM_MODULE_REGISTRY, type PlatformModule } from "@solar/contracts";
import { useUserStore } from "../stores/user.store";

const route = useRoute();
const user = useUserStore();

const items = computed(() => {
  const modules = new Map(PLATFORM_MODULE_REGISTRY.filter((definition) => user.hasModule(definition.id)).map((definition) => [definition.id, definition]));
  let ids: PlatformModule[];
  if (user.roles.includes(PlatformRole.CLOSER)) {
    ids = ["APPOINTMENTS", "FOLLOW_UPS", "LEADS", "MORE"];
  } else if (user.hasModule("TODAY")) {
    ids = ["TODAY", "APPOINTMENTS", "FOLLOW_UPS", "MORE"];
  } else {
    ids = ["HOME", "FOLLOW_UPS", "LEADS", "MORE"];
  }
  return ids.map((id) => modules.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
});

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>
