import { createHash } from "node:crypto";
import XLSX from "xlsx";
import type {
  AppointmentResultCategory,
  NormalizedAppointment,
  ParseWorkbookResult,
  SalesRegion,
} from "@solar/analytics-contracts";
import { normalizeRegion, normalizeStreetLabel, normalizeTerritoryLabel } from "@solar/geo-core";

type Cell = unknown;

const HEADER_ALIASES: Record<string, keyof RawBlock> = {
  time: "time",
  "customer name": "customerName",
  customer: "customerName",
  "phone #": "phone",
  phone: "phone",
  city: "city",
  hood: "hood",
  neighborhood: "hood",
  street: "street",
  address: "street",
  "street address": "street",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  "setter notes": "setterNotes",
  setter: "setter",
  "date set": "dateSet",
  "confirmed?": "confirmed",
  confirmed: "confirmed",
  "bill?": "bill",
  bill: "bill",
  closer: "closer",
  result: "result",
  "closer notes": "closerNotes",
};

interface RawBlock {
  time?: Cell;
  customerName?: Cell;
  phone?: Cell;
  city?: Cell;
  hood?: Cell;
  street?: Cell;
  latitude?: Cell;
  longitude?: Cell;
  setterNotes?: Cell;
  setter?: Cell;
  dateSet?: Cell;
  confirmed?: Cell;
  bill?: Cell;
  closer?: Cell;
  result?: Cell;
  closerNotes?: Cell;
}

interface ParsedBlock {
  startCol: number;
  endCol: number;
  headerRow: number;
  nextHeaderRow: number;
  fieldColumns: Partial<Record<keyof RawBlock, number>>;
  appointmentDate: string | null;
}

export function inferRegionFromFilename(filename: string): SalesRegion {
  const normalized = filename.toLowerCase();
  if (/west/.test(normalized)) return "WEST";
  if (/east|summer|official/.test(normalized)) return "EAST";
  return "UNKNOWN";
}

export function parseWorkbook(
  input: Uint8Array,
  filename: string,
  region: SalesRegion = inferRegionFromFilename(filename),
): ParseWorkbookResult {
  const workbook = XLSX.read(input, { type: "buffer", cellDates: true, cellNF: false, cellText: false });
  const appointments: NormalizedAppointment[] = [];
  const warnings: string[] = [];
  let weeklySheets = 0;
  let blocksScanned = 0;
  let candidateRows = 0;
  let skippedRows = 0;
  const yearHint = inferYearHint(filename, workbook);
  const sheetRows = new Map<string, unknown[][]>();
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    sheetRows.set(sheetName, XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    }) as unknown[][]);
  }
  const weekAnchors = findWeekAnchors(sheetRows, yearHint);

  for (const [sheetName, rows] of sheetRows) {
    const headerRows = findHeaderRows(rows);
    if (headerRows.length === 0) continue;
    weeklySheets += 1;

    const weekNumber = extractWeekNumber(sheetName);
    const fallbackWeekStart = weekNumber == null ? null : weekAnchors.get(weekNumber) ?? null;
    const blocks = buildBlocks(rows, headerRows, yearHint, fallbackWeekStart);
    blocksScanned += blocks.length;
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      const block = blocks[blockIndex];
      const customerColumn = block.fieldColumns.customerName;
      if (customerColumn == null) continue;

      for (let rowIndex = block.headerRow + 1; rowIndex < block.nextHeaderRow; rowIndex += 1) {
        const row = rows[rowIndex] ?? [];
        const customerValue = row[customerColumn];
        const customerName = cleanText(customerValue);
        if (!customerName || isNonAppointmentMarker(customerName)) continue;
        candidateRows += 1;
        const raw = readBlock(row, block.fieldColumns);
        const city = normalizeTerritoryLabel(raw.city);
        const hood = normalizeTerritoryLabel(raw.hood);
        const street = normalizeStreetLabel(raw.street);
        const latitude = parseCoordinate(raw.latitude, -90, 90);
        const longitude = parseCoordinate(raw.longitude, -180, 180);
        const resultRaw = cleanText(raw.result);
        const confirmedRaw = cleanText(raw.confirmed);
        const appointmentDate = block.appointmentDate;
        const dateSet = formatDate(raw.dateSet, yearHint);
        const phone = normalizePhone(raw.phone);
        const displayName = normalizeDisplayName(customerName) ?? customerName;
        const setter = normalizeDisplayName(cleanText(raw.setter));
        const closer = normalizeDisplayName(cleanText(raw.closer));
        const appointmentTime = normalizeTime(raw.time);
        const dedupeKey = buildDedupeKey({
          region: normalizeRegion(region),
          appointmentDate,
          appointmentTime,
          customerName: displayName,
          phone,
          city,
        });

        appointments.push({
          id: stableId(dedupeKey),
          sourceFile: filename,
          sourceSheet: sheetName,
          sourceRow: rowIndex + 1,
          sourceBlock: blockIndex + 1,
          region: normalizeRegion(region),
          appointmentDate,
          appointmentTime,
          dateSet,
          customerName: displayName,
          phone,
          city,
          hood,
          street,
          latitude,
          longitude,
          setter,
          closer,
          confirmed: parseConfirmed(confirmedRaw),
          confirmedRaw,
          resultRaw,
          resultCategory: normalizeResult(resultRaw),
          setterNotes: cleanText(raw.setterNotes),
          closerNotes: cleanText(raw.closerNotes),
          dedupeKey,
          raw: {
            time: raw.time ?? null,
            customerName: raw.customerName ?? null,
            phone: raw.phone ?? null,
            city: raw.city ?? null,
            hood: raw.hood ?? null,
            street: raw.street ?? null,
            latitude: raw.latitude ?? null,
            longitude: raw.longitude ?? null,
            setterNotes: raw.setterNotes ?? null,
            setter: raw.setter ?? null,
            dateSet: raw.dateSet ?? null,
            confirmed: raw.confirmed ?? null,
            bill: raw.bill ?? null,
            closer: raw.closer ?? null,
            result: raw.result ?? null,
            closerNotes: raw.closerNotes ?? null,
          },
        });
      }
    }
  }

  if (weeklySheets === 0) warnings.push("No weekly schedule blocks were detected in the workbook.");
  if (appointments.some((appointment) => appointment.appointmentDate == null)) {
    warnings.push("Some appointments do not have a schedule date; they remain traceable but are excluded from date momentum.");
  }

  return {
    appointments,
    diagnostics: {
      sourceFile: filename,
      sheetsScanned: workbook.SheetNames.length,
      weeklySheets,
      blocksScanned,
      candidateRows,
      parsedAppointments: appointments.length,
      skippedRows,
      warnings,
    },
  };
}

