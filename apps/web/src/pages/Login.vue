<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
    <section class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <p class="field-label text-primary-700">SOLAR OPERATIONS PLATFORM</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
      <p class="mt-2 text-sm leading-6 text-slate-500">Use your team account to access leads, appointments, and reports.</p>
      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="field-label">Email</span>
          <input v-model="email" class="mt-2 min-h-touch w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" autocomplete="email" type="email" required />
        </label>
        <label class="block">
          <span class="field-label">Password</span>
          <input v-model="password" class="mt-2 min-h-touch w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" autocomplete="current-password" type="password" required />
        </label>
        <p v-if="error" class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ error }}</p>
        <button class="min-h-touch w-full rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting" type="submit">
          {{ submitting ? "Signing in…" : "Sign in" }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const router = useRouter();
const email = ref("");
const password = ref("");
const submitting = ref(false);
const error = ref("");

async function submit() {
  submitting.value = true;
  error.value = "";
  try {
    await user.login(email.value, password.value);
    await router.replace(user.primaryLandingPath);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to sign in.";
  } finally {
    submitting.value = false;
  }
}
</script>
