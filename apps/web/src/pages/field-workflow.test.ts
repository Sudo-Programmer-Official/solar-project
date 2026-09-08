import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("field lead capture selects an appointment before saving", async () => {
  const source = await readFile(new URL("./LeadCapture.vue", import.meta.url), "utf8");

  assert.doesNotMatch(source, /approximateMonthlyBill/);
  assert.match(source, /createFieldLead/);
  assert.match(source, /createFieldLeadWithAppointment/);
  assert.match(source, /getFieldOperationalSlots/);
  assert.match(source, /addFieldNote/);
  assert.match(source, /uploadFieldBill/);
  assert.match(source, /APPOINTMENT/);
  assert.match(source, /Save lead & appointment/);
  assert.match(source, /Save lead/);
  assert.match(source, /bg-cyan-700[^\"]*text-white/);
  assert.match(source, /disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100/);
  assert.match(source, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(source, /grid gap-3/);
  assert.match(source, /show-cta="false"/);
  assert.doesNotMatch(source, /Save & schedule|Save without appointment/);
});

test("setter scheduling uses the shared fixed-slot picker", async () => {
  const scheduleSource = await readFile(new URL("./LeadSchedule.vue", import.meta.url), "utf8");
  const pickerSource = await readFile(new URL("../components/OperationalSlotPicker.vue", import.meta.url), "utf8");
  const slotUtilsSource = await readFile(new URL("../utils/operational-slots.ts", import.meta.url), "utf8");

  assert.match(scheduleSource, /OperationalSlotPicker/);
  assert.match(scheduleSource, /createFieldOperationalAppointment/);
  assert.match(pickerSource, /role="tablist"/);
  assert.match(pickerSource, /operational-slot-grid/);
  assert.match(pickerSource, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(pickerSource, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(pickerSource, /min-w-0/);
  assert.match(pickerSource, /overflow-x-auto/);
  assert.match(pickerSource, /w-full min-w-0 max-w-full snap-x gap-2 overflow-x-auto/);
  assert.match(pickerSource, /min-h-\[60px\]/);
  assert.match(pickerSource, /bg-cyan-700[^\"]*text-white/);
  assert.match(pickerSource, /Add to overflow/);
  assert.doesNotMatch(pickerSource, /datetime-local|type="time"|type="date"/);
  assert.match(slotUtilsSource, /operationalSlotStateLabel/);
  assert.match(slotUtilsSource, /Full · Overflow available/);
  assert.doesNotMatch(slotUtilsSource, /1 left|2 left/);
  assert.doesNotMatch(pickerSource, /operationalCapacityLabel/);
});

test("setter schedule defaults to a Today agenda", async () => {
  const source = await readFile(new URL("./Schedule.vue", import.meta.url), "utf8");

  assert.match(source, /TODAY'S AGENDA/);
  assert.match(source, /6 fixed times/);
  assert.match(source, /localDayWindow/);
  assert.match(source, /appointmentsForSlot/);
  assert.doesNotMatch(source, /datetime-local|type="time"|type="date"/);
});

test("field operations does not use the legacy filename-only bill path", async () => {
  const source = await readFile(new URL("./Operations.vue", import.meta.url), "utf8");

  assert.doesNotMatch(source, /addFieldBill|billDraft|storage reference/);
  assert.match(source, /uploadFieldBill/);
  assert.match(source, /type=\"file\"/);
  assert.doesNotMatch(source, /Add closer availability|Publish availability|datetime-local/);
  assert.match(source, /No AVAILABLE closer is free for this time/);
});

test("manager appointments use a responsive row-level assignment board", async () => {
  const source = await readFile(new URL("./Appointments.vue", import.meta.url), "utf8");

  assert.match(source, /Appointment assignment/);
  assert.match(source, /Time/);
  assert.match(source, /Customer/);
  assert.match(source, /City/);
  assert.match(source, /Setter/);
  assert.match(source, /Bill/);
  assert.match(source, /Closer/);
  assert.match(source, /Result/);
  assert.match(source, /getAvailableFieldClosers/);
  assert.match(source, /Assigning…/);
  assert.match(source, /md:hidden/);
  assert.match(source, /Need assignment/);
  assert.match(source, /Upcoming/);
  assert.match(source, /timeFilter/);
  assert.match(source, /downloadFieldBill/);
});

test("manager Today is a canonical six-slot command dashboard", async () => {
  const source = await readFile(new URL("./Today.vue", import.meta.url), "utf8");
  const routerSource = await readFile(new URL("../router/index.ts", import.meta.url), "utf8");

  assert.match(routerSource, /path: "\/today", name: "today", component: \(\) => import\("\.\.\/pages\/Today\.vue"\)/);
  assert.match(source, /getFieldAppointments/);
  assert.match(source, /getFieldOperationalSlots/);
  assert.match(source, /getFieldFollowUps/);
  assert.match(source, /getTeamMembers/);
  assert.match(source, /FIXED_TIMES = \["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"\]/);
  assert.match(source, /assignFieldAppointment/);
  assert.match(source, /NEEDS ATTENTION/);
  assert.match(source, /TEAM TODAY/);
  assert.match(source, /min-h-touch/);
  assert.doesNotMatch(source, /WhaleHunterWorkspace/);
});

test("field routes provide immediate progress, delayed skeletons, and retry feedback", async () => {
  const appSource = await readFile(new URL("../App.vue", import.meta.url), "utf8");
  const skeletonSource = await readFile(new URL("../components/PageSkeleton.vue", import.meta.url), "utf8");
  const delayedLoadingSource = await readFile(new URL("../composables/useDelayedLoading.ts", import.meta.url), "utf8");
  const appointmentsSource = await readFile(new URL("./Appointments.vue", import.meta.url), "utf8");
  const scheduleSource = await readFile(new URL("./Schedule.vue", import.meta.url), "utf8");
  const followUpsSource = await readFile(new URL("./FollowUps.vue", import.meta.url), "utf8");

  assert.match(appSource, /role="progressbar"/);
  assert.match(appSource, /router\.beforeEach/);
  assert.match(appSource, /router\.afterEach/);
  assert.match(appSource, /router\.onError/);
  assert.match(skeletonSource, /variant === 'today'/);
  assert.match(skeletonSource, /variant === 'slots'/);
  assert.match(skeletonSource, /variant === 'team'/);
  assert.match(skeletonSource, /variant === 'detail'/);
  assert.match(delayedLoadingSource, /setTimeout/);
  assert.match(appointmentsSource, /PageSkeleton/);
  assert.match(appointmentsSource, /Assigning…/);
  assert.match(scheduleSource, /variant="slots"/);
  assert.match(followUpsSource, /variant="table"/);
  assert.match(followUpsSource, /Creating lead…/);
});

test("mutations expose shared success and error feedback", async () => {
  const toastSource = await readFile(new URL("../components/FeedbackToast.vue", import.meta.url), "utf8");
  const storeSource = await readFile(new URL("../stores/feedback.store.ts", import.meta.url), "utf8");
  const followUpsSource = await readFile(new URL("./FollowUps.vue", import.meta.url), "utf8");
  const teamSource = await readFile(new URL("./Team.vue", import.meta.url), "utf8");

  assert.match(toastSource, /aria-live="polite"/);
  assert.match(toastSource, /safe-area-inset-bottom/);
  assert.match(storeSource, /setTimeout/);
  assert.match(followUpsSource, /feedback\.success/);
  assert.match(followUpsSource, /feedback\.failure/);
  assert.match(teamSource, /pendingMemberAction/);
  assert.match(teamSource, /Saving…/);
});

test("lead detail exposes audited note edits and canonical activity", async () => {
  const source = await readFile(new URL("./LeadDetail.vue", import.meta.url), "utf8");

  assert.match(source, /updateFieldNote/);
  assert.match(source, /NOTE/);
  assert.match(source, /ACTIVITY HISTORY/);
  assert.match(source, /saveEditedNote/);
});

test("mobile navigation drawer keeps permission-driven links compact and closes on navigation", async () => {
  const navigationSource = await readFile(new URL("../components/DesktopNavigation.vue", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../App.vue", import.meta.url), "utf8");

  assert.match(navigationSource, /mode === 'drawer' \? 'mt-3 min-h-0 grid content-start gap-2 overflow-y-auto'/);
  assert.match(navigationSource, /min-h-\[50px\] gap-3 px-4 py-3/);
  assert.doesNotMatch(navigationSource, /mode === 'drawer' \? '[^']*(?:flex-1|justify-between|justify-around|justify-evenly|space-between)/);
  assert.match(navigationSource, /PLATFORM_MODULE_REGISTRY\.filter/);
  assert.match(navigationSource, /user\.email \|\| "Team account"/);
  assert.match(navigationSource, /Profile/);
  assert.match(navigationSource, /handleLogout/);
  assert.match(appSource, /<DesktopNavigation mode="drawer" @close="closeMobileNavigation" @navigate="closeMobileNavigation" \/>/);
  assert.match(appSource, /details class="relative hidden lg:block"/);
  assert.match(appSource, /bg-transparent text-slate-300/);
});

test("property finder header is scoped to Labs routes", async () => {
  const appSource = await readFile(new URL("../App.vue", import.meta.url), "utf8");

  assert.match(appSource, /isLabsRoute/);
  assert.match(appSource, /v-if="isLabsRoute && user\.hasModule\('LABS'\)"/);
  assert.match(appSource, /v-if="isLabsRoute && user\.hasModule\('LABS'\) && showScanProgress/);
});

test("property detail drawer keeps its controls fixed while preserving page scroll", async () => {
  const source = await readFile(new URL("../components/PropertyDetailDrawer.vue", import.meta.url), "utf8");

  assert.match(source, /<Teleport to="body">/);
  assert.match(source, /fixed right-0 top-0 z-50 flex h-\[100dvh\] max-h-\[100dvh\]/);
  assert.match(source, /sticky top-0 z-\[60\]/);
  assert.match(source, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(source, /document\.body\.style\.position = "fixed"/);
  assert.match(source, /document\.body\.style\.top = `-\$\{previousScrollY\}px`/);
  assert.match(source, /window\.scrollTo\(0, previousScrollY\)/);
});

test("mobile lead actions stay compact and do not wrap in the shared page header", async () => {
  const homeSource = await readFile(new URL("./Home.vue", import.meta.url), "utf8");
  const headerSource = await readFile(new URL("../components/MobileHeader.vue", import.meta.url), "utf8");
  const resultsSource = await readFile(new URL("../components/LeadResultsTable.vue", import.meta.url), "utf8");

  assert.match(homeSource, /inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl/);
  assert.match(headerSource, /flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between/);
  assert.match(headerSource, /<div class="shrink-0 self-start sm:pt-1">/);
  assert.match(resultsSource, /<SatelliteImagePanel/);
  assert.match(resultsSource, /class="mt-4 grid gap-2 md:hidden"/);
  assert.match(resultsSource, /:show-street-preview="false"/);
});

test("mobile bottom navigation keeps follow-ups available in the field workflow", async () => {
  const source = await readFile(new URL("../components/BottomNavigation.vue", import.meta.url), "utf8");

  assert.match(source, /\["APPOINTMENTS", "FOLLOW_UPS", "LEADS", "MORE"\]/);
  assert.match(source, /\["HOME", "FOLLOW_UPS", "LEADS", "MORE"\]/);
});

test("follow-ups page keeps the mobile workspace focused", async () => {
  const source = await readFile(new URL("./FollowUps.vue", import.meta.url), "utf8");

  assert.doesNotMatch(source, /Reconnect when they are ready/);
  assert.doesNotMatch(source, /Keep early homeowner conversations out of the lead pipeline/);
  assert.match(source, /<h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Follow-ups<\/h1>/);
});

test("Labs route workspace persists selections and stays discoverable", async () => {
  const routeSource = await readFile(new URL("./Route.vue", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../App.vue", import.meta.url), "utf8");
  const huntSource = await readFile(new URL("../stores/hunt.store.ts", import.meta.url), "utf8");
  const apiSource = await readFile(new URL("../services/api.ts", import.meta.url), "utf8");
  const migrationSource = await readFile(new URL("../../../../packages/database/migrations/019_saved_routes.sql", import.meta.url), "utf8");
  const routerSource = await readFile(new URL("../router/index.ts", import.meta.url), "utf8");

  assert.match(routerSource, /path: "\/labs\/route", name: "route-experiment", component: \(\) => import\("\.\.\/pages\/Route\.vue"\)/);
  assert.match(routeSource, /Start route/);
  assert.match(routeSource, /Clear route/);
  assert.match(routeSource, /PropertyDetailDrawer/);
  assert.match(routeSource, /hidden overflow-x-auto md:block/);
  assert.match(routeSource, /grid gap-3 p-3 md:hidden/);
  assert.match(routeSource, /Navigate/);
  assert.match(routeSource, /Remove/);
  assert.match(routeSource, /calculateDistanceMiles/);
  assert.match(routeSource, /LIVE_DEVICE/);
  assert.match(routeSource, /SEARCH_CENTER/);
  assert.match(routeSource, /Distance debug \(temporary\)/);
  assert.match(appSource, /aria-label="Labs navigation"/);
  assert.match(appSource, /Route<span v-if="hunt\.savedRouteCount > 0">/);
  assert.match(huntSource, /addSavedRouteItem/);
  assert.match(huntSource, /removeSavedRouteItem/);
  assert.match(huntSource, /loadSavedRoute/);
  assert.match(apiSource, /\/api\/v1\/field\/routes\/current/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS field_ops\.route_items/);
  assert.match(migrationSource, /UNIQUE \(route_id, property_id\)/);
});

test("Vercel uses a same-origin API proxy for mobile session cookies", async () => {
  const apiSource = await readFile(new URL("../services/api.ts", import.meta.url), "utf8");
  const notesSource = await readFile(new URL("../services/field-notes.ts", import.meta.url), "utf8");
  const imagerySource = await readFile(new URL("../services/imagery.ts", import.meta.url), "utf8");
  const vercelSource = await readFile(new URL("../../vercel.json", import.meta.url), "utf8");

  assert.match(apiSource, /useSameOriginApi/);
  assert.match(notesSource, /useSameOriginApi/);
  assert.match(imagerySource, /useSameOriginApi/);
  assert.match(vercelSource, /solarscout-api-if1a\.onrender\.com\/api\/:path\*/);
});
