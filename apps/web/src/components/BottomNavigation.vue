<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
    <div class="mx-auto grid max-w-md grid-cols-5 gap-2">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="touch-target flex flex-col items-center justify-center rounded-2xl border px-2 py-2 text-[11px] font-semibold tracking-[0.08em] transition"
        :class="isActive(item.to) ? 'border-primary-300 bg-primary-50 text-primary-600 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-500'"
      >
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const items = [
  { to: "/today", label: "Today" },
  { to: "/hunt", label: "Hunt" },
  { to: "/market", label: "Market" },
  { to: "/route", label: "Route" },
  { to: "/leads", label: "Leads" },
];

const isActive = (to: string) => computed(() => route.path === to).value;
</script>
