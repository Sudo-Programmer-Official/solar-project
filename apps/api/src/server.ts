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
  getLeadOutcomes,
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
  updatePropertyVisualSignals,
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
import type { PlatformRepository, TeamMemberRecord } from "../../../packages/database/src/platform";
import type { FieldOperationsRepository, FieldAppointmentOutcome, FieldAppointmentStatus, FieldFollowUpStatus } from "../../../packages/database/src/field-operations";
import type { IntelligenceRepository } from "../../../packages/territory-scoring/src/index";
import {
  PlatformAuthService,
  PlatformHttpError,
  buildAuthCookies,
  canAssignRoles,
  canManageUserRoles,
  clearAuthCookies,
  hashPassword,
  requireAnyPermission,
  requireAuthenticated,
  requirePermission,
  validatePassword,
} from "./platform-auth";
import type { AuthenticatedPlatformUser } from "./platform-auth";
import { PlatformRole, type PlatformPermission } from "../../../packages/contracts/src/index";
import { randomUUID } from "node:crypto";
import { FieldOperationsService } from "./field-operations";
import { handleIntelligenceRoute } from "./intelligence";
import type { FieldBillStorage } from "./field-bill-storage";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export interface CreateServerOptions {
  readyCheck?: () => Promise<void>;
  corsAllowedOrigins?: string[];
  platformRepository?: PlatformRepository;
  fieldOperationsRepository?: FieldOperationsRepository;
  fieldBillStorage?: FieldBillStorage;
  intelligenceRepository?: IntelligenceRepository;
  authRequired?: boolean;
}

export function createServer(repository?: SolarRepository, options: CreateServerOptions = {}): http.Server {
  const allowedOrigins = resolveAllowedOrigins(options.corsAllowedOrigins);
  const platformAuth = options.platformRepository ? new PlatformAuthService(options.platformRepository) : null;
  const fieldOperations = options.fieldOperationsRepository ? new FieldOperationsService(options.fieldOperationsRepository, options.fieldBillStorage) : null;
  const intelligenceRepository = options.intelligenceRepository ?? null;
  const authRequired = options.authRequired ?? parseBoolean(process.env.AUTH_REQUIRED, true);
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
      if (isAuthPath(url.pathname)) {
        if (!platformAuth) {
          sendJson(res, 503, { error: "Authentication service is not configured." }, { ...corsHeaders, "access-control-allow-credentials": "true" });
          return;
        }
        await handleAuthRoute(req, res, url, corsHeaders, platformAuth);
        return;
      }

      const auth = platformAuth ? await platformAuth.authenticate(req) : null;
      if (
        authRequired &&
        isProtectedApiPath(url.pathname) &&
        req.method !== "GET" &&
        req.method !== "HEAD" &&
        origin &&
        !corsOrigin
      ) {
        throw new PlatformHttpError(403, "Request origin is not allowed.", "CSRF_ORIGIN_FORBIDDEN");
      }
      const currentUser = authRequired && isProtectedApiPath(url.pathname)
        ? requireAuthenticated(auth)
        : auth?.user ?? null;
      if (authRequired && isProtectedApiPath(url.pathname)) {
        enforceApiPermission(req, url, currentUser ?? requireAuthenticated(auth));
      }

      if (fieldOperations && url.pathname.startsWith("/api/v1/field/")) {
        await handleFieldRoute(req, res, url, corsHeaders, fieldOperations, currentUser);
        return;
      }

      if (platformAuth && isTeamPath(url.pathname)) {
        await handleTeamRoute(req, res, url, corsHeaders, platformAuth, currentUser);
        return;
      }

      if (intelligenceRepository && url.pathname.startsWith("/api/v1/intelligence/")) {
        await handleIntelligenceRoute(req, res, url, intelligenceRepository, sendJson, corsHeaders);
        return;
      }

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

      if (req.method === "GET" && url.pathname === "/api/v1/lead-outcomes") {
        const outcome = typeof url.searchParams.get("outcome") === "string" ? url.searchParams.get("outcome") : null;
        sendJson(
          res,
          200,
          await getLeadOutcomes(repository, {
            outcome: outcome === "SAVED" || outcome === "SKIPPED" || outcome === "REVISIT" ? outcome : "ALL",
          }),
          corsHeaders,
        );
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
        const outcome = typeof body?.outcome === "string" ? body.outcome : "NEW";
        const notes = typeof body?.notes === "string" && body.notes.trim().length > 0 ? body.notes.trim() : null;
        const updated = await updateLeadOutcome(propertyId, outcome, notes, repository);
        if (!updated) {
          sendJson(res, 404, { error: "Property not found" }, corsHeaders);
          return;
        }
        sendJson(res, 200, updated, corsHeaders);
        return;
      }

      if (req.method === "POST" && /\/api\/v1\/properties\/[^/]+\/visual-signals$/.test(url.pathname)) {
        const propertyId = url.pathname.split("/")[4];
        const body = await readJson(req);
        const updated = await updatePropertyVisualSignals(
          propertyId,
          {
            poolHeated: normalizeConfirmationAnswer(body?.poolHeated),
            highSummerBill: normalizeConfirmationAnswer(body?.highSummerBill),
            poolEquipmentIncreasesUsage: normalizeConfirmationAnswer(body?.poolEquipmentIncreasesUsage),
          },
          repository,
        );
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
      if (error instanceof PlatformHttpError) {
        sendJson(res, error.status, { error: error.message, code: error.code }, corsHeaders);
        return;
      }
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Unknown error",
      }, corsHeaders);
    }
  });
}

