import { randomUUID } from "node:crypto";
import type { SqlClient } from "./repository";

export type FieldLeadStatus =
  | "KNOCKED" | "INTERESTED" | "FOLLOW_UP" | "APPOINTMENT_SET" | "NO_SHOW"
  | "SAT" | "PROPOSAL" | "CLOSED" | "NOT_INTERESTED" | "NOT_QUALIFIED" | "CANCELLED";
export type FieldAppointmentStatus = "UNASSIGNED" | "ASSIGNED" | "STARTED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "RESCHEDULED" | "SCHEDULED";
export type FieldAppointmentOutcome = "NO_SHOW" | "SAT" | "PROPOSAL" | "CLOSED" | "FOLLOW_UP" | "NOT_QUALIFIED" | "NOT_INTERESTED" | "CANCELLED";
export type FieldListScope = "all" | "team" | "own" | "assigned" | "own-or-assigned";

export interface FieldLead {
  id: string;
  propertyId: string | null;
  setterId: string | null;
  currentCloserId: string | null;
  createdByUserId: string | null;
  teamId: string | null;
  homeownerName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  utility: string | null;
  supplier: string | null;
  approximateMonthlyBill: number | null;
  qualification: unknown;
  status: FieldLeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FieldAppointment {
  id: string;
  leadId: string;
  setterId: string | null;
  closerId: string | null;
  teamId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  appointmentType: string;
  status: FieldAppointmentStatus;
  outcome: FieldAppointmentOutcome | null;
  outcomeNotes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldAvailabilitySlot {
  id: string;
  closerId: string;
  closerName: string;
  slotStart: string;
  slotEnd: string;
  timezone: string;
  capacity: number;
  bookedCount: number;
  status: "AVAILABLE" | "BLOCKED" | "BOOKED";
  note: string | null;
}

export interface FieldNote {
  id: string;
  leadId: string;
  appointmentId: string | null;
  authorId: string | null;
  kind: "TEXT" | "VOICE";
  body: string | null;
  createdAt: string;
}

export interface FieldBillAttachment {
  id: string;
  leadId: string;
  uploadedBy: string | null;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface FieldActivity {
  id: string;
  leadId: string;
  actorId: string | null;
  eventType: string;
  event: unknown;
  createdAt: string;
}

export interface FieldSheetSyncJob {
  id: string;
  leadId: string;
  status: "PENDING" | "SYNCED" | "FAILED";
  attempts: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  updatedAt: string;
}

export interface FieldLeadContext {
  lead: FieldLead;
  appointments: FieldAppointment[];
  notes: FieldNote[];
  bills: FieldBillAttachment[];
  activities: FieldActivity[];
  sheetSync: FieldSheetSyncJob | null;
}

export interface TestFieldDataCleanupSummary {
  leads: number;
  appointments: number;
  notes: number;
  billMetadata: number;
  activities: number;
  sheetSyncJobs: number;
  availabilitySlots: number;
}

export interface CreateFieldLeadInput {
  id?: string;
  propertyId?: string | null;
  setterId: string;
  createdByUserId: string;
  teamId?: string | null;
  homeownerName: string;
  phone?: string | null;
  email?: string | null;
  addressLine1: string;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  utility?: string | null;
  supplier?: string | null;
  approximateMonthlyBill?: number | null;
  qualification?: unknown;
  isTestData?: boolean;
}

export interface CreateAvailabilityInput {
  id?: string;
  closerId: string;
  slotStart: string;
  slotEnd: string;
  timezone?: string;
  capacity?: number;
  note?: string | null;
  isTestData?: boolean;
}

export interface FieldOperationsRepository {
  listLeads(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldLead[]>;
  getLeadContext(id: string): Promise<FieldLeadContext | null>;
  getAppointmentContext(id: string): Promise<FieldLeadContext | null>;
  createLead(input: CreateFieldLeadInput): Promise<FieldLead>;
  updateLeadStatus(input: { leadId: string; status: FieldLeadStatus; actorId: string }): Promise<FieldLead | null>;
  getAvailabilityById(id: string): Promise<FieldAvailabilitySlot | null>;
  listAvailability(input: { from: string; to: string; teamIds: string[] | null }): Promise<FieldAvailabilitySlot[]>;
  listEligibleClosers(teamIds: string[] | null): Promise<Array<{ id: string; displayName: string; teamIds: string[] }>>;
  createAvailability(input: CreateAvailabilityInput): Promise<FieldAvailabilitySlot | null>;
  createAppointment(input: { id?: string; leadId: string; setterId: string; teamId?: string | null; slotId: string; appointmentType?: string; isTestData?: boolean }): Promise<FieldAppointment | null>;
  listAppointments(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldAppointment[]>;
  assignAppointment(input: { appointmentId: string; closerId: string; assignedBy: string; teamIds: string[] | null; allowReassign?: boolean }): Promise<FieldAppointment | null>;
  recordOutcome(input: { appointmentId: string; actorId: string; closerId: string; status: FieldAppointmentStatus; outcome: FieldAppointmentOutcome; outcomeNotes?: string | null }): Promise<FieldAppointment | null>;
  addNote(input: { leadId: string; appointmentId?: string | null; authorId: string; body: string; isTestData?: boolean }): Promise<FieldNote>;
  addBill(input: { leadId: string; uploadedBy: string; storageKey: string; fileName: string; mimeType: string; fileSizeBytes: number; isTestData?: boolean }): Promise<FieldBillAttachment>;
  getReport(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<{ leadCount: number; appointmentCount: number; byStatus: Array<{ status: string; count: number }>; byOutcome: Array<{ outcome: string; count: number }>; sync: { pending: number; synced: number; failed: number } }>;
  cleanTestData(): Promise<TestFieldDataCleanupSummary>;
}

const leadSelect = `
  SELECT l.id, l.property_id, l.setter_id, l.current_closer_id, l.created_by_user_id, l.team_id,
         l.homeowner_name, l.phone, l.email, l.address_line1, l.city, l.state, l.postal_code,
         l.latitude, l.longitude, l.utility, l.supplier, l.approximate_monthly_bill,
         l.qualification_json, l.status, l.created_at, l.updated_at
  FROM field_ops.leads l
`;

interface LeadRow {
  id: string; property_id: string | null; setter_id: string | null; current_closer_id: string | null;
  created_by_user_id: string | null; team_id: string | null; homeowner_name: string; phone: string | null;
  email: string | null; address_line1: string; city: string | null; state: string | null; postal_code: string | null;
  latitude: number | string | null; longitude: number | string | null; utility: string | null; supplier: string | null;
  approximate_monthly_bill: number | string | null; qualification_json: unknown; status: FieldLeadStatus;
  created_at: string | Date; updated_at: string | Date;
}

interface AppointmentRow {
  id: string; lead_id: string; setter_id: string | null; closer_id: string | null; team_id: string | null;
  scheduled_start: string | Date; scheduled_end: string | Date; timezone: string; appointment_type: string;
  status: FieldAppointmentStatus; outcome: FieldAppointmentOutcome | null; outcome_notes: string | null;
  started_at: string | Date | null; completed_at: string | Date | null; assigned_at: string | Date | null;
  assigned_by: string | null; notes: string | null; created_at: string | Date; updated_at: string | Date;
}

export class PostgresFieldOperationsRepository implements FieldOperationsRepository {
  constructor(private readonly client: SqlClient) {}

  async listLeads(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldLead[]> {
    const filter = scopeFilter("l", input.scope, input.userId, input.teamIds, 1);
    const result = await this.client.query<LeadRow>(`${leadSelect} WHERE ${filter.sql} ORDER BY l.updated_at DESC LIMIT 250`, filter.params);
    // Keep the API contract one-row-per-canonical-lead even if a future query
    // adds a one-to-many join for reporting metadata.
    const seen = new Set<string>();
    return result.rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).map(toLead);
  }

  async getLeadContext(id: string): Promise<FieldLeadContext | null> {
    const leadResult = await this.client.query<LeadRow>(`${leadSelect} WHERE l.id = $1`, [id]);
    const lead = leadResult.rows[0];
    if (!lead) return null;
    const [appointments, notes, bills, activities, sync] = await Promise.all([
      this.client.query<AppointmentRow>(`SELECT id, lead_id, setter_id, closer_id, team_id, scheduled_start, scheduled_end, timezone, appointment_type, status, outcome, outcome_notes, started_at, completed_at, assigned_at, assigned_by, notes, created_at, updated_at FROM field_ops.appointments WHERE lead_id = $1 ORDER BY scheduled_start DESC`, [id]),
      this.client.query<NoteRow>(`SELECT id, lead_id, appointment_id, author_id, kind, body, created_at FROM field_ops.notes WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      this.client.query<BillRow>(`SELECT id, lead_id, uploaded_by, storage_key, file_name, mime_type, file_size_bytes, created_at FROM field_ops.bill_attachments WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      this.client.query<ActivityRow>(`SELECT id, lead_id, actor_id, event_type, event_json, created_at FROM field_ops.activities WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      this.client.query<SyncRow>(`SELECT id, lead_id, status, attempts, last_synced_at, last_error, next_attempt_at, updated_at FROM field_ops.sheet_sync_jobs WHERE lead_id = $1`, [id]),
    ]);
    return {
      lead: toLead(lead),
      appointments: appointments.rows.map(toAppointment),
      notes: notes.rows.map(toNote),
      bills: bills.rows.map(toBill),
      activities: activities.rows.map(toActivity),
      sheetSync: sync.rows[0] ? toSync(sync.rows[0]) : null,
    };
  }

  async getAppointmentContext(id: string): Promise<FieldLeadContext | null> {
    const result = await this.client.query<{ lead_id: string }>("SELECT lead_id FROM field_ops.appointments WHERE id = $1", [id]);
    const leadId = result.rows[0]?.lead_id;
    return leadId ? this.getLeadContext(leadId) : null;
  }

  async getAvailabilityById(id: string): Promise<FieldAvailabilitySlot | null> {
    const result = await this.client.query<AvailabilityRow>(
      `SELECT a.id, a.closer_id, CONCAT(u.first_name, ' ', u.last_name) AS closer_name,
              a.slot_start, a.slot_end, a.timezone, a.capacity, a.booked_count, a.status, a.note
       FROM field_ops.closer_availability a
       JOIN field_ops.users u ON u.id = a.closer_id
       WHERE a.id = $1`,
      [id],
    );
    return result.rows[0] ? toAvailability(result.rows[0]) : null;
  }

  async createLead(input: CreateFieldLeadInput): Promise<FieldLead> {
    const id = input.id ?? randomUUID();
    return this.withTransaction(async (client) => {
      const result = await client.query<LeadRow>(
        `INSERT INTO field_ops.leads
          (id, property_id, setter_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, is_test_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, 'KNOCKED', $19)
         RETURNING id, property_id, setter_id, current_closer_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [id, input.propertyId ?? null, input.setterId, input.createdByUserId, input.teamId ?? null, input.homeownerName, input.phone ?? null, input.email ?? null, input.addressLine1, input.city ?? null, input.state ?? null, input.postalCode ?? null, input.latitude ?? null, input.longitude ?? null, input.utility ?? null, input.supplier ?? null, input.approximateMonthlyBill ?? null, JSON.stringify(input.qualification ?? {}), Boolean(input.isTestData)],
      );
      const lead = result.rows[0];
      if (!lead) throw new Error("Lead could not be created.");
      await appendActivity(client, id, input.createdByUserId, "LEAD_CREATED", { status: "KNOCKED" }, input.isTestData);
      await queueSync(client, id, input.isTestData);
      return toLead(lead);
    });
  }

  async updateLeadStatus(input: { leadId: string; status: FieldLeadStatus; actorId: string }): Promise<FieldLead | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<LeadRow>(`${leadSelect} WHERE l.id = $1`, [input.leadId]);
      const current = currentResult.rows[0];
      if (!current) return null;
      const updatedResult = await client.query<LeadRow>(
        `UPDATE field_ops.leads
         SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, property_id, setter_id, current_closer_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [input.leadId, input.status],
      );
      const updated = updatedResult.rows[0];
      if (!updated) return null;
      await appendActivity(client, input.leadId, input.actorId, "LEAD_STATUS_UPDATED", { from: current.status, to: input.status });
      await queueSync(client, input.leadId);
      return toLead(updated);
    });
  }

  async listAvailability(input: { from: string; to: string; teamIds: string[] | null }): Promise<FieldAvailabilitySlot[]> {
    const teamFilter = input.teamIds === null ? "TRUE" : input.teamIds.length > 0 ? "EXISTS (SELECT 1 FROM field_ops.user_teams filter_team WHERE filter_team.user_id = a.closer_id AND filter_team.team_id = ANY($3::uuid[]))" : "FALSE";
    const params = input.teamIds === null || input.teamIds.length === 0 ? [input.from, input.to] : [input.from, input.to, input.teamIds];
    const result = await this.client.query<AvailabilityRow>(
      `SELECT a.id, a.closer_id, CONCAT(u.first_name, ' ', u.last_name) AS closer_name, a.slot_start, a.slot_end, a.timezone, a.capacity, a.booked_count, a.status, a.note
       FROM field_ops.closer_availability a
       JOIN field_ops.users u ON u.id = a.closer_id
       WHERE a.slot_start >= $1 AND a.slot_end <= $2 AND a.status = 'AVAILABLE' AND a.booked_count < a.capacity
         AND u.active = TRUE AND EXISTS (SELECT 1 FROM field_ops.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 'CLOSER')
         AND ${teamFilter}
       ORDER BY a.slot_start, closer_name`, params);
    return result.rows.map(toAvailability);
  }

  async listEligibleClosers(teamIds: string[] | null): Promise<Array<{ id: string; displayName: string; teamIds: string[] }>> {
    const teamFilter = teamIds === null ? "TRUE" : teamIds.length > 0 ? "EXISTS (SELECT 1 FROM field_ops.user_teams filter_team WHERE filter_team.user_id = u.id AND filter_team.team_id = ANY($1::uuid[]))" : "FALSE";
    const result = await this.client.query<{ id: string; display_name: string; team_ids: string[] }>(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS display_name,
              COALESCE(array_agg(DISTINCT ut.team_id::text) FILTER (WHERE ut.team_id IS NOT NULL), ARRAY[]::text[]) AS team_ids
       FROM field_ops.users u
       LEFT JOIN field_ops.user_roles ur ON ur.user_id = u.id AND ur.role_id = 'CLOSER'
       LEFT JOIN field_ops.user_teams ut ON ut.user_id = u.id
       WHERE u.active = TRUE AND ur.user_id IS NOT NULL AND ${teamFilter}
      GROUP BY u.id, u.first_name, u.last_name ORDER BY u.last_name, u.first_name`, teamIds === null || teamIds.length === 0 ? [] : [teamIds]);
    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name.trim(), teamIds: row.team_ids }));
  }

  async createAvailability(input: CreateAvailabilityInput): Promise<FieldAvailabilitySlot | null> {
    const result = await this.client.query<AvailabilityRow>(
      `INSERT INTO field_ops.closer_availability (id, closer_id, slot_start, slot_end, timezone, capacity, booked_count, status, note, is_test_data)
       SELECT $1, u.id, $3, $4, $5, $6, 0, 'AVAILABLE', $7, $8
       FROM field_ops.users u
       WHERE u.id = $2 AND u.active = TRUE AND EXISTS (SELECT 1 FROM field_ops.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 'CLOSER')
       RETURNING id, closer_id, CONCAT('Closer ', LEFT(closer_id::text, 8)) AS closer_name, slot_start, slot_end, timezone, capacity, booked_count, status, note`,
      [input.id ?? randomUUID(), input.closerId, input.slotStart, input.slotEnd, input.timezone ?? "America/New_York", input.capacity ?? 1, input.note ?? null, Boolean(input.isTestData)]);
    return result.rows[0] ? this.getAvailabilityById(result.rows[0].id) : null;
  }

  async createAppointment(input: { id?: string; leadId: string; setterId: string; teamId?: string | null; slotId: string; appointmentType?: string; isTestData?: boolean }): Promise<FieldAppointment | null> {
    const appointmentId = input.id ?? randomUUID();
    return this.withTransaction(async (client) => {
      const result = await client.query<AppointmentRow>(
        `WITH reserved AS (
           UPDATE field_ops.closer_availability AS ca
           SET booked_count = booked_count + 1,
               status = CASE WHEN booked_count + 1 >= capacity THEN 'BOOKED' ELSE 'AVAILABLE' END,
               updated_at = NOW()
           WHERE ca.id = $1 AND ca.status = 'AVAILABLE' AND ca.booked_count < ca.capacity
             AND $5::uuid IS NOT NULL
             AND EXISTS (SELECT 1 FROM field_ops.user_teams slot_team WHERE slot_team.user_id = ca.closer_id AND slot_team.team_id = $5::uuid)
           RETURNING ca.slot_start, ca.slot_end
         )
         INSERT INTO field_ops.appointments
           (id, lead_id, setter_id, closer_id, team_id, scheduled_start, scheduled_end, appointment_type, status, is_test_data)
         SELECT $2, $3, $4, NULL, $5, reserved.slot_start, reserved.slot_end, $6, 'UNASSIGNED', $7
         FROM reserved
         RETURNING id, lead_id, setter_id, closer_id, team_id, scheduled_start, scheduled_end, timezone, appointment_type, status, outcome, outcome_notes, started_at, completed_at, assigned_at, assigned_by, notes, created_at, updated_at`,
        [input.slotId, appointmentId, input.leadId, input.setterId, input.teamId ?? null, input.appointmentType ?? "SOLAR_CONSULTATION", Boolean(input.isTestData)]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      await client.query("UPDATE field_ops.leads SET status = 'APPOINTMENT_SET', updated_at = NOW() WHERE id = $1", [input.leadId]);
      await appendActivity(client, input.leadId, input.setterId, "APPOINTMENT_CREATED_UNASSIGNED", { appointmentId: appointment.id, status: "UNASSIGNED" }, input.isTestData);
      await queueSync(client, input.leadId, input.isTestData);
      return toAppointment(appointment);
    });
  }

  async listAppointments(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldAppointment[]> {
    const filter = scopeFilter("a", input.scope, input.userId, input.teamIds, 1);
    const result = await this.client.query<AppointmentRow>(
      `SELECT a.id, a.lead_id, a.setter_id, a.closer_id, a.team_id, a.scheduled_start, a.scheduled_end, a.timezone, a.appointment_type, a.status, a.outcome, a.outcome_notes, a.started_at, a.completed_at, a.assigned_at, a.assigned_by, a.notes, a.created_at, a.updated_at
       FROM field_ops.appointments a WHERE ${filter.sql} ORDER BY a.scheduled_start DESC LIMIT 250`, filter.params);
    return result.rows.map(toAppointment);
  }

  async assignAppointment(input: { appointmentId: string; closerId: string; assignedBy: string; teamIds: string[] | null; allowReassign?: boolean }): Promise<FieldAppointment | null> {
    return this.withTransaction(async (client) => {
      const teamFilter = input.teamIds === null ? "TRUE" : input.teamIds.length > 0 ? "EXISTS (SELECT 1 FROM field_ops.user_teams target_team WHERE target_team.user_id = u.id AND target_team.team_id = ANY($5::uuid[]))" : "FALSE";
      const result = await client.query<AppointmentRow>(
        `UPDATE field_ops.appointments a
         SET closer_id = $2, status = 'ASSIGNED', assigned_at = NOW(), assigned_by = $3, updated_at = NOW()
         FROM field_ops.users u
         WHERE a.id = $1
           AND (a.status = 'UNASSIGNED' OR ($4 = TRUE AND a.status = 'ASSIGNED'))
           AND u.id = $2 AND u.active = TRUE
           AND EXISTS (SELECT 1 FROM field_ops.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 'CLOSER')
           AND (a.team_id IS NULL OR EXISTS (SELECT 1 FROM field_ops.user_teams appointment_team WHERE appointment_team.user_id = u.id AND appointment_team.team_id = a.team_id))
           AND ${teamFilter}
         RETURNING a.id, a.lead_id, a.setter_id, a.closer_id, a.team_id, a.scheduled_start, a.scheduled_end, a.timezone, a.appointment_type, a.status, a.outcome, a.outcome_notes, a.started_at, a.completed_at, a.assigned_at, a.assigned_by, a.notes, a.created_at, a.updated_at`,
        input.teamIds === null || input.teamIds.length === 0 ? [input.appointmentId, input.closerId, input.assignedBy, Boolean(input.allowReassign)] : [input.appointmentId, input.closerId, input.assignedBy, Boolean(input.allowReassign), input.teamIds]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      await client.query("UPDATE field_ops.leads SET current_closer_id = $2, updated_at = NOW() WHERE id = $1", [appointment.lead_id, input.closerId]);
      await appendActivity(client, appointment.lead_id, input.assignedBy, "APPOINTMENT_ASSIGNED", { appointmentId: appointment.id, closerId: input.closerId, status: "ASSIGNED" });
      await queueSync(client, appointment.lead_id);
      return toAppointment(appointment);
    });
  }

  async recordOutcome(input: { appointmentId: string; actorId: string; closerId: string; status: FieldAppointmentStatus; outcome: FieldAppointmentOutcome; outcomeNotes?: string | null }): Promise<FieldAppointment | null> {
    return this.withTransaction(async (client) => {
      const result = await client.query<AppointmentRow>(
        `UPDATE field_ops.appointments
         SET status = $4, outcome = $3, outcome_notes = $5, completed_at = CASE WHEN $4 IN ('COMPLETED', 'NO_SHOW', 'CANCELLED') THEN NOW() ELSE completed_at END, updated_at = NOW()
         WHERE id = $1 AND closer_id = $2 AND status IN ('ASSIGNED', 'STARTED')
         RETURNING id, lead_id, setter_id, closer_id, team_id, scheduled_start, scheduled_end, timezone, appointment_type, status, outcome, outcome_notes, started_at, completed_at, assigned_at, assigned_by, notes, created_at, updated_at`,
        [input.appointmentId, input.closerId, input.outcome, input.status, input.outcomeNotes ?? null]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      const leadStatus = outcomeLeadStatus(input.outcome);
      await client.query("UPDATE field_ops.leads SET status = $2, updated_at = NOW() WHERE id = $1", [appointment.lead_id, leadStatus]);
      await appendActivity(client, appointment.lead_id, input.actorId, "APPOINTMENT_OUTCOME_UPDATED", { appointmentId: appointment.id, outcome: input.outcome, status: input.status });
      await queueSync(client, appointment.lead_id);
      return toAppointment(appointment);
    });
  }

  async addNote(input: { leadId: string; appointmentId?: string | null; authorId: string; body: string; isTestData?: boolean }): Promise<FieldNote> {
    return this.withTransaction(async (client) => {
      const result = await client.query<NoteRow>(
        `INSERT INTO field_ops.notes (id, lead_id, appointment_id, author_id, kind, body, is_test_data)
         VALUES ($1, $2, $3, $4, 'TEXT', $5, $6) RETURNING id, lead_id, appointment_id, author_id, kind, body, created_at`,
        [randomUUID(), input.leadId, input.appointmentId ?? null, input.authorId, input.body, Boolean(input.isTestData)]);
      const note = result.rows[0];
      if (!note) throw new Error("Note could not be added.");
      await appendActivity(client, input.leadId, input.authorId, "NOTE_ADDED", { noteId: note.id, appointmentId: input.appointmentId ?? null }, input.isTestData);
      await queueSync(client, input.leadId, input.isTestData);
      return toNote(note);
    });
  }

  async addBill(input: { leadId: string; uploadedBy: string; storageKey: string; fileName: string; mimeType: string; fileSizeBytes: number; isTestData?: boolean }): Promise<FieldBillAttachment> {
    return this.withTransaction(async (client) => {
      const result = await client.query<BillRow>(
        `INSERT INTO field_ops.bill_attachments (id, lead_id, uploaded_by, storage_key, file_name, mime_type, file_size_bytes, is_test_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, lead_id, uploaded_by, storage_key, file_name, mime_type, file_size_bytes, created_at`,
        [randomUUID(), input.leadId, input.uploadedBy, input.storageKey, input.fileName, input.mimeType, input.fileSizeBytes, Boolean(input.isTestData)]);
      const bill = result.rows[0];
      if (!bill) throw new Error("Bill attachment could not be added.");
      await appendActivity(client, input.leadId, input.uploadedBy, "BILL_UPLOADED", { billId: bill.id, fileName: input.fileName }, input.isTestData);
      await queueSync(client, input.leadId, input.isTestData);
      return toBill(bill);
    });
  }

  async getReport(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<{ leadCount: number; appointmentCount: number; byStatus: Array<{ status: string; count: number }>; byOutcome: Array<{ outcome: string; count: number }>; sync: { pending: number; synced: number; failed: number } }> {
    const leadFilter = scopeFilter("l", input.scope, input.userId, input.teamIds, 1);
    const appointmentFilter = scopeFilter("a", input.scope, input.userId, input.teamIds, 1);
    const [leads, appointments, statuses, outcomes, sync] = await Promise.all([
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.leads l WHERE ${leadFilter.sql}`, leadFilter.params),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql}`, appointmentFilter.params),
      this.client.query<{ status: string; count: string }>(`SELECT a.status, count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} GROUP BY a.status ORDER BY a.status`, appointmentFilter.params),
      this.client.query<{ outcome: string; count: string }>(`SELECT COALESCE(a.outcome, 'PENDING') AS outcome, count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} GROUP BY COALESCE(a.outcome, 'PENDING') ORDER BY outcome`, appointmentFilter.params),
      this.client.query<{ status: "PENDING" | "SYNCED" | "FAILED"; count: string }>(`SELECT s.status, count(*)::text AS count FROM field_ops.sheet_sync_jobs s JOIN field_ops.leads l ON l.id = s.lead_id WHERE ${leadFilter.sql} GROUP BY s.status`, leadFilter.params),
    ]);
    const syncCounts = { pending: 0, synced: 0, failed: 0 };
    for (const row of sync.rows) syncCounts[row.status.toLowerCase() as keyof typeof syncCounts] = Number(row.count);
    return {
      leadCount: Number(leads.rows[0]?.count ?? 0), appointmentCount: Number(appointments.rows[0]?.count ?? 0),
      byStatus: statuses.rows.map((row) => ({ status: row.status, count: Number(row.count) })),
      byOutcome: outcomes.rows.map((row) => ({ outcome: row.outcome, count: Number(row.count) })), sync: syncCounts,
    };
  }

  async cleanTestData(): Promise<TestFieldDataCleanupSummary> {
    return this.withTransaction(async (client) => {
      const deleted = async (table: string): Promise<number> => {
        const result = await client.query<{ id: string }>(`DELETE FROM field_ops.${table} WHERE is_test_data = TRUE RETURNING id`);
        return result.rows.length;
      };

      // Delete dependent records first. User, role, permission, and team
      // tables are deliberately not touched by this operation.
      const sheetSyncJobs = await deleted("sheet_sync_jobs");
      const activities = await deleted("activities");
      const billMetadata = await deleted("bill_attachments");
      const notes = await deleted("notes");
      const appointments = await deleted("appointments");
      const leads = await deleted("leads");
      const availabilitySlots = await deleted("closer_availability");
      return { leads, appointments, notes, billMetadata, activities, sheetSyncJobs, availabilitySlots };
    });
  }

  private async withTransaction<T>(callback: (client: SqlClient) => Promise<T>): Promise<T> {
    return this.client.transaction ? this.client.transaction(callback) : callback(this.client);
  }
}

interface AvailabilityRow { id: string; closer_id: string; closer_name: string; slot_start: string | Date; slot_end: string | Date; timezone: string; capacity: number | string; booked_count: number | string; status: "AVAILABLE" | "BLOCKED" | "BOOKED"; note: string | null; }
interface NoteRow { id: string; lead_id: string; appointment_id: string | null; author_id: string | null; kind: "TEXT" | "VOICE"; body: string | null; created_at: string | Date; }
interface BillRow { id: string; lead_id: string; uploaded_by: string | null; storage_key: string; file_name: string; mime_type: string; file_size_bytes: number | string; created_at: string | Date; }
interface ActivityRow { id: string; lead_id: string; actor_id: string | null; event_type: string; event_json: unknown; created_at: string | Date; }
interface SyncRow { id: string; lead_id: string; status: "PENDING" | "SYNCED" | "FAILED"; attempts: number | string; last_synced_at: string | Date | null; last_error: string | null; next_attempt_at: string | Date | null; updated_at: string | Date; }

function scopeFilter(alias: string, scope: FieldListScope, userId: string, teamIds: string[] | null, userParam: number): { sql: string; params: unknown[] } {
  const own = alias === "l"
    ? `(${alias}.created_by_user_id = $${userParam} OR ${alias}.setter_id = $${userParam} OR ${alias}.current_closer_id = $${userParam})`
    : `(${alias}.setter_id = $${userParam} OR ${alias}.closer_id = $${userParam})`;
  const assigned = alias === "l"
    ? `(${alias}.current_closer_id = $${userParam} OR ${alias}.setter_id = $${userParam})`
    : `(${alias}.closer_id = $${userParam} OR ${alias}.setter_id = $${userParam})`;
  const team = teamIds === null ? "TRUE" : teamIds.length > 0 ? `${alias}.team_id = ANY($1::uuid[])` : "FALSE";
  switch (scope) {
    case "all": return { sql: "TRUE", params: [] };
    case "team": return { sql: team, params: teamIds === null || teamIds.length === 0 ? [] : [teamIds] };
    case "assigned": return { sql: assigned, params: [userId] };
    case "own-or-assigned": return { sql: `(${own} OR ${assigned})`, params: [userId] };
    default: return { sql: own, params: [userId] };
  }
}

async function appendActivity(client: SqlClient, leadId: string, actorId: string, eventType: string, event: unknown, isTestData = false): Promise<void> {
  await client.query(`INSERT INTO field_ops.activities (id, lead_id, actor_id, event_type, event_json, is_test_data) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`, [randomUUID(), leadId, actorId, eventType, JSON.stringify(event ?? {}), Boolean(isTestData)]);
}

async function queueSync(client: SqlClient, leadId: string, isTestData = false): Promise<void> {
  await client.query(
    `INSERT INTO field_ops.sheet_sync_jobs (id, lead_id, status, attempts, next_attempt_at, updated_at, is_test_data)
     VALUES ($1, $2, 'PENDING', 0, NOW(), NOW(), $3)
     ON CONFLICT (lead_id) DO UPDATE SET status = 'PENDING', last_error = NULL, next_attempt_at = NOW(), updated_at = NOW()`,
    [randomUUID(), leadId, Boolean(isTestData)],
  );
}

function toLead(row: LeadRow): FieldLead {
  return { id: row.id, propertyId: row.property_id, setterId: row.setter_id, currentCloserId: row.current_closer_id, createdByUserId: row.created_by_user_id, teamId: row.team_id, homeownerName: row.homeowner_name, phone: row.phone, email: row.email, addressLine1: row.address_line1, city: row.city, state: row.state, postalCode: row.postal_code, latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude), utility: row.utility, supplier: row.supplier, approximateMonthlyBill: numberOrNull(row.approximate_monthly_bill), qualification: parseJson(row.qualification_json), status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function toAppointment(row: AppointmentRow): FieldAppointment {
  return { id: row.id, leadId: row.lead_id, setterId: row.setter_id, closerId: row.closer_id, teamId: row.team_id, scheduledStart: iso(row.scheduled_start), scheduledEnd: iso(row.scheduled_end), timezone: row.timezone, appointmentType: row.appointment_type, status: row.status, outcome: row.outcome, outcomeNotes: row.outcome_notes, startedAt: iso(row.started_at), completedAt: iso(row.completed_at), assignedAt: iso(row.assigned_at), assignedBy: row.assigned_by, notes: row.notes, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function toAvailability(row: AvailabilityRow): FieldAvailabilitySlot { return { id: row.id, closerId: row.closer_id, closerName: row.closer_name.trim(), slotStart: iso(row.slot_start), slotEnd: iso(row.slot_end), timezone: row.timezone, capacity: Number(row.capacity), bookedCount: Number(row.booked_count), status: row.status, note: row.note }; }
function toNote(row: NoteRow): FieldNote { return { id: row.id, leadId: row.lead_id, appointmentId: row.appointment_id, authorId: row.author_id, kind: row.kind, body: row.body, createdAt: iso(row.created_at) }; }
function toBill(row: BillRow): FieldBillAttachment { return { id: row.id, leadId: row.lead_id, uploadedBy: row.uploaded_by, storageKey: row.storage_key, fileName: row.file_name, mimeType: row.mime_type, fileSizeBytes: Number(row.file_size_bytes), createdAt: iso(row.created_at) }; }
function toActivity(row: ActivityRow): FieldActivity { return { id: row.id, leadId: row.lead_id, actorId: row.actor_id, eventType: row.event_type, event: parseJson(row.event_json), createdAt: iso(row.created_at) }; }
function toSync(row: SyncRow): FieldSheetSyncJob { return { id: row.id, leadId: row.lead_id, status: row.status, attempts: Number(row.attempts), lastSyncedAt: iso(row.last_synced_at), lastError: row.last_error, nextAttemptAt: iso(row.next_attempt_at), updatedAt: iso(row.updated_at) }; }
function iso(value: string | Date): string;
function iso(value: string | Date | null): string | null;
function iso(value: string | Date | null): string | null { if (value == null) return null; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toISOString(); }
function numberOrNull(value: number | string | null): number | null { if (value == null) return null; const result = Number(value); return Number.isFinite(result) ? result : null; }
function parseJson(value: unknown): unknown { if (typeof value !== "string") return value ?? {}; try { return JSON.parse(value); } catch { return {}; } }
function outcomeLeadStatus(outcome: FieldAppointmentOutcome): FieldLeadStatus { switch (outcome) { case "SAT": return "SAT"; case "PROPOSAL": return "PROPOSAL"; case "CLOSED": return "CLOSED"; case "NO_SHOW": return "NO_SHOW"; case "FOLLOW_UP": return "FOLLOW_UP"; case "NOT_QUALIFIED": return "NOT_QUALIFIED"; case "NOT_INTERESTED": return "NOT_INTERESTED"; default: return "CANCELLED"; } }
