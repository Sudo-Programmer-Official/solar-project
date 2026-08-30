import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test("manager can publish matching closer availability and assign an unassigned appointment", async ({ context, page }) => {
  let availabilityPublished = false;
  let assigned = false;

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/v1/auth/me") {
      await fulfill(route, 200, { user: manager });
      return;
    }
    if (url.pathname === "/api/v1/field/leads") {
      await fulfill(route, 200, { leads: [lead] });
      return;
    }
    if (url.pathname === "/api/v1/field/appointments") {
      await fulfill(route, 200, { appointments: [assigned ? { ...appointment, closerId: "closer-1", status: "ASSIGNED" } : appointment] });
      return;
    }
    if (url.pathname === "/api/v1/field/closers") {
      await fulfill(route, 200, { closers: [closer] });
      return;
    }
    if (url.pathname === "/api/v1/field/appointments/appointment-1/available-closers") {
      await fulfill(route, 200, { closers: availabilityPublished && !assigned ? [closer] : [] });
      return;
    }
    if (url.pathname === "/api/v1/field/availability" && method === "POST") {
      availabilityPublished = true;
      await fulfill(route, 201, { slot: availability });
      return;
    }
    if (url.pathname === "/api/v1/field/availability" && method === "GET") {
      await fulfill(route, 200, { slots: availabilityPublished ? [availability] : [] });
      return;
    }
    if (url.pathname === "/api/v1/field/appointments/appointment-1/assign" && method === "POST") {
      assigned = true;
      await fulfill(route, 200, { appointment: { ...appointment, closerId: "closer-1", status: "ASSIGNED" } });
      return;
    }
    if (url.pathname === "/api/v1/field/reports") {
      await fulfill(route, 200, { byStatus: [], sync: { pending: 0, synced: 0, failed: 0 } });
      return;
    }
    if (url.pathname === "/api/v1/field/operational-slots") {
      await fulfill(route, 200, { slots: [] });
      return;
    }
    if (url.pathname === "/api/v1/field/operational-slot-definitions") {
      await fulfill(route, 200, { definitions: [] });
      return;
    }
    if (url.pathname === "/api/v1/leads/top" || url.pathname === "/api/v1/revenue/command-center") {
      await fulfill(route, 200, {});
      return;
    }
    await fulfill(route, 200, {});
  });

  await page.goto("/operations");
  await expect(page.getByRole("heading", { name: "Unassigned appointments" })).toBeVisible();
  await expect(page.getByText("No eligible closer covers this appointment yet.")).toBeVisible();

  const closerSelect = page.locator("label").filter({ hasText: "Closer" }).getByRole("combobox");
  await closerSelect.selectOption("closer-1");
  await page.locator('input[type="datetime-local"]').first().fill("2026-08-30T10:00");
  await page.locator('input[type="datetime-local"]').last().fill("2026-08-30T12:00");
  await page.getByRole("button", { name: "Publish availability" }).click();

  const assignmentSelect = page.locator("article").filter({ hasText: "Jordan Miller" }).getByRole("combobox");
  await expect(assignmentSelect).toBeVisible();
  await expect(assignmentSelect.locator('option[value="closer-1"]')).toHaveCount(1);
  await assignmentSelect.selectOption("closer-1");
  await page.getByRole("button", { name: "Assign", exact: true }).click();

  await expect(page.getByText("No unassigned appointments need action.")).toBeVisible();
  await expect(page.getByText("ASSIGNED").last()).toBeVisible();
  expect(assigned).toBe(true);
});

async function fulfill(route: import("@playwright/test").Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const closer = {
  id: "closer-1",
  displayName: "Test Closer",
  teamIds: ["team-1"],
  appointmentsToday: 0,
};

const lead = {
  id: "lead-1",
  propertyId: null,
  setterId: "setter-1",
  currentCloserId: null,
  createdByUserId: "setter-1",
  teamId: "team-1",
  homeownerName: "Jordan Miller",
  phone: null,
  email: null,
  addressLine1: "1 Sun Street",
  city: "Pittsburgh",
  state: "PA",
  postalCode: "15213",
  latitude: null,
  longitude: null,
  utility: null,
  supplier: null,
  approximateMonthlyBill: null,
  qualification: {},
  status: "APPOINTMENT_SET",
  createdAt: "2026-08-30T12:00:00.000Z",
  updatedAt: "2026-08-30T12:00:00.000Z",
};

const appointment = {
  id: "appointment-1",
  leadId: "lead-1",
  setterId: "setter-1",
  closerId: null,
  teamId: "team-1",
  availabilitySlotId: null,
  operationalSlotId: null,
  isOverflow: false,
  scheduledStart: "2026-08-30T10:00:00-04:00",
  scheduledEnd: "2026-08-30T12:00:00-04:00",
  timezone: "America/New_York",
  appointmentType: "SOLAR_CONSULTATION",
  status: "UNASSIGNED",
  outcome: null,
  outcomeNotes: null,
  startedAt: null,
  completedAt: null,
  assignedAt: null,
  assignedBy: null,
  notes: null,
  cancelReason: null,
  cancelledAt: null,
  cancelledBy: null,
  createdAt: "2026-08-30T12:00:00.000Z",
  updatedAt: "2026-08-30T12:00:00.000Z",
};

const availability = {
  id: "availability-1",
  closerId: "closer-1",
  closerName: "Test Closer",
  slotStart: "2026-08-30T10:00:00-04:00",
  slotEnd: "2026-08-30T12:00:00-04:00",
  timezone: "America/New_York",
  capacity: 1,
  bookedCount: 0,
  status: "AVAILABLE",
  note: null,
};

const manager = {
  id: "manager-1",
  displayName: "Test Manager",
  email: "manager@test.local",
  phone: null,
  active: true,
  mustChangePassword: false,
  roles: ["MANAGER"],
  permissions: ["appointment:assign", "appointment:view-team"],
  teamIds: ["team-1"],
  featureFlags: {
    leadFinderEnabled: false,
    routeOptimizerEnabled: false,
    installationSignalsEnabled: false,
    aiTerritoryScoreEnabled: false,
  },
  modules: ["HOME", "APPOINTMENTS", "OPERATIONS", "LEADS", "SCHEDULE", "MAP", "TEAM", "REPORTS", "INSIGHTS", "MORE"],
};