async function handleAuthRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  corsHeaders: Record<string, string>,
  service: PlatformAuthService,
): Promise<void> {
  const path = normalizePlatformPath(url.pathname);
  const headers = { ...corsHeaders, "access-control-allow-credentials": "true", "cache-control": "no-store" };
  const secure = isSecureRequest(req);

  if (req.method === "POST" && path === "/auth/login") {
    const body = await readJson(req);
    const email = requiredString(body?.email, "email").toLowerCase();
    const password = requiredString(body?.password, "password");
    const result = await service.login(email, password, req);
    sendJson(res, 200, { user: result.user, accessExpiresAt: result.tokens.accessExpiresAt, refreshExpiresAt: result.tokens.refreshExpiresAt }, { ...headers, "set-cookie": buildAuthCookies(result.tokens, secure) });
    return;
  }

  if (req.method === "GET" && path === "/auth/me") {
    const auth = requireAuthenticated(await service.authenticate(req));
    sendJson(res, 200, { user: auth }, headers);
    return;
  }

  if (req.method === "POST" && path === "/auth/refresh") {
    const result = await service.refresh(req);
    sendJson(res, 200, { user: result.user, accessExpiresAt: result.tokens.accessExpiresAt, refreshExpiresAt: result.tokens.refreshExpiresAt }, { ...headers, "set-cookie": buildAuthCookies(result.tokens, secure) });
    return;
  }

  if (req.method === "POST" && path === "/auth/change-password") {
    const auth = requireAuthenticated(await service.authenticate(req));
    const body = await readJson(req);
    const updated = await service.changePassword(auth.id, requiredString(body?.currentPassword, "currentPassword"), requiredString(body?.newPassword, "newPassword"));
    sendJson(res, 200, { user: updated }, headers);
    return;
  }

  if (req.method === "POST" && path === "/auth/logout") {
    await service.logout(req);
    sendJson(res, 200, { ok: true }, { ...headers, "set-cookie": clearAuthCookies(secure) });
    return;
  }

  if (req.method === "POST" && (path === "/auth/invite/accept" || path === "/auth/accept-invite")) {
    const body = await readJson(req);
    await service.acceptInvite(requiredString(body?.token, "token"), requiredString(body?.password, "password"));
    sendJson(res, 200, { ok: true }, headers);
    return;
  }

  sendJson(res, 404, { error: "Authentication endpoint not found." }, headers);
}

