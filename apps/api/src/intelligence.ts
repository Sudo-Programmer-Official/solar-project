import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import type { IntelligenceFilters, SalesRegion } from "../../../packages/analytics-contracts/src/index";
import { normalizeRegion } from "../../../packages/geo-core/src/index";
import {
  buildDashboard,
  buildTerritoryDrilldown,
  inferRegionFromFilename,
  parseWorkbook,
  type IntelligenceRepository,
} from "../../../packages/territory-scoring/src/index";

type SendJson = (response: http.ServerResponse, status: number, body: unknown, headers?: Record<string, string | string[]>) => void;

export async function handleIntelligenceRoute(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  url: URL,
  repository: IntelligenceRepository,
  sendJson: SendJson,
  corsHeaders: Record<string, string>,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/v1/intelligence/")) return false;

  if (request.method === "POST" && url.pathname === "/api/v1/intelligence/uploads") {
    const body = await readRequestBody(request);
    const file = extractUpload(body, request.headers["content-type"], request.headers["x-file-name"]);
    if (!file) {
      sendJson(response, 400, { error: "Upload an .xlsx file as multipart field 'file' or as the request body." }, corsHeaders);
      return true;
    }

    const filename = safeFilename(file.filename);
    if (!/\.xlsx$/i.test(filename)) {
      sendJson(response, 400, { error: "Only .xlsx schedule files are supported." }, corsHeaders);
      return true;
    }

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
      return true;
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
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/intelligence/dashboard") {
    const filters = parseFilters(url.searchParams);
    const { appointments } = await repository.listAppointments(filters);
    sendJson(response, 200, buildDashboard(appointments, filters), corsHeaders);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/intelligence/appointments") {
    const filters = parseFilters(url.searchParams);
    const { appointments } = await repository.listAppointments(filters);
    const offset = positiveInt(url.searchParams.get("offset"), 0);
    const limit = Math.min(positiveInt(url.searchParams.get("limit"), 100), 500);
    sendJson(response, 200, { appointments: appointments.slice(offset, offset + limit), total: appointments.length, offset, limit }, corsHeaders);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/v1/intelligence/territories") {
    const filters = parseFilters(url.searchParams);
    const { appointments } = await repository.listAppointments(filters);
    sendJson(response, 200, buildTerritoryDrilldown(appointments, filters), corsHeaders);
    return true;
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
    return true;
  }

  sendJson(response, 404, { error: "Intelligence endpoint not found." }, corsHeaders);
  return true;
}

export function extractUpload(
  body: Buffer,
  contentType: string | undefined,
  headerFilename: string | string[] | undefined,
): { filename: string; data: Buffer } | null {
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
    if (filenameMatch && dataEnd > dataStart) {
      return { filename: filenameMatch[1]!, data: body.slice(dataStart, dataEnd) };
    }
    cursor = dataStart;
  }
  return null;
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
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 30 * 1024 * 1024) {
        reject(new Error("Upload exceeds the 30 MB limit."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function safeFilename(filename: string): string {
  const normalized = filename.replace(/\\/g, "/").split("/").at(-1) ?? "schedule.xlsx";
  return normalized.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "schedule.xlsx";
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
