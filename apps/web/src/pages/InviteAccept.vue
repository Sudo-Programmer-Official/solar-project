<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
    <section class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <p class="field-label text-primary-700">TEAM INVITATION</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-900">Set your password</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500">Choose a password with at least 12 characters to activate your account.</p>
      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="field-label">Password</span>
          <input v-model="password" class="mt-2 min-h-touch w-full rounded-2xl border border-slate-200 px-3 text-sm" autocomplete="new-password" minlength="12" type="password" required />
        </label>
        <label class="block">
          <span class="field-label">Confirm password</span>
          <input v-model="confirmation" class="mt-2 min-h-touch w-full rounded-2xl border border-slate-200 px-3 text-sm" autocomplete="new-password" minlength="12" type="password" required />
        </label>
        <p v-if="error" class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ error }}</p>
        <p v-if="complete" class="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Password set. You can now sign in.</p>
        <button class="min-h-touch w-full rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting || complete" type="submit">
          {{ submitting ? "Saving…" : "Set password" }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { acceptInvite } from "../services/api";

const route = useRoute();
const token = computed(() => typeof route.query.token === "string" ? route.query.token : "");
const password = ref("");
const confirmation = ref("");
const submitting = ref(false);
const complete = ref(false);
const error = ref("");

async function submit() {
  error.value = "";
  if (!token.value) {
    error.value = "This invitation link is missing its token.";
    return;
  }
  if (password.value !== confirmation.value) {
    error.value = "Passwords do not match.";
    return;
  }
  submitting.value = true;
  try {
    await acceptInvite(token.value, password.value);
    complete.value = true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to accept the invitation.";
  } finally {
    submitting.value = false;
  }
}
</script>