async function handleTeamRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  corsHeaders: Record<string, string>,
  service: PlatformAuthService,
  authUser: AuthenticatedPlatformUser | null,
): Promise<void> {
  const user = requireAuthenticated(authUser ? { user: authUser } : null);
  const repository = serviceRepository(service);
  const rawPath = normalizePlatformPath(url.pathname);
  const path = rawPath === "/users" || rawPath.startsWith("/users/") ? `/team${rawPath}` : rawPath;

  if (req.method === "GET" && path === "/team") {
    requirePermission(user, "team:view");
    const members = (await repository.listTeamMembers()).filter((member) => canSeeTeamMember(user, member));
    sendJson(res, 200, { users: members.map(toTeamResponse) }, corsHeaders);
    return;
  }

  const memberMatch = path.match(/^\/team\/users\/([^/]+)(?:\/invite)?$/);
  const targetId = memberMatch?.[1] ? decodeURIComponent(memberMatch[1]) : null;
  const isInviteRoute = path.endsWith("/invite");

  if (req.method === "POST" && path === "/team/users") {
    requirePermission(user, "team:create-user");
    const body = await readJson(req);
    const firstName = requiredString(body?.firstName, "firstName");
    const lastName = requiredString(body?.lastName, "lastName");
    const email = requiredString(body?.email, "email").toLowerCase();
    const rolesProvided = body?.roles !== undefined;
    const roles = rolesProvided ? parseRoles(body.roles) : [PlatformRole.SETTER];
    if (roles.length === 0) throw new PlatformHttpError(400, "At least one role is required.", "ROLE_REQUIRED");
    if (rolesProvided) requirePermission(user, "team:assign-role");
    if (!canAssignRoles(user, roles)) throw new PlatformHttpError(403, "Only a Super Admin can assign the SUPER_ADMIN role.", "SUPER_ADMIN_ASSIGNMENT_FORBIDDEN");
    if (!canManageUserRoles(user, [], roles)) throw new PlatformHttpError(403, "You cannot assign a role above your management level.", "ROLE_HIERARCHY_FORBIDDEN");
    if (await repository.findUserByEmail(email)) throw new PlatformHttpError(409, "A user with that email already exists.", "EMAIL_IN_USE");

    const password = typeof body?.password === "string" && body.password.length > 0 ? body.password : null;
    if (password) validatePassword(password);
    const teamIds = parseTeamIds(body?.teamIds, user);
    const created = await repository.createUser({
      id: randomUUID(),
      firstName,
      lastName,
      email,
      phone: typeof body?.phone === "string" ? body.phone.trim() || null : null,
      passwordHash: password ? hashPassword(password) : null,
      mustChangePassword: Boolean(password),
    });
    const withRoles = await repository.replaceUserRoles(created.id, roles, user.id);
    if (!withRoles) throw new Error("Created user roles could not be loaded.");
    const withTeams = await repository.replaceUserTeams(created.id, teamIds, user.id);
    if (!withTeams) throw new Error("Created user teams could not be loaded.");
    const invite = password ? null : await service.createInvite(created.id, user.id);
    await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_CREATED", entityType: "USER", entityId: created.id, details: { roles, invited: Boolean(invite) } });
    await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_ROLES_REPLACED", entityType: "USER", entityId: created.id, details: { roles } });
    await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_TEAMS_REPLACED", entityType: "USER", entityId: created.id, details: { teamIds } });
    sendJson(res, 201, { user: toTeamResponse(withTeams), invite: formatInvite(invite) }, corsHeaders);
    return;
  }

  if (!targetId || !isUuid(targetId)) {
    sendJson(res, 404, { error: "Team user not found." }, corsHeaders);
    return;
  }

  if (req.method === "POST" && isInviteRoute) {
    requirePermission(user, "team:update-user");
    const target = await repository.findUserById(targetId);
    if (!target) {
      sendJson(res, 404, { error: "Team user not found." }, corsHeaders);
      return;
    }
    assertTeamMemberScope(user, target);
    if (!canManageUserRoles(user, target.roles, target.roles)) {
      throw new PlatformHttpError(403, "You cannot manage this user's role level.", "ROLE_HIERARCHY_FORBIDDEN");
    }
    const invite = await service.createInvite(target.id, user.id);
    await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_INVITED", entityType: "USER", entityId: target.id });
    sendJson(res, 201, { invite: formatInvite(invite) }, corsHeaders);
    return;
  }

  if (req.method === "PATCH" && !isInviteRoute) {
    const target = await repository.findUserById(targetId);
    if (!target) {
      sendJson(res, 404, { error: "Team user not found." }, corsHeaders);
      return;
    }
    assertTeamMemberScope(user, target);
    const body = await readJson(req);
    const hasRoles = body?.roles !== undefined;
    const hasTeamChanges = body?.teamIds !== undefined;
    const hasProfileChanges = ["firstName", "lastName", "phone", "active"].some((key) => body?.[key] !== undefined);
    if (body?.active === false && target.roles.includes(PlatformRole.SUPER_ADMIN)) {
      const activeSuperAdmins = (await repository.listTeamMembers()).filter((member) => member.active && member.roles.includes(PlatformRole.SUPER_ADMIN));
      if (activeSuperAdmins.length <= 1) throw new PlatformHttpError(400, "The last active Super Admin cannot be deactivated.", "LAST_SUPER_ADMIN_FORBIDDEN");
    }
    if (hasProfileChanges && !canManageUserRoles(user, target.roles, target.roles)) {
      throw new PlatformHttpError(403, "You cannot manage this user's role level.", "ROLE_HIERARCHY_FORBIDDEN");
    }
    if (hasTeamChanges) {
      requirePermission(user, "team:assign-role");
      if (!canManageUserRoles(user, target.roles, target.roles)) throw new PlatformHttpError(403, "You cannot manage this user's team membership.", "ROLE_HIERARCHY_FORBIDDEN");
      const teamIds = parseTeamIds(body.teamIds, user);
      const updatedTeams = await repository.replaceUserTeams(targetId, teamIds, user.id);
      if (!updatedTeams) {
        sendJson(res, 404, { error: "Team user not found." }, corsHeaders);
        return;
      }
      await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_TEAMS_REPLACED", entityType: "USER", entityId: targetId, details: { teamIds } });
      if (!hasProfileChanges && !hasRoles) {
        sendJson(res, 200, { user: toTeamResponse(updatedTeams) }, corsHeaders);
        return;
      }
    }
    if (hasRoles) {
      requirePermission(user, "team:assign-role");
      const roles = parseRoles(body.roles);
      if (roles.length === 0) throw new PlatformHttpError(400, "At least one role is required.", "ROLE_REQUIRED");
      if (!canAssignRoles(user, roles)) throw new PlatformHttpError(403, "Only a Super Admin can assign the SUPER_ADMIN role.", "SUPER_ADMIN_ASSIGNMENT_FORBIDDEN");
      if (target.roles.includes(PlatformRole.SUPER_ADMIN) && !roles.includes(PlatformRole.SUPER_ADMIN) && !canAssignRoles(user, [PlatformRole.SUPER_ADMIN])) {
        throw new PlatformHttpError(403, "Only a Super Admin can remove the SUPER_ADMIN role.", "SUPER_ADMIN_ASSIGNMENT_FORBIDDEN");
      }
      if (target.roles.includes(PlatformRole.SUPER_ADMIN) && !roles.includes(PlatformRole.SUPER_ADMIN)) {
        const activeSuperAdmins = (await repository.listTeamMembers()).filter((member) => member.active && member.roles.includes(PlatformRole.SUPER_ADMIN));
        if (activeSuperAdmins.length <= 1) throw new PlatformHttpError(400, "The last active Super Admin cannot lose the SUPER_ADMIN role.", "LAST_SUPER_ADMIN_FORBIDDEN");
      }
      if (!canManageUserRoles(user, target.roles, roles)) {
        throw new PlatformHttpError(403, "You cannot assign a role above your management level.", "ROLE_HIERARCHY_FORBIDDEN");
      }
      const updatedRoles = await repository.replaceUserRoles(targetId, roles, user.id);
      if (!updatedRoles) {
        sendJson(res, 404, { error: "Team user not found." }, corsHeaders);
        return;
      }
      await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_ROLES_REPLACED", entityType: "USER", entityId: targetId, details: { roles } });
      if (!hasProfileChanges) {
        sendJson(res, 200, { user: toTeamResponse(updatedRoles) }, corsHeaders);
        return;
      }
    }
    if (!hasProfileChanges && !hasTeamChanges) throw new PlatformHttpError(400, "No user changes were provided.", "NO_CHANGES");
    requirePermission(user, "team:update-user");
    if (body?.active === false && targetId === user.id) throw new PlatformHttpError(400, "You cannot deactivate your own account.", "SELF_DEACTIVATION_FORBIDDEN");
    const updated = await repository.updateUser(targetId, {
      firstName: body?.firstName === undefined ? undefined : requiredString(body.firstName, "firstName"),
      lastName: body?.lastName === undefined ? undefined : requiredString(body.lastName, "lastName"),
      phone: body?.phone === undefined ? undefined : (typeof body.phone === "string" ? body.phone.trim() || null : null),
      active: body?.active === undefined ? undefined : Boolean(body.active),
    });
    if (!updated) {
      sendJson(res, 404, { error: "Team user not found." }, corsHeaders);
      return;
    }
    await repository.appendAudit({ id: randomUUID(), actorId: user.id, action: "USER_UPDATED", entityType: "USER", entityId: targetId, details: body });
    sendJson(res, 200, { user: toTeamResponse(updated) }, corsHeaders);
    return;
  }

  sendJson(res, 404, { error: "Team endpoint not found." }, corsHeaders);
}

