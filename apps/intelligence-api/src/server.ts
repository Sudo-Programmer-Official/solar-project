import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { buildDatabaseUrl, loadAppEnv } from "../../../packages/config/src/index";
import { createPostgresClient, runDatabaseMigrations, wrapPool } from "../../../packages/database/src/index";
import type { IntelligenceFilters } from "../../../packages/analytics-contracts/src/index";
import { normalizeRegion } from "../../../packages/geo-core/src/index";
import {
  buildDashboard,
  buildTerritoryDrilldown,
  inferRegionFromFilename,
  InMemoryIntelligenceRepository,
  parseWorkbook,
  PostgresIntelligenceRepository,
} from "../../../packages/territory-scoring/src/index";
import type { IntelligenceRepository } from "../../../packages/territory-scoring/src/index";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-file-name",
};

export interface IntelligenceServerOptions {
  readyCheck?: () => Promise<void>;
}

export function createIntelligenceServer(
  repository: IntelligenceRepository,
  corsAllowedOrigins?: string[],
  options: IntelligenceServerOptions = {},
): http.Server {
  const allowedOrigins = corsAllowedOrigins ?? ["http://localhost:5174", "http://127.0.0.1:5174"];
  return http.createServer(async (request, response) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : null;
    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : null;
    const corsHeaders: Record<string, string> = corsOrigin ? { "access-control-allow-origin": corsOrigin, vary: "Origin" } : {};
    if (request.method === "OPTIONS") {
      response.writeHead(204, { ...jsonHeaders, ...corsHeaders });
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    try {
      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, { status: "ok", service: "territory-intelligence-api" }, corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === "/ready") {
        try {
          if (!options.readyCheck) throw new Error("Database readiness is not configured.");
          await options.readyCheck();
          sendJson(response, 200, { status: "ready", database: "connected" }, corsHeaders);
        } catch {
          sendJson(response, 503, { status: "not_ready", database: "disconnected" }, corsHeaders);
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/v1/intelligence/uploads") {
        const body = await readRequestBody(request);
        const file = extractUpload(body, request.headers["content-type"], request.headers["x-file-name"]);
        if (!file) {
          sendJson(response, 400, { error: "Upload an .xlsx file as multipart field 'file' or as the request body." }, corsHeaders);
          return;
        }
        const filename = safeFilename(file.filename);
        const region = normalizeRegion(url.searchParams.get("region") ?? inferRegionFromFilename(filename));
        const fileSha256 = createHash("sha256").update(file.data).digest("hex");
        const existing = await repository.getUploadByHash(fileSha256);
        if (existing && existing.status === "COMPLETED" && (existing.parsedRows === 0 || existing.insertedRows > 0)) {
          sendJson(response, 200, {
            uploadId: existing.id,
            filename: existing.filename,
            region: existing.region,
            parsedRows: 0,
            insertedRows: 0,
            duplicateRows: 0,
            alreadyImported: true,
            diagnostics: { sourceFile: existing.filename, warnings: ["This file hash has already been imported."] },
          }, corsHeaders);
          return;
        }

        const parsed = parseWorkbook(file.data, filename, region);
        const uploadId = existing?.id ?? randomUUID();
        await repository.createUpload({
          id: uploadId,
          filename,
          region,
          fileSha256,
          status: "PROCESSING",
          parsedRows: parsed.appointments.length,
          insertedRows: 0,
          duplicateRows: 0,
          diagnostics: parsed.diagnostics,
        });
        await repository.insertAppointments(uploadId, parsed.appointments);
        const storedRows = await repository.countAppointmentsForUpload(uploadId);
        await repository.createUpload({
          id: uploadId,
          filename,
          region,
          fileSha256,
          status: "COMPLETED",
          parsedRows: parsed.appointments.length,
          insertedRows: storedRows,
          duplicateRows: parsed.appointments.length - storedRows,
          diagnostics: parsed.diagnostics,
        });
        await repository.rebuildAnalytics();
        sendJson(response, 201, {
          uploadId,
          filename,
          region,
          parsedRows: parsed.appointments.length,
          insertedRows: storedRows,
          duplicateRows: parsed.appointments.length - storedRows,
          diagnostics: parsed.diagnostics,
        }, corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/intelligence/dashboard") {
        const filters = parseFilters(url.searchParams);
        const { appointments } = await repository.listAppointments(filters);
        sendJson(response, 200, buildDashboard(appointments, filters), corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/intelligence/appointments") {
        const filters = parseFilters(url.searchParams);
        const { appointments } = await repository.listAppointments(filters);
        const offset = positiveInt(url.searchParams.get("offset"), 0);
        const limit = Math.min(positiveInt(url.searchParams.get("limit"), 100), 500);
        sendJson(response, 200, { appointments: appointments.slice(offset, offset + limit), total: appointments.length, offset, limit }, corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/intelligence/territories") {
        const filters = parseFilters(url.searchParams);
        const { appointments } = await repository.listAppointments(filters);
        sendJson(response, 200, buildTerritoryDrilldown(appointments, filters), corsHeaders);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/intelligence/filters") {
        const { appointments } = await repository.listAppointments();
        sendJson(response, 200, {
          regions: [...new Set(appointments.map((appointment) => appointment.region))].sort(),
          cities: [...new Set(appointments.map((appointment) => appointment.city).filter((city): city is string => Boolean(city)))].sort(),
          hoods: [...new Set(appointments.map((appointment) => appointment.hood).filter((hood): hood is string => Boolean(hood)))].sort(),
          streets: [...new Set(appointments.map((appointment) => appointment.street).filter((street): street is string => Boolean(street)))].sort(),
          setters: [...new Set(appointments.map((appointment) => appointment.setter).filter((setter): setter is string => Boolean(setter)))].sort(),
          closers: [...new Set(appointments.map((appointment) => appointment.closer).filter((closer): closer is string => Boolean(closer)))].sort(),
        }, corsHeaders);
        return;
      }

      sendJson(response, 404, { error: "Not found" }, corsHeaders);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected intelligence API error";
      sendJson(response, 500, { error: message }, corsHeaders);
    }
  });
}

async function start(): Promise<void> {
  const env = loadAppEnv();
  let pool: Awaited<ReturnType<typeof createPostgresClient>> | null = null;
  let repository: IntelligenceRepository;
  let readyCheck: () => Promise<void>;
  try {
    const databaseUrl = buildDatabaseUrl(env);
    if (!databaseUrl) throw new Error("DATABASE_URL or DATABASE_HOST/DATABASE_NAME/DATABASE_USER is required.");
    pool = await createPostgresClient(databaseUrl);
    if (process.env.INTELLIGENCE_AUTO_MIGRATE !== "false") await runDatabaseMigrations(pool);
    repository = new PostgresIntelligenceRepository(wrapPool(pool));
    readyCheck = async () => {
      await pool?.query("SELECT 1");
    };
  } catch (error) {
    const fallbackAllowed = process.env.NODE_ENV !== "production" && process.env.INTELLIGENCE_LOCAL_FALLBACK !== "false";
    if (!fallbackAllowed) throw error;
    await pool?.end?.();
    console.warn(`Territory intelligence database unavailable; using local development fallback. ${error instanceof Error ? error.message : "Unknown database error"}`);
    repository = await seedLocalRepository();
    readyCheck = async () => undefined;
  }
  const port = Number(process.env.INTELLIGENCE_API_PORT ?? 4100);
  const server = createIntelligenceServer(repository, parseOrigins(env.corsAllowedOrigins), { readyCheck });
  server.listen(port, "0.0.0.0", () => console.log(`Territory intelligence API listening on 0.0.0.0:${port}`));
  const close = async () => {
    server.close();
    await pool?.end?.();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

async function seedLocalRepository(): Promise<InMemoryIntelligenceRepository> {
  const repository = new InMemoryIntelligenceRepository();
  const dataDirectory = await findDataDirectory();
  const files = (await readdir(dataDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.xlsx$/i.test(entry.name))
    .map((entry) => path.join(dataDirectory, entry.name));
  let insertedRows = 0;
  for (const filePath of files) {
    const filename = path.basename(filePath);
    const buffer = await readFile(filePath);
    const parsed = parseWorkbook(buffer, filename, inferRegionFromFilename(filename));
    const uploadId = randomUUID();
    const fileSha256 = createHash("sha256").update(buffer).digest("hex");
    await repository.createUpload({ id: uploadId, filename, region: inferRegionFromFilename(filename), fileSha256, status: "PROCESSING", parsedRows: parsed.appointments.length, insertedRows: 0, duplicateRows: 0, diagnostics: parsed.diagnostics });
    const result = await repository.insertAppointments(uploadId, parsed.appointments);
    insertedRows += result.insertedRows;
    await repository.createUpload({ id: uploadId, filename, region: inferRegionFromFilename(filename), fileSha256, status: "COMPLETED", parsedRows: parsed.appointments.length, insertedRows: result.insertedRows, duplicateRows: result.duplicateRows, diagnostics: parsed.diagnostics });
  }
  await repository.rebuildAnalytics();
  console.warn(`Local development fallback loaded ${insertedRows.toLocaleString()} appointment records from ${files.length} workbook(s).`);
  return repository;
}

async function findDataDirectory(): Promise<string> {
  const candidates = [path.resolve(process.cwd(), "data"), path.resolve(process.cwd(), "../../data"), path.resolve(process.cwd(), "../data")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Local fallback could not find a data/ directory with Excel files.");
}

function parseFilters(searchParams: URLSearchParams): IntelligenceFilters {
  const regionParam = searchParams.get("region");
  const resultParam = searchParams.get("result");
  const region = regionParam ? normalizeRegion(regionParam) : null;
  const validResults = new Set(["CLOSED", "DID_NOT_CLOSE", "CREDIT_FAIL", "CANCELLED_DQ", "RESCHEDULED", "UNKNOWN"]);
  return {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    region: region === "UNKNOWN" && regionParam ? "UNKNOWN" : region,
    city: searchParams.get("city"),
    hood: searchParams.get("hood"),
    street: searchParams.get("street"),
    setter: searchParams.get("setter"),
    closer: searchParams.get("closer"),
    result: resultParam && validResults.has(resultParam) ? resultParam as IntelligenceFilters["result"] : null,
  };
}

function readRequestBody(request: http.IncomingMessage): Promise<Buffer> {
  const maxBytes = 30 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Upload exceeds the 30 MB limit."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export function extractUpload(body: Buffer, contentType: string | undefined, headerFilename: string | string[] | undefined): { filename: string; data: Buffer } | null {
  const type = contentType ?? "";
  if (!type.includes("multipart/form-data")) {
    const filename = typeof headerFilename === "string" ? headerFilename : "schedule.xlsx";
    return body.length > 0 ? { filename, data: body } : null;
  }
  const boundaryMatch = type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) return null;
  const marker = Buffer.from(`--${boundary}`);
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(marker, cursor);
    if (start < 0) break;
    const partStart = start + marker.length;
    if (body.slice(partStart, partStart + 2).toString() === "--") break;
    const headerStart = partStart + 2;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd < 0) break;
    const headers = body.slice(headerStart, headerEnd).toString("utf8");
    const filenameMatch = headers.match(/filename="([^"]*)"/i);
    const dataStart = headerEnd + 4;
    const nextBoundary = body.indexOf(Buffer.from(`\r\n--${boundary}`), dataStart);
    const dataEnd = nextBoundary >= 0 ? nextBoundary : body.length;
    if (filenameMatch && dataEnd > dataStart) return { filename: filenameMatch[1]!, data: body.slice(dataStart, dataEnd) };
    cursor = dataStart;
  }
  return null;
}

function safeFilename(filename: string): string {
  const normalized = filename.replace(/\\/g, "/").split("/").at(-1) ?? "schedule.xlsx";
  return normalized.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "schedule.xlsx";
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseOrigins(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function sendJson(response: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { ...jsonHeaders, ...headers });
  response.end(JSON.stringify(body));
}

if (import.meta.url === `file://${process.argv[1]}`) void start();
