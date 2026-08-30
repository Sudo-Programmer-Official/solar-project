<template>
  <span
    class="inline-flex shrink-0 items-center justify-center border"
    :class="[
      size === 'sm' ? 'h-9 w-9 rounded-[10px]' : 'h-11 w-11 rounded-[13px]',
      inverted ? 'border-white/15 bg-white/10 text-cyan-200' : 'border-slate-200 bg-slate-950 text-cyan-300',
    ]"
    aria-hidden="true"
  >
    <svg class="h-[68%] w-[68%]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.5 7.5H38.5V33L24 41L9.5 33V7.5Z" stroke="currentColor" stroke-width="2.25" />
      <text x="24" y="28" text-anchor="middle" fill="currentColor" font-size="14" font-weight="800" letter-spacing="-1" font-family="Arial, sans-serif">BO</text>
    </svg>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: "sm" | "md"; inverted?: boolean }>(), {
  size: "md",
  inverted: false,
});
</script>
