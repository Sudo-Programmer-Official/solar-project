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
  assert.match(source, /async function refreshAvailableClosers/);
  assert.match(source, /await refreshAvailableClosers\(\);\n    message\.value = "Closer assignment availability published\."/);
  assert.match(source, /No eligible closer covers this appointment yet/);
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

test("mobile lead actions stay compact and do not wrap in the shared page header", async () => {
  const homeSource = await readFile(new URL("./Home.vue", import.meta.url), "utf8");
  const headerSource = await readFile(new URL("../components/MobileHeader.vue", import.meta.url), "utf8");

  assert.match(homeSource, /inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl/);
  assert.match(headerSource, /flex min-w-0 items-start justify-between gap-3/);
  assert.match(headerSource, /<div class="shrink-0">/);
});