function serviceRepository(service: PlatformAuthService): PlatformRepository {
  return service.repository;
}

async function handleFieldRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  corsHeaders: Record<string, string>,
  service: FieldOperationsService,
  authUser: AuthenticatedPlatformUser | null,
): Promise<void> {
  const user = requireAuthenticated(authUser ? { user: authUser } : null);
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/v1/field/leads") {
    sendJson(res, 200, { leads: await service.listLeads(user) }, corsHeaders);
    return;
  }

  if (req.method === "POST" && path === "/api/v1/field/leads") {
    const body = await readJson(req);
    const leadInput = {
      propertyId: optionalString(body?.propertyId), homeownerName: requiredString(body?.homeownerName, "homeownerName"),
      phone: optionalString(body?.phone), email: optionalString(body?.email), addressLine1: requiredString(body?.addressLine1, "addressLine1"),
      city: optionalString(body?.city), state: optionalString(body?.state), postalCode: optionalString(body?.postalCode),
      latitude: optionalNumber(body?.latitude), longitude: optionalNumber(body?.longitude), utility: optionalString(body?.utility), supplier: optionalString(body?.supplier),
      approximateMonthlyBill: optionalNumber(body?.approximateMonthlyBill), qualification: body?.qualification ?? {}, teamId: optionalString(body?.teamId),
    };
    const operationalSlotId = optionalString(body?.operationalSlotId);
    if (operationalSlotId) {
      const created = await service.createLeadWithAppointment(user, {
        ...leadInput,
        operationalSlotId,
        allowOverflow: body?.allowOverflow === true,
        appointmentType: optionalString(body?.appointmentType) ?? undefined,
      });
      sendJson(res, 201, created, corsHeaders);
      return;
    }
    const lead = await service.createLead(user, leadInput);
    sendJson(res, 201, { lead }, corsHeaders);
    return;
  }

  const leadMatch = path.match(/^\/api\/v1\/field\/leads\/([^/]+)(?:\/(appointments|notes|bills|activity)(?:\/([^/]+))?)?$/);
  const leadId = leadMatch?.[1] ? decodeURIComponent(leadMatch[1]) : null;
  const leadSubresource = leadMatch?.[2] ?? null;
  const leadSubresourceId = leadMatch?.[3] ? decodeURIComponent(leadMatch[3]) : null;
  if (leadId && req.method === "GET" && !leadSubresource) {
    sendJson(res, 200, await service.getLead(user, leadId), corsHeaders);
    return;
  }
  if (leadId && req.method === "GET" && leadSubresource === "activity") {
    sendJson(res, 200, { activities: await service.activity(user, leadId) }, corsHeaders);
    return;
  }
  if (leadId && req.method === "POST" && leadSubresource === "appointments") {
    const body = await readJson(req);
    const appointment = await service.createAppointment(user, leadId, {
      slotId: optionalString(body?.slotId) ?? undefined,
      operationalSlotId: optionalString(body?.operationalSlotId) ?? undefined,
      allowOverflow: body?.allowOverflow === true,
      appointmentType: optionalString(body?.appointmentType) ?? undefined,
    });
    sendJson(res, 201, { appointment }, corsHeaders);
    return;
  }
  if (leadId && req.method === "POST" && leadSubresource === "notes") {
    const body = await readJson(req);
    const note = await service.addNote(user, leadId, { appointmentId: optionalString(body?.appointmentId), body: requiredString(body?.body, "body") });
    sendJson(res, 201, { note }, corsHeaders);
    return;
  }
  if (leadId && req.method === "POST" && leadSubresource === "bills") {
    const body = await readJson(req, 15 * 1024 * 1024);
    const content = decodeBase64(requiredString(body?.contentBase64, "contentBase64"));
    const bill = await service.addBill(user, leadId, {
      fileName: requiredString(body?.fileName ?? body?.originalFilename, "fileName"),
      mimeType: requiredString(body?.mimeType ?? body?.contentType, "mimeType"), fileSizeBytes: content.byteLength, content,
    });
    sendJson(res, 201, { bill }, corsHeaders);
    return;
  }

  const billDownloadMatch = path.match(/^\/api\/v1\/field\/bills\/([^/]+)\/(download-url|download)$/);
  if (billDownloadMatch?.[1] && billDownloadMatch[2] === "download-url" && req.method === "GET") {
    sendJson(res, 200, { download: await service.createBillDownloadUrl(user, decodeURIComponent(billDownloadMatch[1])) }, corsHeaders);
    return;
  }
  if (billDownloadMatch?.[1] && billDownloadMatch[2] === "download" && req.method === "GET") {
    const downloaded = await service.downloadBill(user, decodeURIComponent(billDownloadMatch[1]), url.searchParams.get("token"));
    res.writeHead(200, {
      "content-type": downloaded.bill.mimeType,
      "content-length": String(downloaded.content.byteLength),
      "content-disposition": `inline; filename="${safeDownloadFileName(downloaded.bill.fileName)}"`,
      "cache-control": "private, no-store, max-age=0",
      ...corsHeaders,
    });
    res.end(downloaded.content);
    return;
  }

  if (req.method === "GET" && path === "/api/v1/field/follow-ups") {
    sendJson(res, 200, { followUps: await service.listFollowUps(user) }, corsHeaders);
    return;
  }
  if (req.method === "POST" && path === "/api/v1/field/follow-ups") {
    const body = await readJson(req);
    const followUp = await service.createFollowUp(user, requiredString(body?.leadId, "leadId"), {
      dueAt: requiredString(body?.dueAt, "dueAt"),
      reason: requiredString(body?.reason, "reason"),
      note: optionalString(body?.note) ?? undefined,
    });
    sendJson(res, 201, { followUp }, corsHeaders);
    return;
  }
  const followUpMatch = path.match(/^\/api\/v1\/field\/follow-ups\/([^/]+)(?:\/(snooze|complete|cancel|convert))?$/);
  const followUpId = followUpMatch?.[1] ? decodeURIComponent(followUpMatch[1]) : null;
  const followUpAction = followUpMatch?.[2] ?? null;
  if (followUpId && req.method === "GET" && !followUpAction) {
    sendJson(res, 200, { followUp: await service.getFollowUp(user, followUpId) }, corsHeaders);
    return;
  }
  if (followUpId && req.method === "POST" && followUpAction === "snooze") {
    const body = await readJson(req);
    const followUp = await service.updateFollowUp(user, followUpId, { status: "SNOOZED", dueAt: requiredString(body?.dueAt, "dueAt") });
    sendJson(res, 200, { followUp }, corsHeaders);
    return;
  }
  if (followUpId && req.method === "POST" && (followUpAction === "complete" || followUpAction === "cancel")) {
    const status: FieldFollowUpStatus = followUpAction === "complete" ? "DONE" : "CANCELLED";
    const followUp = await service.updateFollowUp(user, followUpId, { status });
    sendJson(res, 200, { followUp }, corsHeaders);
    return;
  }
  if (followUpId && req.method === "POST" && followUpAction === "convert") {
    const body = await readJson(req);
    const converted = await service.convertFollowUp(user, followUpId, {
      slotId: optionalString(body?.slotId) ?? undefined,
      operationalSlotId: optionalString(body?.operationalSlotId) ?? undefined,
      allowOverflow: body?.allowOverflow === true,
    }, optionalString(body?.appointmentType) ?? undefined);
    sendJson(res, 200, converted, corsHeaders);
    return;
  }

  if (req.method === "GET" && path === "/api/v1/field/availability") {
    const from = url.searchParams.get("from") ?? startOfToday();
    const to = url.searchParams.get("to") ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    sendJson(res, 200, { slots: await service.listAvailability(user, from, to) }, corsHeaders);
    return;
  }
  if (req.method === "GET" && path === "/api/v1/field/operational-slots") {
    const from = url.searchParams.get("from") ?? startOfToday();
    const to = url.searchParams.get("to") ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    sendJson(res, 200, { slots: await service.listOperationalSlots(user, from, to) }, corsHeaders);
    return;
  }
  if (req.method === "GET" && path === "/api/v1/field/operational-slot-definitions") {
    sendJson(res, 200, { definitions: await service.listOperationalSlotDefinitions(user) }, corsHeaders);
    return;
  }
  const slotDefinitionMatch = path.match(/^\/api\/v1\/field\/operational-slot-definitions\/([^/]+)$/);
  if (slotDefinitionMatch?.[1] && req.method === "PATCH") {
    const body = await readJson(req);
    const definition = await service.updateOperationalSlotDefinition(user, decodeURIComponent(slotDefinitionMatch[1]), requiredNumber(body?.standardCapacity, "standardCapacity"), parseOverflowPolicy(body?.overflowPolicy));
    sendJson(res, 200, { definition }, corsHeaders);
    return;
  }
  if (req.method === "GET" && path === "/api/v1/field/closers") {
    sendJson(res, 200, { closers: await service.listEligibleClosers(user) }, corsHeaders);
    return;
  }
  if (req.method === "POST" && path === "/api/v1/field/availability") {
    const body = await readJson(req);
    const slot = await service.createAvailability(user, {
      closerId: requiredString(body?.closerId, "closerId"), slotStart: requiredString(body?.slotStart, "slotStart"), slotEnd: requiredString(body?.slotEnd, "slotEnd"),
      timezone: optionalString(body?.timezone) ?? undefined, capacity: body?.capacity === undefined ? undefined : requiredNumber(body.capacity, "capacity"), note: optionalString(body?.note),
    });
    sendJson(res, 201, { slot }, corsHeaders);
    return;
  }

  if (req.method === "GET" && path === "/api/v1/field/appointments") {
    sendJson(res, 200, { appointments: await service.listAppointments(user) }, corsHeaders);
    return;
  }
  const appointmentMatch = path.match(/^\/api\/v1\/field\/appointments\/([^/]+)(?:\/(assign|outcome|available-closers|cancel|reschedule))?$/);
  const appointmentId = appointmentMatch?.[1] ? decodeURIComponent(appointmentMatch[1]) : null;
  const appointmentAction = appointmentMatch?.[2] ?? null;
  if (appointmentId && req.method === "GET" && !appointmentAction) {
    sendJson(res, 200, await service.getAppointment(user, appointmentId), corsHeaders);
    return;
  }
  if (appointmentId && req.method === "GET" && appointmentAction === "available-closers") {
    sendJson(res, 200, { closers: await service.listAvailableClosers(user, appointmentId) }, corsHeaders);
    return;
  }
  if (appointmentId && req.method === "POST" && appointmentAction === "assign") {
    const body = await readJson(req);
    const appointment = await service.assignAppointment(user, appointmentId, requiredString(body?.closerId, "closerId"));
    sendJson(res, 200, { appointment }, corsHeaders);
    return;
  }
  if (appointmentId && req.method === "POST" && appointmentAction === "outcome") {
    const body = await readJson(req);
    const outcome = parseAppointmentOutcome(body?.outcome);
    const status = body?.status === undefined ? undefined : parseAppointmentStatus(body.status);
    const appointment = await service.recordOutcome(user, appointmentId, { outcome, status, outcomeNotes: optionalString(body?.outcomeNotes) });
    sendJson(res, 200, { appointment }, corsHeaders);
    return;
  }
  if (appointmentId && req.method === "POST" && appointmentAction === "cancel") {
    const body = await readJson(req);
    const appointment = await service.cancelAppointment(user, appointmentId, requiredString(body?.cancelReason, "cancelReason"));
    sendJson(res, 200, { appointment }, corsHeaders);
    return;
  }
  if (appointmentId && req.method === "POST" && appointmentAction === "reschedule") {
    const body = await readJson(req);
    const appointment = await service.rescheduleAppointment(user, appointmentId, requiredString(body?.operationalSlotId, "operationalSlotId"), body?.allowOverflow === true);
    sendJson(res, 200, { appointment }, corsHeaders);
    return;
  }
  if (req.method === "GET" && path === "/api/v1/field/reports") {
    sendJson(res, 200, await service.report(user), corsHeaders);
    return;
  }
  sendJson(res, 404, { error: "Field operations endpoint not found." }, corsHeaders);
}

