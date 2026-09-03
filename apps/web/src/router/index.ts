import { createRouter, createWebHistory } from "vue-router";
import type { PlatformFeatureFlag, PlatformModule, PlatformPermission } from "@solar/contracts";
import { useUserStore } from "../stores/user.store";

declare module "vue-router" {
  interface RouteMeta {
    module?: PlatformModule;
    permission?: PlatformPermission;
    anyPermission?: PlatformPermission[];
    feature?: PlatformFeatureFlag;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "root", component: () => import("../pages/Home.vue") },
    { path: "/invite", name: "invite", component: () => import("../pages/InviteAccept.vue") },
    { path: "/home", name: "home", component: () => import("../pages/Home.vue"), meta: { module: "HOME" } },
    { path: "/today", name: "legacy-today", component: () => import("../pages/Home.vue") },
    { path: "/appointments", name: "appointments", component: () => import("../pages/Appointments.vue"), meta: { module: "APPOINTMENTS" } },
    { path: "/follow-ups", name: "follow-ups", component: () => import("../pages/FollowUps.vue"), meta: { module: "FOLLOW_UPS" } },
    { path: "/operations", name: "operations", component: () => import("../pages/Operations.vue"), meta: { module: "OPERATIONS" } },
    { path: "/leads/new", name: "lead-new", component: () => import("../pages/LeadCapture.vue"), meta: { module: "LEADS", permission: "lead:create" } },
    { path: "/leads/:id/schedule", name: "lead-schedule", component: () => import("../pages/LeadSchedule.vue"), props: true, meta: { module: "LEADS", permission: "appointment:create" } },
    { path: "/leads/:id", name: "lead-detail", component: () => import("../pages/LeadDetail.vue"), props: true, meta: { module: "LEADS" } },
    { path: "/leads", name: "leads", component: () => import("../pages/FieldLeads.vue"), meta: { module: "LEADS" } },
    { path: "/schedule", name: "schedule", component: () => import("../pages/Schedule.vue"), meta: { module: "SCHEDULE" } },
    { path: "/map", name: "map", component: () => import("../pages/ManagerMap.vue"), meta: { module: "MAP" } },
    { path: "/team", name: "team", component: () => import("../pages/Team.vue"), meta: { module: "TEAM" } },
    { path: "/reports", name: "reports", component: () => import("../pages/Reports.vue"), meta: { module: "REPORTS" } },
    { path: "/insights", name: "insights", component: () => import("../pages/Insights.vue"), meta: { module: "INSIGHTS" } },
    { path: "/more", name: "more", component: () => import("../pages/More.vue"), meta: { module: "MORE" } },
    { path: "/overview", name: "overview", component: () => import("../pages/Overview.vue"), meta: { module: "OVERVIEW" } },
    { path: "/system", name: "system", component: () => import("../pages/System.vue"), meta: { module: "SYSTEM" } },
    { path: "/labs", name: "labs", component: () => import("../pages/Labs.vue"), meta: { module: "LABS" } },
    { path: "/labs/lead-finder/scanning", name: "lead-scanning", component: () => import("../pages/LeadScanning.vue"), meta: { module: "LEAD_FINDER" } },
    { path: "/labs/lead-finder", name: "lead-finder", component: () => import("../pages/Hunt.vue"), meta: { module: "LEAD_FINDER" } },
    { path: "/labs/hood-navigator", name: "hood-navigator", component: () => import("../pages/Map.vue"), meta: { module: "HOOD_NAVIGATOR" } },
    { path: "/labs/installation-signals", name: "installation-signals", component: () => import("../pages/Market.vue"), meta: { module: "INSTALLATION_SIGNALS" } },
    { path: "/labs/route", name: "route-experiment", component: () => import("../pages/Route.vue"), meta: { module: "ROUTE_EXPERIMENT" } },
    { path: "/properties/:id", name: "property-detail", component: () => import("../pages/PropertyDetail.vue"), props: true, meta: { module: "LEAD_FINDER" } },

    // Compatibility links from the retired global navigation.
    { path: "/discover", redirect: "/labs/lead-finder" },
    { path: "/hunt", redirect: "/labs/lead-finder" },
    { path: "/market", redirect: "/labs/installation-signals" },
    { path: "/route", redirect: "/labs/route" },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach((to) => {
  const user = useUserStore();
  if (user.isHydrating || (user.authRequired && !user.isAuthenticated)) {
    return true;
  }
  if (to.path === "/" || to.name === "legacy-today") {
    return { path: user.primaryLandingPath };
  }
  if (to.meta.module && !user.hasModule(to.meta.module)) {
    return { path: user.primaryLandingPath };
  }
  if (to.meta.permission && !user.can(to.meta.permission)) {
    return { path: user.primaryLandingPath };
  }
  if (to.meta.anyPermission && !to.meta.anyPermission.some((permission) => user.can(permission))) {
    return { path: user.primaryLandingPath };
  }
  if (to.meta.feature && !user.hasFeature(to.meta.feature)) {
    return { path: user.primaryLandingPath };
  }
  return true;
});

export default router;
