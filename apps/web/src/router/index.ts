import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/today" },
    { path: "/today", name: "today", component: () => import("../pages/Today.vue") },
    { path: "/discover", redirect: "/hunt" },
    { path: "/hunt", name: "hunt", component: () => import("../pages/Hunt.vue") },
    { path: "/route", name: "route", component: () => import("../pages/Route.vue") },
    { path: "/map", name: "map", component: () => import("../pages/Map.vue") },
    { path: "/leads", name: "leads", component: () => import("../pages/Leads.vue") },
    { path: "/properties/:id", name: "property-detail", component: () => import("../pages/PropertyDetail.vue"), props: true },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
