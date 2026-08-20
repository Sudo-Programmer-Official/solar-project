<template>
  <article class="page-surface overflow-hidden shadow-card">
    <div class="grid md:grid-cols-[35%_65%]">
      <div class="aspect-[16/9] border-b border-slate-200 bg-slate-100 md:border-b-0 md:border-r">
        <div class="h-full w-full animate-pulse bg-[linear-gradient(90deg,rgba(241,245,249,1),rgba(226,232,240,1),rgba(241,245,249,1))]" />
      </div>
      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-3">
            <div class="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
            <div class="h-5 w-48 animate-pulse rounded-full bg-slate-100" />
            <div class="h-4 w-32 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div v-for="item in 4" :key="item" class="rounded-2xl bg-slate-50 p-3">
            <div class="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
            <div class="mt-3 h-5 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <div class="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div class="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div class="h-12 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  </article>
</template>
