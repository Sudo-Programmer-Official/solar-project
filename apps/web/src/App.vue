<template>
  <div class="app-shell">
    <div class="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <GlobalSearchBar />
    </div>
    <router-view />
    <BottomNavigation />
  </div>
</template>

<script setup lang="ts">
import BottomNavigation from "./components/BottomNavigation.vue";
import GlobalSearchBar from "./components/GlobalSearchBar.vue";
</script>
