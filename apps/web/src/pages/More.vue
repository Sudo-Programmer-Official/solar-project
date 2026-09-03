<template>
  <main class="px-4 pb-28">
    <MobileHeader eyebrow="ACCOUNT" title="More" subtitle="Your identity, available modules, and account actions.">
      <template #action><button class="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white" type="button" @click="signOut">Log out</button></template>
    </MobileHeader>
    <section class="page-surface p-4"><p class="field-label">AUTHENTICATED USER</p><h2 class="mt-1 text-lg font-semibold text-slate-900">{{ user.displayName }}</h2><p class="mt-1 text-sm text-slate-500">{{ user.roleLabel }}</p><p class="mt-3 text-xs text-slate-400">Identity and access are supplied by /auth/me.</p></section>
    <section v-if="user.roles.includes(PlatformRole.CLOSER) && user.can('availability:update-own')" class="page-surface mt-4 p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="field-label">FIELD AVAILABILITY</p>
          <p class="mt-1 text-sm font-semibold" :class="user.availabilityStatus === 'UNAVAILABLE' ? 'text-amber-700' : 'text-emerald-700'">● {{ user.availabilityStatus === 'UNAVAILABLE' ? 'Unavailable' : 'Available' }}</p>
          <p class="mt-2 text-xs leading-5 text-slate-500">Unavailable closers stay assigned to existing appointments but are hidden from new assignments.</p>
        </div>
        <button class="touch-target shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold disabled:opacity-50" :class="user.availabilityStatus === 'UNAVAILABLE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'" :disabled="availabilitySaving" type="button" @click="toggleAvailability">{{ availabilitySaving ? 'Saving…' : user.availabilityStatus === 'UNAVAILABLE' ? 'Mark available' : 'Mark unavailable' }}</button>
      </div>
      <p v-if="availabilityMessage" class="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700" role="status">{{ availabilityMessage }}</p>
      <p v-if="availabilityError" class="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{{ availabilityError }}</p>
    </section>
    <section class="page-surface mt-4 p-4"><p class="field-label">AVAILABLE MODULES</p><div class="mt-3 grid gap-2"><RouterLink v-for="module in availableModules" :key="module.id" :to="module.route" class="flex items-center justify-between rounded-2xl border border-slate-200 p-3"><span class="text-sm font-semibold text-slate-900">{{ module.label }}</span><span class="text-xs text-slate-400">Open →</span></RouterLink></div></section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PLATFORM_MODULE_REGISTRY, PlatformRole } from "@solar/contracts";
import { useRouter } from "vue-router";
import MobileHeader from "../components/MobileHeader.vue";
import { updateOwnAvailability } from "../services/api";
import { useUserStore } from "../stores/user.store";
const user = useUserStore(); const router = useRouter();
const availabilitySaving = ref(false);
const availabilityMessage = ref("");
const availabilityError = ref("");
const availableModules = computed(() => PLATFORM_MODULE_REGISTRY.filter((module) => user.hasModule(module.id) && module.id !== "MORE"));
async function toggleAvailability() {
  availabilitySaving.value = true;
  availabilityMessage.value = "";
  availabilityError.value = "";
  const nextStatus = user.availabilityStatus === "UNAVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";
  try {
    const updated = await updateOwnAvailability(nextStatus);
    user.setAvailabilityStatus(updated.availabilityStatus === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE");
    availabilityMessage.value = nextStatus === "AVAILABLE" ? "You are now available for new assignments." : "You are now unavailable for new assignments.";
  } catch (error) {
    availabilityError.value = error instanceof Error ? error.message : "Unable to update your availability.";
  } finally {
    availabilitySaving.value = false;
  }
}
async function signOut() { await user.logout(); await router.replace("/"); }
</script>
