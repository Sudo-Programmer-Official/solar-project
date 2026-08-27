<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="SYSTEM" title="Access control" subtitle="Protected system capabilities for Super Admins. Role changes remain server-authoritative.">
      <template #action><span class="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Protected</span></template>
    </MobileHeader>
    <section class="page-surface p-4"><p class="field-label">CURRENT IDENTITY</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ user.displayName }}</h2><p class="mt-1 text-sm text-slate-500">{{ user.roleLabel }}</p><div class="mt-4 flex flex-wrap gap-2"><span v-for="permission in permissions" :key="permission" class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{{ permission }}</span></div></section>
    <section class="page-surface mt-4 p-4"><p class="field-label">MODULE AUTHORITY</p><div class="mt-3 flex flex-wrap gap-2"><span v-for="module in user.modules" :key="module" class="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">{{ module }}</span></div><p class="mt-4 text-sm text-slate-500">Labs and system visibility are resolved from the authenticated server response.</p></section>
  </main>
</template>

<script setup lang="ts">
import MobileHeader from "../components/MobileHeader.vue";
import { useUserStore } from "../stores/user.store";
const user = useUserStore();
const permissions = user.permissions as readonly string[];
</script>