function toTeamResponse(member: TeamMemberRecord): Record<string, unknown> {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    displayName: `${member.firstName} ${member.lastName}`.trim(),
    email: member.email,
    phone: member.phone,
    active: member.active,
    roles: member.roles,
    permissions: member.permissions,
    teamIds: member.teamIds,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    lastLoginAt: member.lastLoginAt,
    mustChangePassword: Boolean(member.mustChangePassword),
  };
}

function canSeeTeamMember(user: AuthenticatedPlatformUser, member: { teamIds: string[] }): boolean {
  if (!isManagerOnly(user)) return true;
  return member.teamIds.some((teamId) => user.teamIds.includes(teamId));
}

function assertTeamMemberScope(user: AuthenticatedPlatformUser, member: { teamIds: string[] }): void {
  if (isManagerOnly(user) && !canSeeTeamMember(user, member)) {
    throw new PlatformHttpError(403, "You cannot manage a user outside your team.", "TEAM_SCOPE_FORBIDDEN");
  }
}

function isManagerOnly(user: AuthenticatedPlatformUser): boolean {
  return user.roles.includes(PlatformRole.MANAGER) && !user.roles.includes(PlatformRole.ADMIN) && !user.roles.includes(PlatformRole.SUPER_ADMIN) && !user.permissions.includes("system:manage");
}

