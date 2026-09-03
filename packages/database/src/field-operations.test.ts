import assert from "node:assert/strict";
import test from "node:test";
import { PostgresFieldOperationsRepository, type FieldLead } from "./field-operations";
import type { SqlClient } from "./repository";

test("lead assigned scope uses the lead current_closer_id column", async () => {
  let queryText = "";
  const client: SqlClient = {
    async query<T>(sql: string) {
      queryText = sql;
      return {
        rows: [{
          id: "lead-1", property_id: null, setter_id: "setter-1", current_closer_id: "closer-1", created_by_user_id: "setter-1", team_id: "team-1",
          homeowner_name: "Jordan Miller", phone: null, email: null, address_line1: "1 Sun Street", city: "Pittsburgh", state: "PA", postal_code: "15213",
          latitude: null, longitude: null, utility: null, supplier: null, approximate_monthly_bill: null, qualification_json: {}, status: "APPOINTMENT_SET",
          created_at: new Date("2026-01-01T00:00:00Z"), updated_at: new Date("2026-01-01T00:00:00Z"),
        }] as unknown as T[],
      };
    },
  };

  const leads: FieldLead[] = await new PostgresFieldOperationsRepository(client).listLeads({ userId: "closer-1", teamIds: ["team-1"], scope: "assigned" });
  assert.equal(leads[0]?.currentCloserId, "closer-1");
  assert.match(queryText, /l\.current_closer_id/);
  assert.doesNotMatch(queryText, /l\.closer_id/);
});

test("lead listing returns one API row per canonical lead id", async () => {
  const lead = {
    id: "lead-1", property_id: null, setter_id: "setter-1", current_closer_id: null, created_by_user_id: "setter-1", team_id: "team-1",
    homeowner_name: "Jordan Miller", phone: null, email: null, address_line1: "1 Sun Street", city: "Pittsburgh", state: "PA", postal_code: "15213",
    latitude: null, longitude: null, utility: null, supplier: null, approximate_monthly_bill: null, qualification_json: {}, status: "KNOCKED",
    created_at: new Date("2026-01-01T00:00:00Z"), updated_at: new Date("2026-01-01T00:00:00Z"),
  };
  const client: SqlClient = {
    async query<T>(sql: string) {
      if (!sql.includes("FROM field_ops.leads")) return { rows: [] as T[] };
      return { rows: [lead, lead] as unknown as T[] };
    },
  };

  const leads = await new PostgresFieldOperationsRepository(client).listLeads({ userId: "setter-1", teamIds: ["team-1"], scope: "own" });
  assert.deepEqual(leads.map((item) => item.id), ["lead-1"]);
});

test("QA cleanup deletes only marked field data in dependency order", async () => {
  const statements: string[] = [];
  const client: SqlClient = {
    async query<T>(sql: string) {
      statements.push(sql);
      return { rows: sql.startsWith("DELETE") ? [{ id: "deleted" }] as unknown as T[] : [] as T[] };
    },
  };

  const summary = await new PostgresFieldOperationsRepository(client).cleanTestData();
  assert.deepEqual(summary, {
    leads: 1,
    appointments: 1,
    notes: 1,
    billMetadata: 1,
    activities: 1,
    sheetSyncJobs: 1,
    availabilitySlots: 1,
    followUps: 1,
  });
  assert.deepEqual(statements.map((statement) => statement.match(/field_ops\.([a-z_]+)/)?.[1]), [
    "sheet_sync_jobs", "activities", "bill_attachments", "notes", "follow_up_activities", "follow_ups", "appointments", "operational_slots", "leads", "closer_availability",
  ]);
  assert.ok(statements.filter((statement) => statement.startsWith("DELETE")).every((statement) => statement.includes("is_test_data = TRUE")));
  assert.doesNotMatch(statements.join("\n"), /field_ops\.(users|roles|permissions|user_roles|role_permissions|teams|user_teams)/);
});

test("atomic lead and appointment creation revalidates capacity before inserting the lead", async () => {
  const statements: string[] = [];
  const client: SqlClient = {
    async query<T>(sql: string) {
      statements.push(sql);
      return { rows: [] as T[] };
    },
  };

  const created = await new PostgresFieldOperationsRepository(client).createLeadWithAppointment({
    operationalSlotId: "slot-1",
    setterId: "setter-1",
    createdByUserId: "setter-1",
    homeownerName: "Jordan Miller",
    addressLine1: "1 Sun Street",
  });

  assert.equal(created, null);
  assert.equal(statements.length, 1);
  assert.match(statements[0] ?? "", /UPDATE field_ops\.operational_slots/);
  assert.match(statements[0] ?? "", /booked_count < standard_capacity/);
  assert.doesNotMatch(statements.join("\n"), /INSERT INTO field_ops\.leads/);
});
