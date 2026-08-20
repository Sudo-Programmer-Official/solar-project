import http from "node:http";
import {
  analyzeProperty,
  getDealBrief,
  getDiscoverResponse,
  getPermitStats,
  getRouteNext,
  getPropertyAnalysisDebug,
  getPropertyDetail,
  getPropertyDataQuality,
  getRevenueCommandCenter,
  getTodayDashboard,
  listPermits,
  createRoute,
  createDiscoveryScan,
  getDiscoveryScan,
  getDiscoveryScanResultsPage,
  resolveLocationQuery,
  resolveReverseLocationQuery,
  updateLeadOutcome,
} from "./store";
import {
  getMarketArea,
  getMarketEvents,
  getMarketHotspots,
} from "./market";
import { createApiBootstrapContext } from "./bootstrap";
import {
  buildImageryApiConfig,
  calculateHeadingDegrees,
  buildSatelliteImageUrl,
  buildStreetViewImageUrl,
  getImageryCapabilities,
  fetchStreetViewMetadata,
  imageryApiKeyMissingMessage,
  StreetViewProviderError,
  proxyImageryImage,
  resolveImageryProperty,
} from "./imagery";
import type { SolarRepository } from "../../../packages/database/src/repository";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export interface CreateServerOptions {
  readyCheck?: () => Promise<void>;
  corsAllowedOrigins?: string[];
}