export function deduplicateAppointments(appointments: NormalizedAppointment[]): {
  appointments: NormalizedAppointment[];
  duplicateRows: number;
} {
  const byKey = new Map<string, NormalizedAppointment>();
  let duplicateRows = 0;
  for (const appointment of appointments) {
    const existing = byKey.get(appointment.dedupeKey);
    if (!existing) {
      byKey.set(appointment.dedupeKey, appointment);
      continue;
    }
    duplicateRows += 1;
    if (richness(appointment) > richness(existing)) byKey.set(appointment.dedupeKey, appointment);
  }
  return { appointments: [...byKey.values()], duplicateRows };
}

export function normalizeResult(value: string | null): AppointmentResultCategory {
  const result = (value ?? "").toLowerCase().replace(/[–—]/g, "-");
  if (!result) return "UNKNOWN";
  if (/\bclosed\b|signed\s+docs|\bsold\b/.test(result)) return "CLOSED";
  if (/credit\s*fail|bad\s*credit|credit\s*issue/.test(result)) return "CREDIT_FAIL";
  if (/did\s*not\s*close|dnc/.test(result)) return "DID_NOT_CLOSE";
  if (/did\s*not\s*sit|\bdq\b|cancel|no\s*show|no-show/.test(result)) return "CANCELLED_DQ";
  if (/resched|follow\s*up|pending/.test(result)) return "RESCHEDULED";
  return "UNKNOWN";
}

export function parseConfirmed(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (/^yes\b|confirmed|triple/.test(normalized)) return true;
  if (/^no\b|not confirmed/.test(normalized)) return false;
  return null;
}

function findHeaderRows(rows: unknown[][]): number[] {
  const headers: number[] = [];
  rows.forEach((row, rowIndex) => {
    const values = row.map((value) => normalizeHeader(value));
    if (values.includes("time") && values.includes("customer name")) headers.push(rowIndex);
  });
  return headers;
}

function buildBlocks(rows: unknown[][], headerRows: number[], yearHint: number, fallbackWeekStart: string | null): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  for (const headerRow of headerRows) {
    const row = rows[headerRow] ?? [];
    const starts = row
      .map((value, column) => (normalizeHeader(value) === "time" ? column : -1))
      .filter((column) => column >= 0);
    const nextHeaderRow = headerRows.find((candidate) => candidate > headerRow) ?? rows.length;
    for (let index = 0; index < starts.length; index += 1) {
      const startCol = starts[index]!;
      const endCol = (starts[index + 1] ?? row.length) - 1;
      const fieldColumns: Partial<Record<keyof RawBlock, number>> = {};
      for (let column = startCol; column <= endCol; column += 1) {
        const alias = HEADER_ALIASES[normalizeHeader(row[column])];
        if (alias && fieldColumns[alias] == null) fieldColumns[alias] = column;
      }
      blocks.push({
        startCol,
        endCol,
        headerRow,
        nextHeaderRow,
        fieldColumns,
        appointmentDate: findAppointmentDate(rows, headerRow, startCol, endCol, yearHint, fallbackWeekStart ? addDays(fallbackWeekStart, index) : null),
      });
    }
  }
  return blocks;
}