function parseTeamIds(value: unknown, user: AuthenticatedPlatformUser): string[] {
  const teamIds = value === undefined ? user.teamIds : value;
  if (!Array.isArray(teamIds) || teamIds.some((teamId) => typeof teamId !== "string" || !isUuid(teamId))) {
    throw new PlatformHttpError(400, "teamIds must contain valid team identifiers.", "VALIDATION_FAILED");
  }
  const unique = [...new Set(teamIds as string[])];
  if (!user.permissions.includes("*" as PlatformPermission) && unique.some((teamId) => !user.teamIds.includes(teamId))) {
    throw new PlatformHttpError(403, "You cannot assign a user outside your team scope.", "TEAM_SCOPE_FORBIDDEN");
  }
  return unique;
}

function formatInvite(invite: { token: string; expiresAt: string } | null): Record<string, string> | null {
  if (!invite) return null;
  return {
    token: invite.token,
    expiresAt: invite.expiresAt,
  };
}

function enforceApiPermission(req: http.IncomingMessage, url: URL, user: AuthenticatedPlatformUser): void {
  const path = url.pathname;
  if (path === "/api/v1/capabilities" || path.startsWith("/api/v1/locations/")) return;
  if (path.includes("/analysis-debug")) {
    requirePermission(user, "system:manage");
    return;
  }
  if (path.startsWith("/api/v1/team") || path.startsWith("/api/v1/users")) {
    requirePermission(user, "team:view");
    return;
  }
  if (path.startsWith("/api/v1/field/")) return;
  if (path.startsWith("/api/v1/intelligence/")) {
    if (req.method === "POST" && path === "/api/v1/intelligence/uploads") {
      requirePermission(user, "territory:manage");
      return;
    }
    requireAnyPermission(user, ["analytics:view", "reports:view", "territory:view"]);
    return;
  }
  if (path.startsWith("/api/v1/markets")) {
    requireAnyPermission(user, ["territory:view", "labs:view"]);
    return;
  }
  if (path.startsWith("/api/v1/neighborhoods") || path.startsWith("/api/v1/discovery")) {
    requireAnyPermission(user, ["labs:view", "lead:create", "lead:view-own", "lead:view-team", "lead:view-all"]);
    return;
  }
  if (req.method === "POST" && path.endsWith("/analyze")) {
    requireAnyPermission(user, ["labs:view", "lead:create", "lead:view-team", "lead:view-all"]);
    return;
  }
  if (path.startsWith("/api/v1/properties") || path.startsWith("/api/v1/leads") || path.startsWith("/api/v1/lead-outcomes") || path.startsWith("/api/v1/revenue") || path.startsWith("/api/v1/dashboard") || path.startsWith("/api/v1/routes")) {
    requireAnyPermission(user, ["lead:view-own", "lead:view-assigned", "lead:view-team", "lead:view-all", "labs:view"]);
  }
}

