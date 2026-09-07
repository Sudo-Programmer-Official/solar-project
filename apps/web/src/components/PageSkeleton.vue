<template>
  <section class="space-y-4" aria-busy="true" aria-label="Loading page content" role="status">
    <span class="sr-only">Loading page content…</span>

    <template v-if="variant === 'today'">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div v-for="item in 6" :key="`today-metric-${item}`" class="page-surface h-28 animate-pulse p-4">
          <div class="h-3 w-20 rounded bg-slate-200" />
          <div class="mt-4 h-7 w-12 rounded bg-slate-200" />
          <div class="mt-3 h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div class="page-surface h-[30rem] animate-pulse p-5">
          <div class="h-3 w-36 rounded bg-slate-200" />
          <div class="mt-3 h-6 w-48 rounded bg-slate-200" />
          <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div v-for="item in 6" :key="`today-slot-${item}`" class="h-32 rounded-2xl bg-slate-100" />
          </div>
        </div>
        <div class="grid gap-4">
          <div v-for="item in 2" :key="`today-aside-${item}`" class="page-surface h-44 animate-pulse p-5">
            <div class="h-3 w-32 rounded bg-slate-200" />
            <div class="mt-4 h-5 w-48 rounded bg-slate-200" />
            <div class="mt-5 h-16 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'metrics'">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="item in 4" :key="`metric-${item}`" class="page-surface h-28 animate-pulse p-4">
          <div class="h-3 w-20 rounded bg-slate-200" />
          <div class="mt-4 h-7 w-14 rounded bg-slate-200" />
          <div class="mt-3 h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div class="page-surface h-48 animate-pulse p-5">
        <div class="h-3 w-36 rounded bg-slate-200" />
        <div class="mt-4 h-5 w-52 rounded bg-slate-200" />
        <div class="mt-5 h-20 rounded-2xl bg-slate-100" />
      </div>
    </template>

    <template v-else-if="variant === 'slots'">
      <div class="page-surface animate-pulse p-4 sm:p-5">
        <div class="h-3 w-32 rounded bg-slate-200" />
        <div class="mt-3 h-6 w-48 rounded bg-slate-200" />
        <div class="mt-5 grid gap-3">
          <div v-for="item in 6" :key="`slot-${item}`" class="h-24 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'team'">
      <div class="grid gap-3">
        <div v-for="item in 4" :key="`team-${item}`" class="page-surface h-32 animate-pulse p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <div class="h-4 w-36 rounded bg-slate-200" />
              <div class="mt-3 h-3 w-52 rounded bg-slate-100" />
            </div>
            <div class="h-8 w-24 rounded-full bg-slate-100" />
          </div>
          <div class="mt-5 h-8 w-full rounded-2xl bg-slate-100" />
        </div>
      </div>
    </template>

    <template v-else-if="variant === 'detail'">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="item in 4" :key="`detail-metric-${item}`" class="page-surface h-24 animate-pulse p-4">
          <div class="h-3 w-20 rounded bg-slate-200" />
          <div class="mt-4 h-4 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div v-for="item in 3" :key="`detail-card-${item}`" class="page-surface h-36 animate-pulse p-5">
        <div class="h-3 w-28 rounded bg-slate-200" />
        <div class="mt-4 h-5 w-56 rounded bg-slate-200" />
        <div class="mt-4 h-3 w-full rounded bg-slate-100" />
        <div class="mt-2 h-3 w-4/5 rounded bg-slate-100" />
      </div>
    </template>

    <template v-else>
      <div class="page-surface animate-pulse p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="h-4 w-32 rounded bg-slate-200" />
          <div class="h-9 w-20 rounded-full bg-slate-100" />
        </div>
        <div class="mt-5 grid gap-3">
          <div v-for="item in rowCount" :key="`row-${item}`" class="h-20 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "today" | "metrics" | "slots" | "team" | "detail" | "rows" | "table";
  rowCount?: number;
}>(), {
  variant: "rows",
  rowCount: 5,
});
</script>