function findAppointmentDate(rows: unknown[][], headerRow: number, startCol: number, endCol: number, yearHint: number, fallbackDate: string | null): string | null {
  for (let rowIndex = headerRow - 1; rowIndex >= Math.max(0, headerRow - 3); rowIndex -= 1) {
    for (let column = startCol; column <= endCol; column += 1) {
      const parsed = formatDate(rows[rowIndex]?.[column], yearHint);
      if (parsed) return parsed;
    }
  }
  return fallbackDate;
}

function findWeekAnchors(sheetRows: Map<string, unknown[][]>, yearHint: number): Map<number, string> {
  const anchors = new Map<number, string>();
  for (const [sheetName, rows] of sheetRows) {
    const weekNumber = extractWeekNumber(sheetName);
    if (weekNumber == null) continue;
    const explicit = findExplicitWeekStart(rows, yearHint);
    if (explicit) anchors.set(weekNumber, explicit);
  }
  const known = [...anchors.entries()];
  for (const [sheetName] of sheetRows) {
    const weekNumber = extractWeekNumber(sheetName);
    if (weekNumber == null || anchors.has(weekNumber) || known.length === 0) continue;
    const nearest = known.reduce((best, candidate) => Math.abs(candidate[0] - weekNumber) < Math.abs(best[0] - weekNumber) ? candidate : best);
    anchors.set(weekNumber, addDays(nearest[1], (weekNumber - nearest[0]) * 7));
  }
  return anchors;
}

function findExplicitWeekStart(rows: unknown[][], yearHint: number): string | null {
  const candidates: string[] = [];
  for (const row of rows.slice(0, 3)) {
    for (const value of row) {
      const parsed = formatDate(value, yearHint);
      if (parsed) candidates.push(parsed);
    }
  }
  return candidates.sort()[0] ?? null;
}

function extractWeekNumber(sheetName: string): number | null {
  const match = sheetName.match(/\bweek\s*(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readBlock(row: unknown[], fieldColumns: Partial<Record<keyof RawBlock, number>>): RawBlock {
  const raw: RawBlock = {};
  for (const key of Object.keys(fieldColumns) as Array<keyof RawBlock>) {
    const column = fieldColumns[key];
    if (column != null) raw[key] = row[column];
  }
  return raw;
}

function normalizeHeader(value: unknown): string {
  return cleanText(value)?.toLowerCase().replace(/\s+/g, " ") ?? "";
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).normalize("NFKC").replace(/[\u00a0\u200b]/g, " ").trim().replace(/\s+/g, " ");
  return text ? text : null;
}

function normalizeDisplayName(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhone(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max) return value;
  const text = cleanText(value);
  if (!text) return null;
  const parsed = Number(text.replace(/[^0-9+-.]/g, ""));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function normalizeTime(value: unknown): string | null {
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return cleanText(value);
}

function formatDate(value: unknown, yearHint: number): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime()) && value.getUTCFullYear() >= 2000 && value.getUTCFullYear() <= 2100) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = XLSX.SSF.parse_date_code(value);
    if (date?.y && date.y >= 2000 && date?.m && date?.d) return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  const text = cleanText(value);
  if (!text) return null;
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso && Number(iso[2]) <= 12 && Number(iso[3]) <= 31) return `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
  const shortYear = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (shortYear) {
    const first = Number(shortYear[1]);
    const second = Number(shortYear[2]);
    const year = Number(shortYear[3]) + 2000;
    if (first > 12 && second <= 12) return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    if (first <= 12 && second <= 31) return `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
  }
  const monthDay = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (monthDay) {
    const first = Number(monthDay[1]);
    const second = Number(monthDay[2]);
    if (first > 12 && second <= 12) return `${yearHint}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
    if (first <= 12 && second <= 31) return `${yearHint}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
  }
  return null;
}

function inferYearHint(filename: string, workbook: XLSX.WorkBook): number {
  const filenameYear = filename.match(/\b(20\d{2})\b/);
  if (filenameYear) return Number(filenameYear[1]);
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: null, blankrows: false }) as unknown[][];
    for (const row of values.slice(0, 5)) {
      for (const value of row) {
        const match = String(value ?? "").match(/\b(20\d{2})\b/);
        if (match) return Number(match[1]);
      }
    }
  }
  return new Date().getUTCFullYear();
}

function isNonAppointmentMarker(value: string): boolean {
  return /^(customer name|↳\s*overflow|do not fill on black|template)$/i.test(value);
}

function buildDedupeKey(input: {
  region: SalesRegion;
  appointmentDate: string | null;
  appointmentTime: string | null;
  customerName: string;
  phone: string | null;
  city: string | null;
}): string {
  const identity = input.phone ?? input.customerName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [input.region, input.appointmentDate ?? "unknown-date", identity, (input.city ?? "unknown-city").toLowerCase(), input.appointmentTime ?? "unknown-time"].join("|");
}

function stableId(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function richness(appointment: NormalizedAppointment): number {
  return Object.values(appointment).filter((value) => value != null && value !== "" && value !== "UNKNOWN").length;
}