function isProtectedApiPath(path: string): boolean {
  return path.startsWith("/api/v1/") && !isAuthPath(path) && path !== "/api/v1/capabilities" && !path.startsWith("/api/v1/locations/");
}

function isTeamPath(path: string): boolean {
  const normalized = normalizePlatformPath(path);
  return normalized === "/team" || normalized.startsWith("/team/") || normalized === "/users" || normalized.startsWith("/users/");
}

function isAuthPath(path: string): boolean {
  const normalized = normalizePlatformPath(path);
  return normalized === "/auth" || normalized.startsWith("/auth/");
}

function normalizePlatformPath(path: string): string {
  return path.startsWith("/api/v1") ? path.slice("/api/v1".length) || "/" : path;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new PlatformHttpError(400, `${field} is required.`, "VALIDATION_FAILED");
  return value.trim();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredNumber(value, "number");
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new PlatformHttpError(400, `${field} must be a number.`, "VALIDATION_FAILED");
  return number;
}

function parseOverflowPolicy(value: unknown): "ALLOW_WITH_WARNING" | "BLOCK" {
  if (value === "ALLOW_WITH_WARNING" || value === "BLOCK") return value;
  throw new PlatformHttpError(400, "overflowPolicy must be ALLOW_WITH_WARNING or BLOCK.", "VALIDATION_FAILED");
}

