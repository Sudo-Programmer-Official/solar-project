import { expect, test } from "@playwright/test";
import { MockHuntBackend } from "./support/mock-hunt-backend";

test.describe.configure({ mode: "serial" });

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("mobile swipe hunt preserves dispositions and supports load more", async ({ context, page }) => {
  const backend = new MockHuntBackend();
  await backend.init();

  await context.addInitScript(() => {
    const contextState = {
      type: "AREA",
      label: "Altoona, PA 16602",
      latitude: 40.5071,
      longitude: -78.3942,
      placeId: "mock-altoona-place",
      propertyId: null,
    };
    const filters = {
      whaleCandidates: false,
      highPriority: false,
      minimumSystemKw: null,
      recentRoofPermit: false,
      noDetectedSolar: false,
      poolDetected: false,
      largeRoof: false,
      lowShade: false,
      largeLot: false,
      largeProperty: false,
      highValueArea: false,
      revisit: false,
    };

    window.localStorage.setItem("solar.search.version", "4");
    window.localStorage.setItem("solar.search.context", JSON.stringify(contextState));
    window.localStorage.setItem("solar.search.radius", JSON.stringify(20));
    window.localStorage.setItem("solar.search.filters", JSON.stringify(filters));
    window.localStorage.setItem("solar.search.recent", JSON.stringify([contextState.label]));
    window.localStorage.setItem("solar.search.prompted", JSON.stringify(false));
  });

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const body = method === "GET" || method === "HEAD" ? undefined : request.postDataJSON();
    const response = await backend.handle(url, method, body);
    if (!response) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.json),
    });
  });

  await context.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", service: "solar-api" }),
    });
  });

  await page.goto("/hunt");
  await page.locator("#global-search-input-mobile").fill("Altoona, PA 16602");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("mobile-swipe-hunt")).toBeVisible();

  await expect.poll(() => backend.scanRequests.length).toBeGreaterThan(0);
  await expect(page.getByText("More leads are still being analyzed")).toBeVisible();

  const firstScanId = backend.scanRequests[backend.scanRequests.length - 1];
  const firstScan = backend.scanRecords.get(firstScanId);
  expect(firstScan).toBeTruthy();
  const firstLead = firstScan!.scanResult.results[0];
  const nextLead = firstScan!.scanResult.results[1];
  const firstLeadStreet = streetName(firstLead.address);
  const nextLeadStreet = streetName(nextLead.address);
  const firstLeadId = firstLead.propertyId ?? firstLead.id;

  const firstCard = page.locator('[data-testid="mobile-swipe-hunt"] h3').first();
  await expect(firstCard).toContainText(firstLeadStreet);

  const firstCardBox = await firstCard.boundingBox();
  expect(firstCardBox).toBeTruthy();
  if (firstCardBox) {
    await page.mouse.move(firstCardBox.x + firstCardBox.width / 2, firstCardBox.y + firstCardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(firstCardBox.x + firstCardBox.width / 2, firstCardBox.y + firstCardBox.height / 2 + 160, { steps: 6 });
    await page.mouse.up();
  }
  await expect(firstCard).toContainText(firstLeadStreet);

  await page.getByTestId("swipe-save").click();
  await expect(page.getByText("Lead saved")).toBeVisible();
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === firstLeadId)?.outcome ?? null;
  }).toBe("SAVED");
  await expect(firstCard).not.toContainText(firstLeadStreet);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === firstLeadId)?.outcome ?? null;
  }).toBe("NEW");
  await expect(firstCard).toContainText(firstLeadStreet);

  await page.getByTestId("swipe-save").click();
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === firstLeadId)?.outcome ?? null;
  }).toBe("SAVED");

  await page.reload();
  await page.locator("#global-search-input-mobile").fill("Altoona, PA 16602");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("mobile-swipe-hunt")).toBeVisible();
  await expect.poll(() => backend.scanRequests.length).toBeGreaterThan(1);
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === firstLeadId)?.outcome ?? null;
  }).toBe("SAVED");

  await page.getByRole("link", { name: "Leads" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: firstLeadStreet })).toBeVisible();
  await page.getByRole("link", { name: "Hunt" }).click();
  await expect(page.getByTestId("mobile-swipe-hunt")).toBeVisible();

  const secondScanId = backend.scanRequests[backend.scanRequests.length - 1];
  const secondScan = backend.scanRecords.get(secondScanId);
  expect(secondScan).toBeTruthy();
  const secondLead = secondScan!.scanResult.results[1];
  const secondLeadStreet = streetName(secondLead.address);
  const secondLeadId = secondLead.propertyId ?? secondLead.id;

  const huntCard = page.locator('[data-testid="mobile-swipe-hunt"] h3').first();
  await expect(huntCard).toContainText(nextLeadStreet);

  await page.getByTestId("swipe-skip").click();
  await expect(page.getByText("Lead skipped")).toBeVisible();
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === secondLeadId)?.outcome ?? null;
  }).toBe("SKIPPED");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === secondLeadId)?.outcome ?? null;
  }).toBe("NEW");

  await page.getByTestId("swipe-skip").click();
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === secondLeadId)?.outcome ?? null;
  }).toBe("SKIPPED");

  await page.getByRole("link", { name: "Leads" }).click();
  await page.getByRole("button", { name: "Skipped" }).click();
  await expect(page.getByRole("heading", { name: secondLeadStreet })).toBeVisible();
  await page.getByRole("link", { name: "Hunt" }).click();
  await expect(page.getByTestId("mobile-swipe-hunt")).toBeVisible();

  await page.getByRole("button", { name: "Open search actions" }).click();
  await page.getByRole("menuitem", { name: "Filters" }).click();
  await page.getByRole("button", { name: "Pool" }).click();
  await page.getByRole("button", { name: /Apply filters/ }).click();
  await expect.poll(() => backend.scanRequests.length).toBeGreaterThan(2);
  await expect(page.getByText("More leads are still being analyzed")).toBeVisible();

  await page.getByRole("link", { name: "Leads" }).click();
  await page.getByRole("button", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: firstLeadStreet })).toBeVisible();
  await page.getByRole("link", { name: "Hunt" }).click();

  const filteredScanId = backend.scanRequests[backend.scanRequests.length - 1];
  const filteredScan = backend.scanRecords.get(filteredScanId);
  expect(filteredScan).toBeTruthy();
  const filteredResults = filteredScan!.scanResult.results;
  if (filteredResults.length === 0) {
    await expect(page.getByText("No leads match these filters.")).toBeVisible();
    await expect(page.getByText("We checked 0 properties in this area.")).toBeVisible();
    return;
  }

  const filteredFirstLead = filteredResults[0];
  const filteredSecondLead = filteredResults[1];
  const filteredFirstStreet = streetName(filteredFirstLead.address);
  const filteredSecondStreet = filteredSecondLead ? streetName(filteredSecondLead.address) : null;
  const filteredFirstId = filteredFirstLead.propertyId ?? filteredFirstLead.id;
  const filteredSecondId = filteredSecondLead?.propertyId ?? filteredSecondLead?.id ?? null;

  await expect(page.locator('[data-testid="mobile-swipe-hunt"] h3').first()).toContainText(filteredFirstStreet);

  const directionsPromise = page.waitForEvent("popup");
  await page.getByTestId("swipe-navigate").click();
  const popup = await directionsPromise;
  await expect.poll(() => popup.url()).toContain(String(filteredFirstLead.latitude ?? ""));
  await expect.poll(() => popup.url()).toContain(String(filteredFirstLead.longitude ?? ""));
  await popup.close();

  await page.getByTestId("swipe-card").click();
  await page.waitForURL(/\/properties\//);
  await expect(page.getByRole("heading", { name: "Property Detail" })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("mobile-swipe-hunt")).toBeVisible();

  await expect(page.locator('[data-testid="mobile-swipe-hunt"] h3').first()).toContainText(filteredFirstStreet);
  await page.getByTestId("swipe-save").click();
  await expect(page.getByText("Lead saved")).toBeVisible();
  if (filteredSecondLead) {
    await page.getByTestId("swipe-skip").click();
    await expect(page.getByText("Lead skipped")).toBeVisible();
  }
  await expect.poll(async () => {
    const dashboard = await backend.getDashboard();
    return dashboard.leads.find((lead) => lead.propertyId === filteredFirstId)?.outcome ?? null;
  }).toBe("SAVED");
  if (filteredSecondId) {
    await expect.poll(async () => {
      const dashboard = await backend.getDashboard();
      return dashboard.leads.find((lead) => lead.propertyId === filteredSecondId)?.outcome ?? null;
    }).toBe("SKIPPED");
  }

  const loadMoreButton = page.getByRole("button", { name: "Load more leads" });
  if (await loadMoreButton.isVisible().catch(() => false)) {
    await loadMoreButton.click();
    await expect(page.locator('[data-testid="mobile-swipe-hunt"] h3').first()).not.toContainText(filteredFirstStreet);
    const visibleTitles = await page.locator('[data-testid="mobile-swipe-hunt"] h3').allTextContents();
    expect(new Set(visibleTitles).size).toBe(visibleTitles.length);
    expect(visibleTitles.includes(filteredFirstStreet)).toBe(false);
    if (filteredSecondStreet) {
      expect(visibleTitles.includes(filteredSecondStreet)).toBe(false);
    }
  }
});

function streetName(address: string) {
  return address.split(",")[0]?.trim() ?? address.trim();
}
