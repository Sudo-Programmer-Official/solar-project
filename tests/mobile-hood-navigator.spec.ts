import { expect, test } from "@playwright/test";
import { MockHuntBackend } from "./support/mock-hunt-backend";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("mobile Hood Navigator renders map, route modes, and a selected cluster", async ({ context, page }, testInfo) => {
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
      recentRoofPermits: false,
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
    await route.fulfill({ status: response.status, contentType: "application/json", body: JSON.stringify(response.json) });
  });

  await page.goto("/hunt");
  await page.locator("#global-search-input-mobile").fill("Altoona, PA 16602");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("mobile-swipe-hunt")).toBeVisible();
  await page.getByRole("link", { name: "Navigate" }).click();

  await expect(page.getByRole("heading", { name: "Hood Navigator" })).toBeVisible();
  await expect(page.getByText("Route options")).toBeVisible();
  await expect(page.getByText("Best Overall")).toBeVisible();
  await expect(page.locator("svg[aria-label='Hood Navigator opportunity map']")).toBeVisible();

  const clusterButton = page.locator("svg g.cursor-pointer").last();
  await clusterButton.click();
  await expect(page.getByText("Selected cluster")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("hood-navigator-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Start here" }).click();
  await expect(page.getByText(/Stop 1 ·/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("hood-navigator-route-mobile.png"), fullPage: false });
});