function decodeBase64(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new PlatformHttpError(400, "The uploaded bill is not valid.", "BILL_CONTENT_INVALID");
  }
  const content = Buffer.from(value, "base64");
  if (content.length === 0) throw new PlatformHttpError(400, "The uploaded bill is empty.", "BILL_CONTENT_INVALID");
  return content;
}

function safeDownloadFileName(value: string): string {
  const name = value.replace(/[\\/\r\n"]+/g, "_").trim();
  return name || "utility-bill";
}

function parseAppointmentOutcome(value: unknown): FieldAppointmentOutcome {
  const allowed: FieldAppointmentOutcome[] = ["CLOSED", "SAT_NOT_CLOSED", "DID_NOT_SIT", "CREDIT_FAIL", "NO_SHOW", "NOT_QUALIFIED", "FOLLOW_UP", "RESCHEDULED", "CANCELLED"];
  if (typeof value !== "string" || !allowed.includes(value as FieldAppointmentOutcome)) throw new PlatformHttpError(400, "outcome is invalid.", "VALIDATION_FAILED");
  return value as FieldAppointmentOutcome;
}

function parseAppointmentStatus(value: unknown): FieldAppointmentStatus {
  const allowed: FieldAppointmentStatus[] = ["STARTED", "COMPLETED", "NO_SHOW", "CANCELLED"];
  if (typeof value !== "string" || !allowed.includes(value as FieldAppointmentStatus)) throw new PlatformHttpError(400, "status is invalid.", "VALIDATION_FAILED");
  return value as FieldAppointmentStatus;
}

function startOfToday(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function parseRoles(value: unknown): PlatformRole[] {
  if (!Array.isArray(value)) throw new PlatformHttpError(400, "roles must be an array.", "VALIDATION_FAILED");
  const allowed = new Set(Object.values(PlatformRole));
  const roles = value.filter((role): role is PlatformRole => typeof role === "string" && allowed.has(role as PlatformRole));
  if (roles.length !== value.length) throw new PlatformHttpError(400, "roles contains an unsupported role.", "VALIDATION_FAILED");
  return [...new Set(roles)];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSecureRequest(req: http.IncomingMessage): boolean {
  return process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() !== "false";
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string | string[]> = {}): void {
  res.writeHead(status, { ...jsonHeaders, ...extraHeaders });
  res.end(JSON.stringify(body, null, 2));
}

function normalizeConfirmationAnswer(value: unknown): "YES" | "NO" | "UNKNOWN" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "YES" || normalized === "NO" || normalized === "UNKNOWN") {
    return normalized;
  }
  return undefined;
}

function readJson(req: http.IncomingMessage, maxBytes = 1024 * 1024): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      const buffer = Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > maxBytes) {
        tooLarge = true;
        reject(new PlatformHttpError(413, "Request body is too large.", "REQUEST_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (tooLarge) return;
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
    ...(origin ? { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", vary: "Origin" } : {}),
  };
}

function resolveAllowedOrigins(configuredOrigins: string[] = []): string[] {
  const filtered = configuredOrigins.map((origin) => origin.trim()).filter(Boolean);
  if (filtered.length > 0) {
    return filtered;
  }
  return ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"];
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
      const server = createServer(context.repository, {
        readyCheck: context.readyCheck,
        corsAllowedOrigins: parseCorsOrigins(context.env.corsAllowedOrigins),
        platformRepository: context.platformRepository,
        fieldOperationsRepository: context.fieldOperationsRepository,
        fieldBillStorage: context.fieldBillStorage,
        intelligenceRepository: context.intelligenceRepository,
        authRequired: context.env.authRequired ?? parseBoolean(process.env.AUTH_REQUIRED, true),
      });
      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          console.error(`Port ${port} is already in use. Stop the existing API process or choose another PORT.`);
        } else {
          console.error(error instanceof Error ? error.message : error);
        }
        void context.close().finally(() => {
          process.exitCode = 1;
        });
      });
      server.listen(port, "0.0.0.0", () => {
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
