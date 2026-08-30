import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import XLSX from "xlsx";
import type { NormalizedAppointment } from "@solar/analytics-contracts";
import { buildDashboard, buildTerritoryDrilldown, deduplicateAppointments, normalizeResult, parseWorkbook } from "./index";

test("parses the supplied East and West schedule workbooks across repeated day blocks", async () => {
  const east = parseWorkbook(await readFile("data/Official Summer Schedule 2026.xlsx"), "Official Summer Schedule 2026.xlsx");
  const west = parseWorkbook(await readFile("data/WEST SCHEDULE OFFICIAL.xlsx"), "WEST SCHEDULE OFFICIAL.xlsx");

  assert.equal(east.diagnostics.weeklySheets > 0, true);
  assert.equal(west.diagnostics.weeklySheets > 0, true);
  assert.equal(east.appointments.length > 1000, true);
  assert.equal(west.appointments.length > 1000, true);
  assert.equal(east.appointments.some((appointment) => appointment.resultCategory === "CLOSED"), true);
  assert.equal(west.appointments.some((appointment) => appointment.resultCategory === "CANCELLED_DQ"), true);
  assert.equal(west.appointments.some((appointment) => appointment.appointmentDate?.startsWith("2026-08")), true);
});

test("normalizes outcome variants and removes duplicate schedule rows", () => {
  assert.equal(normalizeResult("Closed"), "CLOSED");
  assert.equal(normalizeResult("Did Not Sit/Reschedule/DQ"), "CANCELLED_DQ");
  assert.equal(normalizeResult("Credit Fail"), "CREDIT_FAIL");
  assert.equal(normalizeResult("Did Not Close"), "DID_NOT_CLOSE");

  const duplicateKey = "EAST|2026-08-01|7245550100|uniontown|10:00 AM";
  const original = appointment({ phone: "724-555-0100", dedupeKey: duplicateKey, resultCategory: "CLOSED", closerNotes: null });
  const richerDuplicate = appointment({ phone: "7245550100", dedupeKey: duplicateKey, resultCategory: "CLOSED", closerNotes: "signed docs" });
  const separateRevisit = appointment({ phone: "724-555-0100", appointmentDate: "2026-08-02", resultCategory: "DID_NOT_CLOSE" });
  const result = deduplicateAppointments([original, richerDuplicate, separateRevisit]);

  assert.equal(result.appointments.length, 2);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.appointments.some((item) => item.closerNotes === "signed docs"), true);
});

test("inherits a time block across blank and overflow spreadsheet rows", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Monday · Mon 08/31"],
    ["Time", "Customer Name", "Phone #"],
    ["2:00 PM", "Sarah & Dave", "724-555-0101"],
    [null, "Sierra Lockhart", "724-555-0102"],
    ["↳ overflow", "Homeowner #3", "724-555-0103"],
    ["4:00 PM", "Taylor Smith", "724-555-0104"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Week 1");

  const result = parseWorkbook(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }), "schedule 2026.xlsx");
  assert.deepEqual(result.appointments.map((appointment) => appointment.appointmentTime), ["2:00 PM", "2:00 PM", "2:00 PM", "4:00 PM"]);
  assert.equal(result.appointments.every((appointment) => appointment.appointmentDate === "2026-08-31"), true);
});

test("dashboard metrics, momentum, rankings, and trace ids are deterministic", () => {
  const appointments = [
    appointment({ appointmentDate: "2026-08-01", resultCategory: "DID_NOT_CLOSE" }),
    appointment({ appointmentDate: "2026-08-02", resultCategory: "CLOSED" }),
    appointment({ appointmentDate: "2026-08-03", resultCategory: "CLOSED" }),
    appointment({ appointmentDate: "2026-08-04", resultCategory: "CANCELLED_DQ" }),
    appointment({ appointmentDate: "2026-07-10", resultCategory: "DID_NOT_CLOSE" }),
  ];
  const dashboard = buildDashboard(appointments);

  assert.equal(dashboard.metrics.totalSets, 5);
  assert.equal(dashboard.metrics.sits, 4);
  assert.equal(dashboard.metrics.closes, 2);
  assert.equal(dashboard.metrics.cancellationDq, 1);
  assert.equal(dashboard.metrics.traceAppointmentIds.length, 5);
  assert.equal(dashboard.momentum[0]?.direction, "HEATING_UP");
  assert.equal(dashboard.ranking[0]?.opportunityScore != null, true);
  assert.equal(dashboard.ranking[0]?.scoreBreakdown.components.length, 10);
  assert.equal(dashboard.ranking[0]?.confidence, "LOW");
  assert.equal(dashboard.deploymentPlan.recommendations.length, 0);
  assert.equal(dashboard.source.traceEndpoint, "/api/v1/intelligence/appointments");
  assert.equal(dashboard.source.drilldownEndpoint, "/api/v1/intelligence/territories");

  const drilldown = buildTerritoryDrilldown(appointments, { city: "Uniontown" });
  assert.equal(drilldown.nodes[0]?.level, "HOOD");
  assert.equal(drilldown.sourceAppointmentIds.length, 5);
});

function appointment(overrides: Partial<NormalizedAppointment> = {}): NormalizedAppointment {
  const date = overrides.appointmentDate ?? "2026-08-01";
  const phone = overrides.phone ?? "724-555-0199";
  const dedupeKey = overrides.dedupeKey ?? `EAST|${date}|${phone}|Uniontown|10:00 AM`;
  return {
    id: overrides.id ?? `id-${date}-${overrides.resultCategory ?? "DID_NOT_CLOSE"}-${Math.random()}`,
    sourceFile: "test.xlsx",
    sourceSheet: "Week 1",
    sourceRow: 4,
    sourceBlock: 1,
    region: "EAST",
    appointmentDate: date,
    appointmentTime: "10:00 AM",
    dateSet: date,
    customerName: "Test Customer",
    phone,
    city: "Uniontown",
    hood: null,
    street: null,
    latitude: null,
    longitude: null,
    setter: "Setter One",
    closer: "Closer One",
    confirmed: true,
    confirmedRaw: "Yes",
    resultRaw: overrides.resultCategory ?? "Did Not Close",
    resultCategory: overrides.resultCategory ?? "DID_NOT_CLOSE",
    setterNotes: null,
    closerNotes: overrides.closerNotes ?? null,
    dedupeKey,
    raw: {},
    ...overrides,
  };
}
