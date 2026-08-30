<template>
  <main class="blackops-login relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050816] px-4 py-6 sm:px-6 sm:py-8">
    <div class="blackops-login-grid pointer-events-none absolute inset-0" aria-hidden="true" />
    <div class="blackops-login-glow pointer-events-none absolute left-1/2 top-[42%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full" aria-hidden="true" />

    <section class="relative z-10 w-full max-w-[460px] rounded-[24px] border border-slate-200/80 bg-[#f8fafc] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-8">
      <div class="flex items-center gap-3">
        <BlackOpsMark />
        <div>
          <p class="text-[13px] font-bold tracking-[0.2em] text-slate-950">BLACKOPS FIELD</p>
          <p class="mt-1 text-xs font-medium text-slate-500">Secure team access</p>
        </div>
      </div>

      <div class="mt-10">
        <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-slate-950">Welcome back</h1>
        <p class="mt-2 text-sm leading-6 text-slate-500">Sign in to your field account.</p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="submit">
        <label class="block">
          <span class="text-sm font-semibold text-slate-700">Email</span>
          <input v-model="email" class="mt-2 min-h-touch w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" autocomplete="email" type="email" required />
        </label>
        <label class="block">
          <span class="text-sm font-semibold text-slate-700">Password</span>
          <span class="relative mt-2 block">
            <input v-model="password" class="min-h-touch w-full rounded-2xl border border-slate-200 bg-white px-3.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 caret-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" autocomplete="current-password" :type="showPassword ? 'text' : 'password'" required />
            <button
              class="absolute right-1.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              type="button"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <svg v-if="showPassword" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M3 3L21 21M10.6 10.6A2 2 0 0 0 13.4 13.4M9.9 4.3A10.7 10.7 0 0 1 12 4c5.2 0 8.7 4 9.8 6a11.8 11.8 0 0 1-3.4 3.8M6.2 6.2C4.4 7.4 3.1 9 2.2 10.5 3.3 12.5 6.8 16.5 12 16.5c1 0 1.9-.1 2.7-.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M2.2 12C3.3 10 6.8 6 12 6s8.7 4 9.8 6c-1.1 2-4.6 6-9.8 6s-8.7-4-9.8-6Z" stroke-linejoin="round" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          </span>
        </label>
        <p v-if="error" class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{{ error }}</p>
        <button class="min-h-touch w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-[#05121d] shadow-[0_10px_24px_rgba(6,182,212,0.2)] transition hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50" :disabled="submitting" type="submit">
          {{ submitting ? "Signing in…" : "Sign in" }}
        </button>
      </form>

      <div class="mt-6 flex items-center gap-2 text-xs font-medium text-slate-500">
        <span class="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
        Secure team access
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import BlackOpsMark from "../components/BlackOpsMark.vue";
import { useUserStore } from "../stores/user.store";

const user = useUserStore();
const router = useRouter();
const email = ref("");
const password = ref("");
const showPassword = ref(false);
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

<style scoped>
.blackops-login-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.028) 1px, transparent 1px);
  background-position: center;
  background-size: 46px 46px;
  -webkit-mask-image: radial-gradient(ellipse at center, black 18%, transparent 78%);
  mask-image: radial-gradient(ellipse at center, black 18%, transparent 78%);
}

.blackops-login-glow {
  background: radial-gradient(circle, rgba(34, 211, 238, 0.11), rgba(34, 211, 238, 0) 68%);
  filter: blur(8px);
}
</style>
