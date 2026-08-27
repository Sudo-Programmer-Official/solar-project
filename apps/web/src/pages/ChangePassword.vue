<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
    <section class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <p class="field-label text-primary-600">FIRST LOGIN</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Set your password</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500">Your temporary password must be replaced before you can use the platform.</p>
      <p v-if="errorMessage" class="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ errorMessage }}</p>
      <form class="mt-5 grid gap-3" @submit.prevent="submit">
        <input v-model="currentPassword" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" type="password" placeholder="Temporary password" autocomplete="current-password" required />
        <input v-model="newPassword" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" type="password" placeholder="New password (12+ characters)" minlength="12" autocomplete="new-password" required />
        <input v-model="confirmPassword" class="min-h-touch rounded-2xl border border-slate-200 px-3 text-sm" type="password" placeholder="Confirm new password" minlength="12" autocomplete="new-password" required />
        <button class="touch-target mt-2 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="saving" type="submit">{{ saving ? "Saving…" : "Set password" }}</button>
      </form>
      <button class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600" type="button" @click="user.logout">Log out</button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const saving = ref(false);
const errorMessage = ref("");

async function submit() {
  errorMessage.value = "";
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = "New passwords do not match.";
    return;
  }
  saving.value = true;
  try {
    await user.changePassword(currentPassword.value, newPassword.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to update your password.";
  } finally {
    saving.value = false;
  }
}
</script>