export function createServer(repository?: SolarRepository, options: CreateServerOptions = {}): http.Server {
  const allowedOrigins = resolveAllowedOrigins(options.corsAllowedOrigins);
  return http.createServer(async (req, res) => {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : null;
    const corsOrigin = origin && isAllowedOrigin(origin, allowedOrigins) ? origin : null;
    const corsHeaders = buildCorsHeaders(corsOrigin);

    if (req.method === "OPTIONS") {
      res.writeHead(204, { ...jsonHeaders, ...corsHeaders });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        sendJson(
          res,
          200,
          {
            status: "ok",
            service: "solar-api",
            endpoints: ["/health", "/ready"],
          },
          corsHeaders,
        );
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/v1/properties/analyze") {
        const body = await readJson(req);
        const result = await analyzeProperty(body, repository);
        sendJson(res, 200, result, corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/capabilities") {
        sendJson(res, 200, getImageryCapabilities(), corsHeaders);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/v1/locations/resolve") {
        const body = await readJson(req);
        const query = typeof body?.query === "string" ? body.query.trim() : "";
        if (!query) {
          sendJson(res, 400, { error: "query is required" }, corsHeaders);
          return;
        }
        try {
          const resolved = await resolveLocationQuery(query);
          sendJson(res, 200, resolved, corsHeaders);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          if (/no results|not found|unable to geocode|failed with status/i.test(message)) {
            sendJson(res, 404, { error: "Location not found" }, corsHeaders);
            return;
          }
          if (/GOOGLE_GEOCODING_API_KEY|authentication/i.test(message)) {
            sendJson(res, 503, { error: "Geocoding unavailable" }, corsHeaders);
            return;
          }
          sendJson(res, 500, { error: message }, corsHeaders);
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/v1/locations/reverse") {
        const body = await readJson(req);
        const latitude = typeof body?.latitude === "number" ? body.latitude : null;
        const longitude = typeof body?.longitude === "number" ? body.longitude : null;
        if (latitude == null || longitude == null) {
          sendJson(res, 400, { error: "latitude and longitude are required" }, corsHeaders);
          return;
        }
        try {
          const resolved = await resolveReverseLocationQuery(latitude, longitude);
          sendJson(res, 200, resolved, corsHeaders);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          if (/no results|not found|unable to geocode|failed with status/i.test(message)) {
            sendJson(res, 404, { error: "Location not found" }, corsHeaders);
            return;
          }
          if (/GOOGLE_GEOCODING_API_KEY|authentication/i.test(message)) {
            sendJson(res, 503, { error: "Geocoding unavailable" }, corsHeaders);
            return;
          }
          sendJson(res, 500, { error: message }, corsHeaders);
        }
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/dashboard/today") {
        sendJson(res, 200, await getTodayDashboard(repository), corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/leads/top") {
        sendJson(res, 200, await getTodayDashboard(repository), corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/revenue/command-center") {
        sendJson(res, 200, await getRevenueCommandCenter(repository), corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/neighborhoods/discover") {
        const radiusMiles = Number(url.searchParams.get("radiusMiles") ?? url.searchParams.get("radius") ?? "10");
        sendJson(res, 200, await getDiscoverResponse(Number.isFinite(radiusMiles) ? radiusMiles : 10, repository), corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/v1/markets/hotspots") {
        const latitude = Number(url.searchParams.get("latitude"));
        const longitude = Number(url.searchParams.get("longitude"));
        const radiusMiles = Number(url.searchParams.get("radiusMiles") ?? "10");
        const days = Number(url.searchParams.get("days") ?? "90");
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          sendJson(res, 400, { error: "latitude and longitude are required" }, corsHeaders);
          return;
        }
        sendJson(
          res,
          200,
          await getMarketHotspots({
            latitude,
            longitude,
            radiusMiles: Number.isFinite(radiusMiles) ? radiusMiles : 10,
            days: Number.isFinite(days) ? days : 90,
          }),
          corsHeaders,
        );
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/markets\/[^/]+$/.test(url.pathname)) {
        const marketId = url.pathname.split("/")[4];
        const area = await getMarketArea(marketId);
        if (!area) {
          sendJson(res, 404, { error: "Market area not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, area, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/markets\/[^/]+\/events$/.test(url.pathname)) {
        const marketId = url.pathname.split("/")[4];
        const cursor = typeof url.searchParams.get("cursor") === "string" ? url.searchParams.get("cursor") : null;
        const limitRaw = Number(url.searchParams.get("limit") ?? "20");
        const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
        const page = await getMarketEvents(marketId, cursor, limit);
        if (!page) {
          sendJson(res, 404, { error: "Market area not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, page, corsHeaders);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/v1/discovery/scan") {
        const body = await readJson(req);
        const result = await createDiscoveryScan(body, repository);
        sendJson(res, 202, result, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/discovery\/scans\/[^/]+$/.test(url.pathname)) {
        const scanId = url.pathname.split("/")[5];
        const scan = getDiscoveryScan(scanId);
        if (!scan) {
          sendJson(res, 404, { error: "Scan not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, scan, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/discovery\/scans\/[^/]+\/results$/.test(url.pathname)) {
        const scanId = url.pathname.split("/")[5];
        const cursor = typeof url.searchParams.get("cursor") === "string" ? url.searchParams.get("cursor") : null;
        const limitRaw = Number(url.searchParams.get("limit") ?? "20");
        const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
        const page = getDiscoveryScanResultsPage(scanId, cursor, limit);
        if (!page) {
          sendJson(res, 404, { error: "Scan not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, page, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/discovery\/scans\/[^/]+\/debug$/.test(url.pathname)) {
        const scanId = url.pathname.split("/")[5];
        const scan = getDiscoveryScan(scanId);
        if (!scan) {
          sendJson(res, 404, { error: "Scan not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, scan, corsHeaders);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/v1/routes/create") {
        const body = await readJson(req);
        const route = await createRoute(body, repository);
        sendJson(res, 200, route, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/routes\/[^/]+\/next$/.test(url.pathname)) {
        const routeId = url.pathname.split("/")[4];
        const next = await getRouteNext(routeId, repository);
        if (!next) {
          sendJson(res, 404, { error: "Route not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, next, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        const detail = await getPropertyDetail(propertyId, repository);
        if (!detail) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, detail, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/imagery\/satellite$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        if (!repository) {
          sendJson(res, 500, { error: "Repository unavailable" }, corsHeaders);
          return;
        }
        const property = await resolveImageryProperty(propertyId, repository);
        if (!property) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        const { satelliteKey } = buildImageryApiConfig();
        if (!satelliteKey) {
          sendJson(res, 503, { error: imageryApiKeyMissingMessage("satellite") }, corsHeaders);
          return;
        }
        const upstream = await proxyImageryImage(buildSatelliteImageUrl(property.latitude, property.longitude, satelliteKey));
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(200, {
          ...corsHeaders,
          "content-type": upstream.headers.get("content-type") ?? "image/png",
          "cache-control": "private, no-store, max-age=0",
        });
        res.end(buffer);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/imagery\/street-view-metadata$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        if (!repository) {
          sendJson(res, 500, { error: "Repository unavailable" }, corsHeaders);
          return;
        }
        const property = await resolveImageryProperty(propertyId, repository);
        if (!property) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        const { streetViewKey } = buildImageryApiConfig();
        if (!streetViewKey) {
          sendJson(res, 503, { error: imageryApiKeyMissingMessage("street-view") }, corsHeaders);
          return;
        }
        try {
          const metadata = await fetchStreetViewMetadata(property.latitude, property.longitude, streetViewKey);
          sendJson(res, 200, metadata, { ...corsHeaders, "cache-control": "private, no-store, max-age=0" });
        } catch (error) {
          if (error instanceof StreetViewProviderError) {
            if (error.code === "REQUEST_DENIED") {
              sendJson(res, 503, { error: "Street View provider error" }, corsHeaders);
              return;
            }
            if (error.code === "OVER_QUERY_LIMIT") {
              sendJson(res, 429, { error: "Street View quota exceeded" }, corsHeaders);
              return;
            }
            if (error.code === "INVALID_REQUEST") {
              sendJson(res, 400, { error: "Invalid Street View coordinates" }, corsHeaders);
              return;
            }
            sendJson(res, 503, { error: "Street View provider error" }, corsHeaders);
            return;
          }
          throw error;
        }
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/imagery\/street-view$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        if (!repository) {
          sendJson(res, 500, { error: "Repository unavailable" }, corsHeaders);
          return;
        }
        const property = await resolveImageryProperty(propertyId, repository);
        if (!property) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        const { streetViewKey } = buildImageryApiConfig();
        if (!streetViewKey) {
          sendJson(res, 503, { error: imageryApiKeyMissingMessage("street-view") }, corsHeaders);
          return;
        }
        try {
          const metadata = await fetchStreetViewMetadata(property.latitude, property.longitude, streetViewKey);
          if (!metadata.available || metadata.panoramaLocation == null) {
            sendJson(res, 404, { error: "Street View unavailable" }, corsHeaders);
            return;
          }
          const heading = calculateHeadingDegrees(
            metadata.panoramaLocation.latitude,
            metadata.panoramaLocation.longitude,
            property.latitude,
            property.longitude,
          );
          const panoramaResponse = await fetch(
            buildStreetViewImageUrl(
              property.latitude,
              property.longitude,
              streetViewKey,
              heading,
            ),
            { cache: "no-store" },
          );
          if (!panoramaResponse.ok) {
            sendJson(res, 502, { error: "Street View unavailable" }, corsHeaders);
            return;
          }
          const buffer = Buffer.from(await panoramaResponse.arrayBuffer());
          res.writeHead(200, {
            ...corsHeaders,
            "content-type": panoramaResponse.headers.get("content-type") ?? "image/jpeg",
            "cache-control": "private, no-store, max-age=0",
          });
          res.end(buffer);
        } catch (error) {
          if (error instanceof StreetViewProviderError) {
            if (error.code === "REQUEST_DENIED") {
              sendJson(res, 503, { error: "Street View provider error" }, corsHeaders);
              return;
            }
            if (error.code === "OVER_QUERY_LIMIT") {
              sendJson(res, 429, { error: "Street View quota exceeded" }, corsHeaders);
              return;
            }
            if (error.code === "INVALID_REQUEST") {
              sendJson(res, 400, { error: "Invalid Street View coordinates" }, corsHeaders);
              return;
            }
            sendJson(res, 503, { error: "Street View provider error" }, corsHeaders);
            return;
          }
          throw error;
        }
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/brief$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        const brief = await getDealBrief(propertyId, repository);
        if (!brief) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, brief, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/data-quality$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        const response = await getPropertyDataQuality(propertyId, repository);
        if (!response) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, response, corsHeaders);
        return;
      }

      if (req.method === "POST" && /\/api\/v1\/properties\/[^/]+\/interactions$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        const body = await readJson(req);
        const outcome = typeof body?.outcome === "string" ? body.outcome : "UNTOUCHED";
        const notes = typeof body?.notes === "string" && body.notes.trim().length > 0 ? body.notes.trim() : null;
        const updated = await updateLeadOutcome(propertyId, outcome, notes, repository);
        if (!updated) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, updated, corsHeaders);
        return;
      }

      if (req.method === "POST" && /\/api\/v1\/properties\/[^/]+\/usage$/.test(url.pathname)) {
        sendJson(res, 200, { ok: true }, corsHeaders);
        return;
      }

      if (req.method === "POST" && /\/api\/v1\/properties\/[^/]+\/bills$/.test(url.pathname)) {
        sendJson(res, 200, { ok: true, note: "Bill uploads are reserved for the next secure storage slice." }, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/permits$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        sendJson(res, 200, { propertyId, permits: await listPermits(propertyId, repository) }, corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/markets\/[^/]+\/permit-stats$/.test(url.pathname)) {
        const municipality = decodeURIComponent(url.pathname.split("/")[4]);
        sendJson(res, 200, await getPermitStats(municipality, repository), corsHeaders);
        return;
      }

      if (req.method === "GET" && /\/api\/v1\/properties\/[^/]+\/analysis-debug$/.test(url.pathname)) {
        if (process.env.NODE_ENV === "production") {
          sendJson(res, 403, { error: "analysis-debug is development/admin only" }, corsHeaders);
          return;
        }
        const propertyId = url.pathname.split("/")[4];
        sendJson(res, 200, await getPropertyAnalysisDebug(propertyId, repository), corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { status: "ok", service: "solar-api" }, corsHeaders);
        return;
      }

      if (req.method === "GET" && url.pathname === "/ready") {
        try {
          if (!options.readyCheck) {
            throw new Error("Database readiness is not configured.");
          }
          await options.readyCheck();
          sendJson(res, 200, { status: "ready", database: "connected" }, corsHeaders);
        } catch {
          sendJson(res, 503, { status: "not_ready", database: "disconnected" }, corsHeaders);
        }
        return;
      }

      sendJson(res, 404, { error: "Not found" }, corsHeaders);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Unknown error",
      }, corsHeaders);
    }
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(status, { ...jsonHeaders, ...extraHeaders });
  res.end(JSON.stringify(body, null, 2));
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8") || "{}";
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
  };
}

function resolveAllowedOrigins(configuredOrigins: string[] = []): string[] {
  const filtered = configuredOrigins.map((origin) => origin.trim()).filter(Boolean);
  if (filtered.length > 0) {
    return filtered;
  }
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    if (parsed.hostname.endsWith(".onrender.com") || parsed.hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  void (async () => {
    try {
      console.log("Solar API server starting");
      const context = await createApiBootstrapContext({ applyMigrations: true });
      const port = context.env.port ?? context.env.apiPort ?? 4000;
      const environment = process.env.NODE_ENV ?? "development";
      console.log(`Environment: ${environment}`);
      console.log("Database: configured");
      console.log(`Port: ${port}`);
      console.log("Database connection successful");
      createServer(context.repository, {
        readyCheck: context.readyCheck,
        corsAllowedOrigins: parseCorsOrigins(context.env.corsAllowedOrigins),
      }).listen(port, "0.0.0.0", () => {
        console.log(`API listening on 0.0.0.0:${port}`);
      });
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  })();
}

function parseCorsOrigins(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
