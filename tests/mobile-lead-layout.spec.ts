import { expect, test } from "@playwright/test";

test.use({
  hasTouch: true,
  isMobile: true,
});

const operationalTimes = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

test("lead capture stays within the viewport at mobile widths", async ({ context, page }) => {
  await context.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/me") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: testUser }) });
      return;
    }
    if (url.pathname === "/api/v1/field/operational-slots") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ slots: operationalSlots() }) });
      return;
    }
    await route.continue();
  });

  for (const width of [320, 360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/leads/new");
    await openLeadCapture(page);
    await expect(page.getByText("APPOINTMENT").first()).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
  }

  await page.goto("/leads/new");
  await openLeadCapture(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "homeowner-utility-bill-with-a-long-recognizable-name.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n"),
  });
  await expect(page.getByText("homeowner-utility-bill-with-a-long-recognizable-name.pdf")).toBeVisible();
  await expect(page.getByText("1 KB")).toBeVisible();
  await expect(page.getByText("Ready to upload")).toBeVisible();

  const slot = page.getByRole("button", { name: /6 PM, Available/ });
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");

  const lateSlot = page.getByRole("button", { name: /8 PM, Available/ });
  await lateSlot.scrollIntoViewIfNeeded();
  const [lateSlotBox, saveBox] = await Promise.all([lateSlot.boundingBox(), page.getByRole("button", { name: "Save lead & appointment" }).boundingBox()]);
  expect(lateSlotBox).toBeTruthy();
  expect(saveBox).toBeTruthy();
  if (lateSlotBox && saveBox) {
    expect(lateSlotBox.y + lateSlotBox.height).toBeLessThanOrEqual(saveBox.y);
  }
});

const testUser = {
  id: "00000000-0000-4000-8000-000000000101",
  displayName: "Test Setter",
  email: "setter@test.local",
  phone: null,
  active: true,
  mustChangePassword: false,
  roles: ["SETTER"],
  permissions: ["lead:create", "lead:view-own", "appointment:create", "appointment:view-own"],
  teamIds: [],
  featureFlags: {
    leadFinderEnabled: false,
    routeOptimizerEnabled: false,
    installationSignalsEnabled: false,
    aiTerritoryScoreEnabled: false,
  },
  modules: ["HOME", "LEADS", "SCHEDULE", "MORE"],
};

function operationalSlots() {
  return operationalTimes.map((startTime, index) => ({
    id: `slot-${index}`,
    teamId: null,
    slotDate: localDate(),
    startTime,
    slotStart: new Date(Date.now() + index * 60_000).toISOString(),
    slotEnd: new Date(Date.now() + (index + 1) * 60_000).toISOString(),
    timezone: "America/New_York",
    standardCapacity: 1,
    bookedCount: 0,
    remainingCapacity: 1,
    overflowCount: 0,
    overflowPolicy: "ALLOW_WITH_WARNING",
    status: "OPEN",
    appointments: [],
  }));
}

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function openLeadCapture(page: import("@playwright/test").Page): Promise<void> {
  const form = page.locator('input[placeholder="Homeowner name"]');
  if (await form.count() === 0) {
    await page.getByRole("link", { name: "+ New lead" }).click();
  }
  await expect(form).toBeVisible();
}
