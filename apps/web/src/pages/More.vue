<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="ACCOUNT" title="More" subtitle="Your identity, available modules, and account actions.">
      <template #action><button class="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="button" @click="signOut">Log out</button></template>
    </MobileHeader>
    <section class="page-surface p-4"><p class="field-label">AUTHENTICATED USER</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ user.displayName }}</h2><p class="mt-1 text-sm text-slate-500">{{ user.roleLabel }}</p><p class="mt-3 text-xs text-slate-400">Identity and access are supplied by /auth/me.</p></section>
    <section class="page-surface mt-4 p-4"><p class="field-label">AVAILABLE MODULES</p><div class="mt-3 grid gap-2"><RouterLink v-for="module in availableModules" :key="module.id" :to="module.route" class="flex items-center justify-between rounded-2xl border border-slate-200 p-3"><span class="text-sm font-semibold text-slate-900">{{ module.label }}</span><span class="text-xs text-slate-400">Open →</span></RouterLink></div></section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PLATFORM_MODULE_REGISTRY } from "@solar/contracts";
import { useRouter } from "vue-router";
import MobileHeader from "../components/MobileHeader.vue";
import { useUserStore } from "../stores/user.store";
const user = useUserStore(); const router = useRouter();
const availableModules = computed(() => PLATFORM_MODULE_REGISTRY.filter((module) => user.hasModule(module.id) && module.id !== "MORE"));
async function signOut() { await user.logout(); await router.replace("/"); }
</script>
