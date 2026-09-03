import { randomUUID } from "node:crypto";
import type { SqlClient } from "./repository";
import type { OperationalOverflowPolicy } from "./operational-slots";

export type FieldLeadStatus =
  | "KNOCKED" | "INTERESTED" | "FOLLOW_UP" | "APPOINTMENT_SET" | "NO_SHOW"
  | "SAT" | "PROPOSAL" | "CLOSED" | "NOT_INTERESTED" | "NOT_QUALIFIED" | "CANCELLED";
export type FieldAppointmentStatus = "UNASSIGNED" | "ASSIGNED" | "STARTED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" | "RESCHEDULED" | "SCHEDULED";
// Legacy values remain readable for existing records. New API writes use the
// canonical closer-result values below.
export type FieldAppointmentOutcome =
  | "CLOSED" | "SAT_NOT_CLOSED" | "DID_NOT_SIT" | "CREDIT_FAIL" | "NO_SHOW"
  | "NOT_QUALIFIED" | "FOLLOW_UP" | "RESCHEDULED" | "CANCELLED"
  | "SAT" | "PROPOSAL" | "NOT_INTERESTED";
export type FieldListScope = "all" | "team" | "own" | "assigned" | "own-or-assigned";
export type FieldFollowUpStatus = "OPEN" | "DONE" | "SNOOZED" | "CANCELLED" | "CONVERTED_TO_APPOINTMENT" | "CONVERTED";

export interface FieldLead {
  id: string;
  sourceFollowUpId?: string | null;
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
  availabilitySlotId: string | null;
  operationalSlotId: string | null;
  isOverflow: boolean;
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
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdAt: string;
  updatedAt: string;
  homeownerName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  setterName?: string | null;
  closerName?: string | null;
  hasBill?: boolean;
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

export interface FieldOperationalSlotAppointment {
  id: string;
  leadId: string;
  status: FieldAppointmentStatus;
  isOverflow: boolean;
}

export interface FieldOperationalSlotDefinition {
  id: string;
  startTime: string;
  durationMinutes: number;
  standardCapacity: number;
  overflowPolicy: OperationalOverflowPolicy;
  source: string;
  active: boolean;
}

export interface FieldOperationalSlot {
  id: string;
  teamId: string | null;
  slotDate: string;
  startTime: string;
  slotStart: string;
  slotEnd: string;
  timezone: string;
  standardCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  overflowCount: number;
  overflowPolicy: OperationalOverflowPolicy;
  status: "OPEN" | "BLOCKED";
  appointments: FieldOperationalSlotAppointment[];
}

export interface FieldNote {
  id: string;
  leadId: string;
  appointmentId: string | null;
  authorId: string | null;
  kind: "TEXT" | "VOICE";
  body: string | null;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
  authorRole: string | null;
}

export interface FieldCloserCandidate {
  id: string;
  displayName: string;
  teamIds: string[];
  appointmentsToday: number;
}

export interface FieldFollowUp {
  id: string;
  leadId: string | null;
  teamId: string | null;
  convertedLeadId: string | null;
  ownerUserId: string;
  dueAt: string | null;
  dueDaypart: string | null;
  reason: string;
  note: string;
  status: FieldFollowUpStatus;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  convertedAppointmentId: string | null;
  homeownerName: string;
  addressLine1: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  activities: FieldFollowUpActivity[];
}

export interface FieldFollowUpActivity {
  id: string;
  followUpId: string;
  actorId: string | null;
  eventType: string;
  event: unknown;
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
  replacedBy: string | null;
  replacedAt: string | null;
  createdAt: string;
}

export interface FieldActivity {
  id: string;
  leadId: string;
  actorId: string | null;
  actorName: string | null;
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
  followUps: number;
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

export interface CreateFieldLeadWithAppointmentInput extends CreateFieldLeadInput {
  operationalSlotId: string;
  allowOverflow?: boolean;
  appointmentType?: string;
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
  getBillContext(id: string): Promise<{ bill: FieldBillAttachment; lead: FieldLead } | null>;
  createLead(input: CreateFieldLeadInput): Promise<FieldLead>;
  createLeadWithAppointment?(input: CreateFieldLeadWithAppointmentInput): Promise<{ lead: FieldLead; appointment: FieldAppointment } | null>;
  updateLeadStatus(input: { leadId: string; status: FieldLeadStatus; actorId: string; isTestData?: boolean }): Promise<FieldLead | null>;
  getAvailabilityById(id: string): Promise<FieldAvailabilitySlot | null>;
  listAvailability(input: { from: string; to: string; teamIds: string[] | null }): Promise<FieldAvailabilitySlot[]>;
  listEligibleClosers(teamIds: string[] | null): Promise<Array<{ id: string; displayName: string; teamIds: string[] }>>;
  listAvailableClosers(input: { appointmentId: string; teamIds: string[] | null }): Promise<FieldCloserCandidate[]>;
  createAvailability(input: CreateAvailabilityInput): Promise<FieldAvailabilitySlot | null>;
  createAppointment(input: { id?: string; leadId: string; setterId: string; teamId?: string | null; slotId?: string; operationalSlotId?: string; allowOverflow?: boolean; appointmentType?: string; isTestData?: boolean }): Promise<FieldAppointment | null>;
  listOperationalSlots?(input: { from: string; to: string; teamIds: string[] | null }): Promise<FieldOperationalSlot[]>;
  listOperationalSlotDefinitions?(): Promise<FieldOperationalSlotDefinition[]>;
  updateOperationalSlotDefinition?(input: { id: string; standardCapacity: number; overflowPolicy: OperationalOverflowPolicy; actorId: string }): Promise<FieldOperationalSlotDefinition | null>;
  cancelAppointment?(input: { appointmentId: string; actorId: string; cancelReason: string; isTestData?: boolean }): Promise<FieldAppointment | null>;
  rescheduleAppointment?(input: { appointmentId: string; operationalSlotId: string; actorId: string; allowOverflow?: boolean; isTestData?: boolean }): Promise<FieldAppointment | null>;
  listAppointments(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldAppointment[]>;
  assignAppointment(input: { appointmentId: string; closerId: string; assignedBy: string; teamIds: string[] | null; allowReassign?: boolean; isTestData?: boolean }): Promise<FieldAppointment | null>;
  recordOutcome(input: { appointmentId: string; actorId: string; closerId: string; status: FieldAppointmentStatus; outcome: FieldAppointmentOutcome; outcomeNotes?: string | null; isTestData?: boolean }): Promise<FieldAppointment | null>;
  addNote(input: { leadId: string; appointmentId?: string | null; authorId: string; body: string; isTestData?: boolean }): Promise<FieldNote>;
  addBill(input: { leadId: string; uploadedBy: string; storageKey: string; fileName: string; mimeType: string; fileSizeBytes: number; isTestData?: boolean }): Promise<FieldBillAttachment>;
  listFollowUps(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldFollowUp[]>;
  getFollowUp(id: string): Promise<FieldFollowUp | null>;
  createFollowUp(input: { id?: string; leadId?: string | null; teamId?: string | null; ownerUserId: string; dueAt?: string | null; dueDaypart?: string | null; homeownerName?: string; phone?: string | null; email?: string | null; addressLine1: string; city?: string | null; state?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; reason: string; note?: string; createdBy: string; isTestData?: boolean }): Promise<FieldFollowUp>;
  updateFollowUp(input: { id: string; actorId: string; status: FieldFollowUpStatus; dueAt?: string | null; dueDaypart?: string | null; convertedAppointmentId?: string | null }): Promise<FieldFollowUp | null>;
  addFollowUpNote(input: { id: string; actorId: string; body: string; isTestData?: boolean }): Promise<FieldFollowUp | null>;
  convertFollowUpToLead(input: { followUpId: string; setterId: string; teamId?: string | null; isTestData?: boolean }): Promise<{ followUp: FieldFollowUp; lead: FieldLead } | null>;
  convertFollowUpToAppointment(input: { followUpId: string; slotId?: string; operationalSlotId?: string; allowOverflow?: boolean; setterId: string; appointmentType?: string; isTestData?: boolean }): Promise<{ followUp: FieldFollowUp; appointment: FieldAppointment } | null>;
  getReport(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<{ leadCount: number; appointmentCount: number; byStatus: Array<{ status: string; count: number }>; byOutcome: Array<{ outcome: string; count: number }>; sync: { pending: number; synced: number; failed: number }; capacity: { standard: number; booked: number; remaining: number; overflow: number }; unassignedCount: number; confirmedCount: number; cancelledCount: number; cancellationReasons: Array<{ reason: string; count: number }> }>;
  cleanTestData(): Promise<TestFieldDataCleanupSummary>;
}

const leadSelect = `
  SELECT l.id, l.source_follow_up_id, l.property_id, l.setter_id, l.current_closer_id, l.created_by_user_id, l.team_id,
         l.homeowner_name, l.phone, l.email, l.address_line1, l.city, l.state, l.postal_code,
         l.latitude, l.longitude, l.utility, l.supplier, l.approximate_monthly_bill,
         l.qualification_json, l.status, l.created_at, l.updated_at
  FROM field_ops.leads l
`;

const followUpSelect = `
  SELECT f.id, f.lead_id, f.team_id, f.owner_user_id, f.due_at, f.due_daypart, f.reason, f.note, f.status,
         f.created_by, f.created_at, f.completed_at, f.updated_at,
         f.converted_appointment_id, f.converted_lead_id,
         COALESCE(NULLIF(f.homeowner_name, ''), l.homeowner_name, '') AS homeowner_name,
         COALESCE(NULLIF(f.address_line1, ''), l.address_line1, '') AS address_line1,
         COALESCE(f.phone, l.phone) AS phone,
         COALESCE(f.email, l.email) AS email,
         COALESCE(f.city, l.city) AS city,
         COALESCE(f.state, l.state) AS state,
         COALESCE(f.postal_code, l.postal_code) AS postal_code,
         COALESCE(f.latitude, l.latitude) AS latitude,
         COALESCE(f.longitude, l.longitude) AS longitude,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', a.id,
             'followUpId', a.follow_up_id,
             'actorId', a.actor_id,
             'eventType', a.event_type,
             'event', a.event_json,
             'createdAt', a.created_at
           ) ORDER BY a.created_at ASC)
           FROM field_ops.follow_up_activities a
           WHERE a.follow_up_id = f.id
         ), '[]'::jsonb) AS activities
  FROM field_ops.follow_ups f
  LEFT JOIN field_ops.leads l ON l.id = f.lead_id
`;

const appointmentColumns = `id, lead_id, setter_id, closer_id, team_id, availability_slot_id, operational_slot_id, is_overflow,
  scheduled_start, scheduled_end, timezone, appointment_type, status, outcome, outcome_notes, started_at, completed_at,
  assigned_at, assigned_by, notes, cancel_reason, cancelled_at, cancelled_by, created_at, updated_at`;
const appointmentColumnsWithAlias = `a.id, a.lead_id, a.setter_id, a.closer_id, a.team_id, a.availability_slot_id, a.operational_slot_id, a.is_overflow,
  a.scheduled_start, a.scheduled_end, a.timezone, a.appointment_type, a.status, a.outcome, a.outcome_notes, a.started_at, a.completed_at,
  a.assigned_at, a.assigned_by, a.notes, a.cancel_reason, a.cancelled_at, a.cancelled_by, a.created_at, a.updated_at`;
const appointmentColumnsWithContext = `${appointmentColumnsWithAlias},
  l.homeowner_name AS homeowner_name, l.address_line1 AS address_line1, l.city AS city,
  l.state AS state, l.postal_code AS postal_code,
  NULLIF(CONCAT_WS(' ', setter_user.first_name, setter_user.last_name), '') AS setter_name,
  NULLIF(CONCAT_WS(' ', closer_user.first_name, closer_user.last_name), '') AS closer_name,
  EXISTS (SELECT 1 FROM field_ops.bill_attachments bill WHERE bill.lead_id = a.lead_id AND bill.replaced_by IS NULL) AS has_bill`;

interface LeadRow {
  id: string; source_follow_up_id: string | null; property_id: string | null; setter_id: string | null; current_closer_id: string | null;
  created_by_user_id: string | null; team_id: string | null; homeowner_name: string; phone: string | null;
  email: string | null; address_line1: string; city: string | null; state: string | null; postal_code: string | null;
  latitude: number | string | null; longitude: number | string | null; utility: string | null; supplier: string | null;
  approximate_monthly_bill: number | string | null; qualification_json: unknown; status: FieldLeadStatus;
  created_at: string | Date; updated_at: string | Date;
}

interface AppointmentRow {
  id: string; lead_id: string; setter_id: string | null; closer_id: string | null; team_id: string | null; availability_slot_id: string | null; operational_slot_id?: string | null; is_overflow?: boolean | null;
  scheduled_start: string | Date; scheduled_end: string | Date; timezone: string; appointment_type: string;
  status: FieldAppointmentStatus; outcome: FieldAppointmentOutcome | null; outcome_notes: string | null;
  started_at: string | Date | null; completed_at: string | Date | null; assigned_at: string | Date | null;
  assigned_by: string | null; notes: string | null; cancel_reason?: string | null; cancelled_at?: string | Date | null; cancelled_by?: string | null; created_at: string | Date; updated_at: string | Date;
  homeowner_name?: string | null; address_line1?: string | null; city?: string | null; state?: string | null; postal_code?: string | null;
  setter_name?: string | null; closer_name?: string | null; has_bill?: boolean | null;
}

interface OperationalSlotRow {
  id: string;
  team_id: string | null;
  slot_date: string | Date;
  start_time: string;
  slot_start: string | Date;
  slot_end: string | Date;
  timezone: string;
  standard_capacity: number | string;
  booked_count: number | string;
  remaining_capacity: number | string;
  overflow_count: number | string;
  overflow_policy: OperationalOverflowPolicy;
  status: "OPEN" | "BLOCKED";
  appointments: unknown;
}

interface OperationalSlotDefinitionRow {
  id: string;
  start_time: string;
  duration_minutes: number | string;
  standard_capacity: number | string;
  overflow_policy: OperationalOverflowPolicy;
  source: string;
  active: boolean;
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
      this.client.query<AppointmentRow>(
        `SELECT ${appointmentColumnsWithContext}
         FROM field_ops.appointments a
         JOIN field_ops.leads l ON l.id = a.lead_id
         LEFT JOIN field_ops.users setter_user ON setter_user.id = a.setter_id
         LEFT JOIN field_ops.users closer_user ON closer_user.id = a.closer_id
         WHERE a.lead_id = $1 ORDER BY a.scheduled_start DESC`, [id]),
      this.client.query<NoteRow>(`SELECT n.id, n.lead_id, n.appointment_id, n.author_id, CONCAT(u.first_name, ' ', u.last_name) AS author_name, (SELECT ur.role_id FROM field_ops.user_roles ur WHERE ur.user_id = n.author_id ORDER BY ur.role_id LIMIT 1) AS author_role, n.kind, n.body, n.created_at, n.updated_at FROM field_ops.notes n LEFT JOIN field_ops.users u ON u.id = n.author_id WHERE n.lead_id = $1 ORDER BY n.created_at DESC`, [id]),
      this.client.query<BillRow>(`SELECT id, lead_id, uploaded_by, storage_key, file_name, mime_type, file_size_bytes, replaced_by, replaced_at, created_at FROM field_ops.bill_attachments WHERE lead_id = $1 ORDER BY created_at DESC`, [id]),
      this.client.query<ActivityRow>(`SELECT a.id, a.lead_id, a.actor_id, CONCAT(u.first_name, ' ', u.last_name) AS actor_name, a.event_type, a.event_json, a.created_at FROM field_ops.activities a LEFT JOIN field_ops.users u ON u.id = a.actor_id WHERE a.lead_id = $1 ORDER BY a.created_at DESC`, [id]),
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

  async getBillContext(id: string): Promise<{ bill: FieldBillAttachment; lead: FieldLead } | null> {
    const result = await this.client.query<{ lead_id: string }>("SELECT lead_id FROM field_ops.bill_attachments WHERE id = $1", [id]);
    const leadId = result.rows[0]?.lead_id;
    if (!leadId) return null;
    const context = await this.getLeadContext(leadId);
    const bill = context?.bills.find((candidate) => candidate.id === id);
    return context && bill ? { bill, lead: context.lead } : null;
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
         RETURNING id, source_follow_up_id, property_id, setter_id, current_closer_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [id, input.propertyId ?? null, input.setterId, input.createdByUserId, input.teamId ?? null, input.homeownerName, input.phone ?? null, input.email ?? null, input.addressLine1, input.city ?? null, input.state ?? null, input.postalCode ?? null, input.latitude ?? null, input.longitude ?? null, input.utility ?? null, input.supplier ?? null, input.approximateMonthlyBill ?? null, JSON.stringify(input.qualification ?? {}), Boolean(input.isTestData)],
      );
      const lead = result.rows[0];
      if (!lead) throw new Error("Lead could not be created.");
      await appendActivity(client, id, input.createdByUserId, "LEAD_CREATED", { status: "KNOCKED" }, input.isTestData);
      await queueSync(client, id, input.isTestData);
      return toLead(lead);
    });
  }

  async createLeadWithAppointment(input: CreateFieldLeadWithAppointmentInput): Promise<{ lead: FieldLead; appointment: FieldAppointment } | null> {
    const leadId = input.id ?? randomUUID();
    const appointmentId = randomUUID();
    return this.withTransaction(async (client) => {
      // Reserve first. If the slot has filled since the picker loaded, no lead
      // row is inserted and the transaction returns null without side effects.
      const reserved = await client.query<{ id: string; slot_start: string | Date; slot_end: string | Date; timezone: string; is_overflow: boolean }>(
        `UPDATE field_ops.operational_slots
         SET booked_count = booked_count + 1,
             overflow_count = GREATEST(booked_count + 1 - standard_capacity, 0),
             updated_at = NOW()
         WHERE id = $1
           AND status = 'OPEN'
           AND (team_id IS NULL OR team_id = $2::uuid)
           AND (
             booked_count < standard_capacity
             OR (booked_count >= standard_capacity AND overflow_policy = 'ALLOW_WITH_WARNING' AND $3::boolean = TRUE)
           )
         RETURNING id, slot_start, slot_end, timezone, (booked_count > standard_capacity) AS is_overflow`,
        [input.operationalSlotId, input.teamId ?? null, Boolean(input.allowOverflow)],
      );
      const slot = reserved.rows[0];
      if (!slot) return null;

      const leadResult = await client.query<LeadRow>(
        `INSERT INTO field_ops.leads
          (id, property_id, setter_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, is_test_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, 'KNOCKED', $19)
         RETURNING id, source_follow_up_id, property_id, setter_id, current_closer_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [leadId, input.propertyId ?? null, input.setterId, input.createdByUserId, input.teamId ?? null, input.homeownerName, input.phone ?? null, input.email ?? null, input.addressLine1, input.city ?? null, input.state ?? null, input.postalCode ?? null, input.latitude ?? null, input.longitude ?? null, input.utility ?? null, input.supplier ?? null, input.approximateMonthlyBill ?? null, JSON.stringify(input.qualification ?? {}), Boolean(input.isTestData)],
      );
      const createdLead = leadResult.rows[0];
      if (!createdLead) throw new Error("Lead could not be created.");

      const appointmentResult = await client.query<AppointmentRow>(
        `INSERT INTO field_ops.appointments
           (id, lead_id, setter_id, closer_id, team_id, operational_slot_id, scheduled_start, scheduled_end, timezone, appointment_type, status, is_overflow, is_test_data)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, 'UNASSIGNED', $10, $11)
         RETURNING ${appointmentColumns}`,
        [appointmentId, leadId, input.setterId, input.teamId ?? null, slot.id, slot.slot_start, slot.slot_end, slot.timezone, input.appointmentType ?? "SOLAR_CONSULTATION", slot.is_overflow, Boolean(input.isTestData)],
      );
      const appointmentRow = appointmentResult.rows[0];
      if (!appointmentRow) throw new Error("Appointment could not be created.");

      const leadStatusResult = await client.query<LeadRow>(
        `UPDATE field_ops.leads SET status = 'APPOINTMENT_SET', updated_at = NOW() WHERE id = $1 RETURNING id, source_follow_up_id, property_id, setter_id, current_closer_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [leadId],
      );
      const lead = toLead(leadStatusResult.rows[0] ?? createdLead);
      const appointment = toAppointment(appointmentRow);
      await appendActivity(client, leadId, input.createdByUserId, "LEAD_CREATED", { status: "APPOINTMENT_SET", appointmentId: appointment.id }, input.isTestData);
      await appendActivity(client, leadId, input.createdByUserId, "APPOINTMENT_CREATED_UNASSIGNED", { appointmentId: appointment.id, operationalSlotId: slot.id, status: "UNASSIGNED", isOverflow: slot.is_overflow }, input.isTestData);
      await queueSync(client, leadId, input.isTestData);
      return { lead, appointment };
    });
  }

  async updateLeadStatus(input: { leadId: string; status: FieldLeadStatus; actorId: string; isTestData?: boolean }): Promise<FieldLead | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<LeadRow>(`${leadSelect} WHERE l.id = $1`, [input.leadId]);
      const current = currentResult.rows[0];
      if (!current) return null;
      const updatedResult = await client.query<LeadRow>(
        `UPDATE field_ops.leads
         SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, source_follow_up_id, property_id, setter_id, current_closer_id, created_by_user_id, team_id, homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude, utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [input.leadId, input.status],
      );
      const updated = updatedResult.rows[0];
      if (!updated) return null;
      await appendActivity(client, input.leadId, input.actorId, "LEAD_STATUS_UPDATED", { from: current.status, to: input.status }, input.isTestData);
      await queueSync(client, input.leadId, input.isTestData);
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

  async listOperationalSlots(input: { from: string; to: string; teamIds: string[] | null }): Promise<FieldOperationalSlot[]> {
    // Slots are materialized for the requested window so booking can lock a
    // single row. The global schedule is shared; team scope remains enforced
    // on the appointment/lead and assignment paths.
    await this.client.query(
      `INSERT INTO field_ops.operational_slots
         (id, team_id, slot_date, slot_definition_id, slot_start, slot_end, timezone, standard_capacity, overflow_policy, is_test_data)
       SELECT md5('operational-slot:' || days.slot_date::text || ':' || definitions.id)::uuid,
              NULL,
              days.slot_date,
              definitions.id,
              ((days.slot_date::date + definitions.start_time) AT TIME ZONE 'America/New_York'),
              ((days.slot_date::date + definitions.start_time + make_interval(mins => definitions.duration_minutes)) AT TIME ZONE 'America/New_York'),
              'America/New_York',
              definitions.standard_capacity,
              definitions.overflow_policy,
              FALSE
       FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS days(slot_date)
       CROSS JOIN field_ops.operational_slot_definitions definitions
       WHERE definitions.active = TRUE
       ON CONFLICT DO NOTHING`, [input.from, input.to]);

    const teamFilter = input.teamIds === null
      ? "TRUE"
      : input.teamIds.length > 0
        ? "(os.team_id IS NULL OR os.team_id = ANY($3::uuid[]))"
        : "os.team_id IS NULL";
    const params = input.teamIds === null || input.teamIds.length === 0 ? [input.from, input.to] : [input.from, input.to, input.teamIds];
    const result = await this.client.query<OperationalSlotRow>(
      `SELECT os.id, os.team_id, os.slot_date, to_char(definitions.start_time, 'HH24:MI') AS start_time,
              os.slot_start, os.slot_end, os.timezone, os.standard_capacity,
              os.booked_count, GREATEST(os.standard_capacity - os.booked_count, 0) AS remaining_capacity,
              os.overflow_count, os.overflow_policy, os.status,
              COALESCE(jsonb_agg(jsonb_build_object(
                'id', appointments.id, 'leadId', appointments.lead_id,
                'status', appointments.status, 'isOverflow', appointments.is_overflow
              ) ORDER BY appointments.scheduled_start) FILTER (WHERE appointments.id IS NOT NULL), '[]'::jsonb) AS appointments
       FROM field_ops.operational_slots os
       JOIN field_ops.operational_slot_definitions definitions ON definitions.id = os.slot_definition_id
       LEFT JOIN field_ops.appointments appointments
         ON appointments.operational_slot_id = os.id AND appointments.status <> 'CANCELLED'
       WHERE os.slot_start >= $1 AND os.slot_start < $2 AND ${teamFilter}
       GROUP BY os.id, definitions.start_time
       ORDER BY os.slot_date, definitions.start_time`, params);
    return result.rows.map(toOperationalSlot);
  }

  async listOperationalSlotDefinitions(): Promise<FieldOperationalSlotDefinition[]> {
    const result = await this.client.query<OperationalSlotDefinitionRow>(
      `SELECT id, to_char(start_time, 'HH24:MI') AS start_time, duration_minutes, standard_capacity, overflow_policy, source, active
       FROM field_ops.operational_slot_definitions WHERE active = TRUE ORDER BY start_time`,
    );
    return result.rows.map(toOperationalSlotDefinition);
  }

  async updateOperationalSlotDefinition(input: { id: string; standardCapacity: number; overflowPolicy: OperationalOverflowPolicy; actorId: string }): Promise<FieldOperationalSlotDefinition | null> {
    const result = await this.withTransaction(async (client) => {
      const updated = await client.query<OperationalSlotDefinitionRow>(
        `UPDATE field_ops.operational_slot_definitions
         SET standard_capacity = $2, overflow_policy = $3, updated_at = NOW()
         WHERE id = $1 AND active = TRUE
         RETURNING id, to_char(start_time, 'HH24:MI') AS start_time, duration_minutes, standard_capacity, overflow_policy, source, active`,
        [input.id, input.standardCapacity, input.overflowPolicy],
      );
      const definition = updated.rows[0];
      if (!definition) return null;
      await client.query(
        `UPDATE field_ops.operational_slots
         SET standard_capacity = $2,
             overflow_policy = $3,
             overflow_count = GREATEST(booked_count - $2, 0),
             updated_at = NOW()
         WHERE slot_definition_id = $1 AND slot_date >= CURRENT_DATE`,
        [input.id, input.standardCapacity, input.overflowPolicy],
      );
      return toOperationalSlotDefinition(definition);
    });
    return result;
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

  async createAppointment(input: { id?: string; leadId: string; setterId: string; teamId?: string | null; slotId?: string; operationalSlotId?: string; allowOverflow?: boolean; appointmentType?: string; isTestData?: boolean }): Promise<FieldAppointment | null> {
    const appointmentId = input.id ?? randomUUID();
    return this.withTransaction((client) => this.createAppointmentInTransaction(client, { ...input, id: appointmentId }));
  }

  private async createAppointmentInTransaction(client: SqlClient, input: { id: string; leadId: string; setterId: string; teamId?: string | null; slotId?: string; operationalSlotId?: string; allowOverflow?: boolean; appointmentType?: string; isTestData?: boolean }): Promise<FieldAppointment | null> {
    if (input.operationalSlotId) {
      const reserved = await client.query<{ id: string; slot_start: string | Date; slot_end: string | Date; timezone: string; is_overflow: boolean }>(
        `UPDATE field_ops.operational_slots
         SET booked_count = booked_count + 1,
             overflow_count = GREATEST(booked_count + 1 - standard_capacity, 0),
             updated_at = NOW()
         WHERE id = $1
           AND status = 'OPEN'
           AND (team_id IS NULL OR team_id = $2::uuid)
           AND (
             booked_count < standard_capacity
             OR (booked_count >= standard_capacity AND overflow_policy = 'ALLOW_WITH_WARNING' AND $3::boolean = TRUE)
           )
         RETURNING id, slot_start, slot_end, timezone, (booked_count > standard_capacity) AS is_overflow`,
        [input.operationalSlotId, input.teamId ?? null, Boolean(input.allowOverflow)],
      );
      const slot = reserved.rows[0];
      if (!slot) return null;
      const result = await client.query<AppointmentRow>(
        `INSERT INTO field_ops.appointments
           (id, lead_id, setter_id, closer_id, team_id, operational_slot_id, scheduled_start, scheduled_end, timezone, appointment_type, status, is_overflow, is_test_data)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, 'UNASSIGNED', $10, $11)
         RETURNING ${appointmentColumns}`,
        [input.id, input.leadId, input.setterId, input.teamId ?? null, slot.id, slot.slot_start, slot.slot_end, slot.timezone, input.appointmentType ?? "SOLAR_CONSULTATION", slot.is_overflow, Boolean(input.isTestData)],
      );
      const appointment = result.rows[0];
      if (!appointment) return null;
      await client.query("UPDATE field_ops.leads SET status = 'APPOINTMENT_SET', updated_at = NOW() WHERE id = $1", [input.leadId]);
      await appendActivity(client, input.leadId, input.setterId, "APPOINTMENT_CREATED_UNASSIGNED", {
        appointmentId: appointment.id, operationalSlotId: slot.id, status: "UNASSIGNED", isOverflow: slot.is_overflow,
      }, input.isTestData);
      await queueSync(client, input.leadId, input.isTestData);
      return toAppointment(appointment);
    }

    if (!input.slotId) return null;
    const result = await client.query<AppointmentRow>(
      `WITH reserved AS (
         UPDATE field_ops.closer_availability AS ca
         SET booked_count = booked_count + 1,
             status = CASE WHEN booked_count + 1 >= capacity THEN 'BOOKED' ELSE 'AVAILABLE' END,
             updated_at = NOW()
         WHERE ca.id = $1 AND ca.status = 'AVAILABLE' AND ca.booked_count < ca.capacity
           AND $5::uuid IS NOT NULL
           AND EXISTS (SELECT 1 FROM field_ops.user_teams slot_team WHERE slot_team.user_id = ca.closer_id AND slot_team.team_id = $5::uuid)
         RETURNING ca.id, ca.slot_start, ca.slot_end
       )
       INSERT INTO field_ops.appointments
         (id, lead_id, setter_id, closer_id, team_id, availability_slot_id, scheduled_start, scheduled_end, appointment_type, status, is_test_data)
       SELECT $2, $3, $4, NULL, $5, reserved.id, reserved.slot_start, reserved.slot_end, $6, 'UNASSIGNED', $7
       FROM reserved
       RETURNING ${appointmentColumns}`,
      [input.slotId, input.id, input.leadId, input.setterId, input.teamId ?? null, input.appointmentType ?? "SOLAR_CONSULTATION", Boolean(input.isTestData)]);
    const appointment = result.rows[0];
    if (!appointment) return null;
    await client.query("UPDATE field_ops.leads SET status = 'APPOINTMENT_SET', updated_at = NOW() WHERE id = $1", [input.leadId]);
    await appendActivity(client, input.leadId, input.setterId, "APPOINTMENT_CREATED_UNASSIGNED", { appointmentId: appointment.id, status: "UNASSIGNED" }, input.isTestData);
    await queueSync(client, input.leadId, input.isTestData);
    return toAppointment(appointment);
  }

  async listAppointments(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldAppointment[]> {
    const filter = scopeFilter("a", input.scope, input.userId, input.teamIds, 1);
    const result = await this.client.query<AppointmentRow>(
      `SELECT ${appointmentColumnsWithContext}
       FROM field_ops.appointments a
       JOIN field_ops.leads l ON l.id = a.lead_id
       LEFT JOIN field_ops.users setter_user ON setter_user.id = a.setter_id
       LEFT JOIN field_ops.users closer_user ON closer_user.id = a.closer_id
       WHERE ${filter.sql} ORDER BY a.scheduled_start DESC LIMIT 250`, filter.params);
    return result.rows.map(toAppointment);
  }

  async listAvailableClosers(input: { appointmentId: string; teamIds: string[] | null }): Promise<FieldCloserCandidate[]> {
    const teamFilter = input.teamIds === null ? "TRUE" : input.teamIds.length > 0 ? "EXISTS (SELECT 1 FROM field_ops.user_teams scoped_team WHERE scoped_team.user_id = u.id AND scoped_team.team_id = ANY($2::uuid[]))" : "FALSE";
    const params = input.teamIds === null || input.teamIds.length === 0 ? [input.appointmentId] : [input.appointmentId, input.teamIds];
    const result = await this.client.query<CloserCandidateRow>(
      `SELECT u.id,
              CONCAT(u.first_name, ' ', u.last_name) AS display_name,
              COALESCE(array_agg(DISTINCT ut.team_id::text) FILTER (WHERE ut.team_id IS NOT NULL), ARRAY[]::text[]) AS team_ids,
              COUNT(DISTINCT todays.id)::text AS appointments_today
       FROM field_ops.appointments a
       JOIN field_ops.users u ON u.active = TRUE
       LEFT JOIN field_ops.user_roles closer_role ON closer_role.user_id = u.id AND closer_role.role_id = 'CLOSER'
       LEFT JOIN field_ops.user_teams ut ON ut.user_id = u.id
       LEFT JOIN field_ops.appointments todays
         ON todays.closer_id = u.id
        AND todays.scheduled_start >= date_trunc('day', a.scheduled_start)
        AND todays.scheduled_start < date_trunc('day', a.scheduled_start) + INTERVAL '1 day'
        AND todays.status NOT IN ('CANCELLED', 'NO_SHOW')
       WHERE a.id = $1
         AND closer_role.user_id IS NOT NULL
         AND (a.team_id IS NULL OR EXISTS (SELECT 1 FROM field_ops.user_teams appointment_team WHERE appointment_team.user_id = u.id AND appointment_team.team_id = a.team_id))
         AND ${teamFilter}
         AND EXISTS (
           SELECT 1 FROM field_ops.closer_availability ca
           WHERE ca.closer_id = u.id
             AND ca.slot_start <= a.scheduled_start
             AND ca.slot_end >= a.scheduled_end
             AND ((ca.status = 'AVAILABLE' AND ca.booked_count < ca.capacity) OR ca.id = a.availability_slot_id)
         )
       GROUP BY u.id, u.first_name, u.last_name
       ORDER BY appointments_today, u.last_name, u.first_name`, params);
    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name.trim(), teamIds: row.team_ids, appointmentsToday: Number(row.appointments_today) }));
  }

  async assignAppointment(input: { appointmentId: string; closerId: string; assignedBy: string; teamIds: string[] | null; allowReassign?: boolean; isTestData?: boolean }): Promise<FieldAppointment | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<AssignmentRow>(
        `SELECT a.id, a.lead_id, a.setter_id, a.closer_id, a.team_id, a.availability_slot_id,
                a.scheduled_start, a.scheduled_end, a.status
         FROM field_ops.appointments a
         WHERE a.id = $1
         FOR UPDATE`, [input.appointmentId]);
      const current = currentResult.rows[0];
      if (!current || (current.status !== "UNASSIGNED" && !(input.allowReassign && ["ASSIGNED", "RESCHEDULED"].includes(current.status)))) return null;

      const teamFilter = input.teamIds === null ? "TRUE" : input.teamIds.length > 0 ? "EXISTS (SELECT 1 FROM field_ops.user_teams scoped_team WHERE scoped_team.user_id = u.id AND scoped_team.team_id = ANY($3::uuid[]))" : "FALSE";
      const closerResult = await client.query<{ id: string }>(
        `SELECT u.id
         FROM field_ops.users u
         WHERE u.id = $2 AND u.active = TRUE
           AND EXISTS (SELECT 1 FROM field_ops.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 'CLOSER')
           AND ( $1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM field_ops.appointments a WHERE a.id = $1 AND (a.team_id IS NULL OR EXISTS (SELECT 1 FROM field_ops.user_teams appointment_team WHERE appointment_team.user_id = u.id AND appointment_team.team_id = a.team_id))) )
           AND ${teamFilter}`,
        input.teamIds === null || input.teamIds.length === 0 ? [input.appointmentId, input.closerId] : [input.appointmentId, input.closerId, input.teamIds]);
      if (!closerResult.rows[0]) return null;

      const slotResult = await client.query<{ id: string; closer_id: string }>(
        `SELECT ca.id, ca.closer_id
         FROM field_ops.closer_availability ca
         WHERE ca.closer_id = $1
           AND ca.slot_start <= $2 AND ca.slot_end >= $3
           AND ((ca.status = 'AVAILABLE' AND ca.booked_count < ca.capacity) OR ca.id = $4::uuid)
         ORDER BY (ca.id = $4::uuid) DESC, ca.slot_start
         LIMIT 1
         FOR UPDATE`,
        [input.closerId, current.scheduled_start, current.scheduled_end, current.availability_slot_id]);
      const targetSlot = slotResult.rows[0];
      if (!targetSlot) return null;

      if (targetSlot.id !== current.availability_slot_id) {
        const reserved = await client.query<{ id: string }>(
          `UPDATE field_ops.closer_availability
           SET booked_count = booked_count + 1,
               status = CASE WHEN booked_count + 1 >= capacity THEN 'BOOKED' ELSE 'AVAILABLE' END,
               updated_at = NOW()
           WHERE id = $1 AND status = 'AVAILABLE' AND booked_count < capacity
           RETURNING id`, [targetSlot.id]);
        if (!reserved.rows[0]) return null;
        if (current.availability_slot_id) {
          await client.query(
            `UPDATE field_ops.closer_availability
             SET booked_count = GREATEST(booked_count - 1, 0),
                 status = CASE WHEN GREATEST(booked_count - 1, 0) < capacity THEN 'AVAILABLE' ELSE status END,
                 updated_at = NOW()
             WHERE id = $1`, [current.availability_slot_id]);
        }
      }

      const result = await client.query<AppointmentRow>(
        `UPDATE field_ops.appointments
         SET closer_id = $2, availability_slot_id = $3, status = 'ASSIGNED', assigned_at = NOW(), assigned_by = $4, updated_at = NOW()
         WHERE id = $1
         RETURNING ${appointmentColumns}`,
        [input.appointmentId, input.closerId, targetSlot.id, input.assignedBy]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      await client.query("UPDATE field_ops.leads SET current_closer_id = $2, updated_at = NOW() WHERE id = $1", [appointment.lead_id, input.closerId]);
      const reassigned = current.closer_id != null;
      await appendActivity(client, appointment.lead_id, input.assignedBy, reassigned ? "APPOINTMENT_REASSIGNED" : "APPOINTMENT_ASSIGNED", {
        appointmentId: appointment.id,
        fromCloserId: current.closer_id ?? null,
        toCloserId: input.closerId,
        oldCloserId: current.closer_id ?? null,
        newCloserId: input.closerId,
        old_closer_id: current.closer_id ?? null,
        new_closer_id: input.closerId,
        closerId: input.closerId,
        status: "ASSIGNED",
        message: reassigned ? "Closer changed" : "Closer assigned",
      }, input.isTestData);
      await appendActivity(client, appointment.lead_id, input.assignedBy, "CLOSER_ASSIGNED", {
        appointmentId: appointment.id,
        oldCloserId: current.closer_id ?? null,
        newCloserId: input.closerId,
        old_closer_id: current.closer_id ?? null,
        new_closer_id: input.closerId,
        status: "ASSIGNED",
        message: reassigned ? "Closer reassigned" : "Closer assigned",
      }, input.isTestData);
      await queueSync(client, appointment.lead_id, input.isTestData);
      const hydrated = await client.query<AppointmentRow>(
        `SELECT ${appointmentColumnsWithContext}
         FROM field_ops.appointments a
         JOIN field_ops.leads l ON l.id = a.lead_id
         LEFT JOIN field_ops.users setter_user ON setter_user.id = a.setter_id
         LEFT JOIN field_ops.users closer_user ON closer_user.id = a.closer_id
         WHERE a.id = $1`, [appointment.id]);
      return hydrated.rows[0] ? toAppointment(hydrated.rows[0]) : toAppointment(appointment);
    });
  }

  async recordOutcome(input: { appointmentId: string; actorId: string; closerId: string; status: FieldAppointmentStatus; outcome: FieldAppointmentOutcome; outcomeNotes?: string | null; isTestData?: boolean }): Promise<FieldAppointment | null> {
    return this.withTransaction(async (client) => {
      const result = await client.query<AppointmentRow>(
        `UPDATE field_ops.appointments
         SET status = $4, outcome = $3, outcome_notes = $5, completed_at = CASE WHEN $4 IN ('COMPLETED', 'NO_SHOW', 'CANCELLED') THEN NOW() ELSE completed_at END, updated_at = NOW()
         WHERE id = $1 AND closer_id = $2 AND status IN ('ASSIGNED', 'STARTED', 'RESCHEDULED')
         RETURNING ${appointmentColumns}`,
        [input.appointmentId, input.closerId, input.outcome, input.status, input.outcomeNotes ?? null]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      const leadStatus = outcomeLeadStatus(input.outcome);
      await client.query("UPDATE field_ops.leads SET status = $2, updated_at = NOW() WHERE id = $1", [appointment.lead_id, leadStatus]);
      const noteBody = input.outcomeNotes?.trim() ?? "";
      if (noteBody) {
        const noteResult = await client.query<{ id: string }>(
          `INSERT INTO field_ops.notes (id, lead_id, appointment_id, author_id, kind, body, is_test_data)
           VALUES ($1, $2, $3, $4, 'TEXT', $5, $6) RETURNING id`,
          [randomUUID(), appointment.lead_id, appointment.id, input.actorId, noteBody, Boolean(input.isTestData)]);
        if (noteResult.rows[0]) {
          await appendActivity(client, appointment.lead_id, input.actorId, "NOTE_ADDED", { noteId: noteResult.rows[0].id, appointmentId: appointment.id, source: "APPOINTMENT_OUTCOME" }, input.isTestData);
        }
      }
      await appendActivity(client, appointment.lead_id, input.actorId, "APPOINTMENT_OUTCOME_UPDATED", { appointmentId: appointment.id, outcome: input.outcome, status: input.status, hasCloserNote: Boolean(noteBody) }, input.isTestData);
      if (input.outcome === "CLOSED") {
        await appendActivity(client, appointment.lead_id, input.actorId, "DEAL_CLOSED", { appointmentId: appointment.id, outcome: input.outcome }, input.isTestData);
      }
      await queueSync(client, appointment.lead_id, input.isTestData);
      return toAppointment(appointment);
    });
  }

  async cancelAppointment(input: { appointmentId: string; actorId: string; cancelReason: string; isTestData?: boolean }): Promise<FieldAppointment | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<{
        id: string; lead_id: string; closer_id: string | null; availability_slot_id: string | null;
        operational_slot_id: string | null; status: FieldAppointmentStatus;
      }>(
        `SELECT id, lead_id, closer_id, availability_slot_id, operational_slot_id, status
         FROM field_ops.appointments WHERE id = $1 FOR UPDATE`, [input.appointmentId]);
      const current = currentResult.rows[0];
      if (!current || ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(current.status)) return null;

      if (current.operational_slot_id) {
        await client.query(
          `UPDATE field_ops.operational_slots
           SET booked_count = GREATEST(booked_count - 1, 0),
               overflow_count = GREATEST(GREATEST(booked_count - 1, 0) - standard_capacity, 0),
               updated_at = NOW()
           WHERE id = $1`, [current.operational_slot_id]);
      }
      if (current.availability_slot_id) {
        await client.query(
          `UPDATE field_ops.closer_availability
           SET booked_count = GREATEST(booked_count - 1, 0),
               status = CASE WHEN GREATEST(booked_count - 1, 0) < capacity THEN 'AVAILABLE' ELSE status END,
               updated_at = NOW()
           WHERE id = $1`, [current.availability_slot_id]);
      }

      const result = await client.query<AppointmentRow>(
        `UPDATE field_ops.appointments
         SET status = 'CANCELLED', outcome = 'CANCELLED', outcome_notes = $2,
             availability_slot_id = NULL,
             cancel_reason = $2, cancelled_at = NOW(), cancelled_by = $3,
             completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
         WHERE id = $1
         RETURNING ${appointmentColumns}`,
        [input.appointmentId, input.cancelReason.trim(), input.actorId]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      if (current.closer_id) {
        await client.query(
          `UPDATE field_ops.leads SET current_closer_id = NULL, updated_at = NOW()
           WHERE id = $1 AND current_closer_id = $2`, [appointment.lead_id, current.closer_id]);
      }
      await appendActivity(client, appointment.lead_id, input.actorId, "APPOINTMENT_CANCELLED", {
        appointmentId: appointment.id, cancelReason: input.cancelReason.trim(), previousStatus: current.status, previousCloserId: current.closer_id,
      }, input.isTestData);
      await queueSync(client, appointment.lead_id, input.isTestData);
      return toAppointment(appointment);
    });
  }

  async rescheduleAppointment(input: { appointmentId: string; operationalSlotId: string; actorId: string; allowOverflow?: boolean; isTestData?: boolean }): Promise<FieldAppointment | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<{
        id: string; lead_id: string; closer_id: string | null; team_id: string | null; availability_slot_id: string | null;
        operational_slot_id: string | null; scheduled_start: string | Date; scheduled_end: string | Date; timezone: string; status: FieldAppointmentStatus;
      }>(
        `SELECT id, lead_id, closer_id, team_id, availability_slot_id, operational_slot_id,
                scheduled_start, scheduled_end, timezone, status
         FROM field_ops.appointments WHERE id = $1 FOR UPDATE`, [input.appointmentId]);
      const current = currentResult.rows[0];
      if (!current || ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(current.status)) return null;

      let slot: { id: string; slot_start: string | Date; slot_end: string | Date; timezone: string; is_overflow: boolean } | undefined;
      if (current.operational_slot_id === input.operationalSlotId) {
        const same = await client.query<typeof slot>(
          `SELECT id, slot_start, slot_end, timezone, (booked_count > standard_capacity) AS is_overflow
           FROM field_ops.operational_slots WHERE id = $1 FOR UPDATE`, [input.operationalSlotId]);
        slot = same.rows[0];
      } else {
        const reserved = await client.query<typeof slot>(
          `UPDATE field_ops.operational_slots
           SET booked_count = booked_count + 1,
               overflow_count = GREATEST(booked_count + 1 - standard_capacity, 0),
               updated_at = NOW()
           WHERE id = $1 AND status = 'OPEN'
             AND (team_id IS NULL OR team_id = $2::uuid)
             AND (booked_count < standard_capacity OR (overflow_policy = 'ALLOW_WITH_WARNING' AND $3::boolean = TRUE))
           RETURNING id, slot_start, slot_end, timezone, (booked_count > standard_capacity) AS is_overflow`,
          [input.operationalSlotId, current.team_id, Boolean(input.allowOverflow)]);
        slot = reserved.rows[0];
      }
      if (!slot) return null;

      let nextCloserId = current.closer_id;
      let nextAvailabilitySlotId = current.closer_id ? current.availability_slot_id : null;
      let releasedCurrentAvailability = false;
      if (current.closer_id) {
        const closerSlotResult = await client.query<{ id: string }>(
          `SELECT ca.id
           FROM field_ops.closer_availability ca
           WHERE ca.closer_id = $1 AND ca.slot_start <= $2 AND ca.slot_end >= $3
             AND ((ca.status = 'AVAILABLE' AND ca.booked_count < ca.capacity) OR ca.id = $4::uuid)
           ORDER BY (ca.id = $4::uuid) DESC, ca.slot_start
           LIMIT 1 FOR UPDATE`,
          [current.closer_id, slot.slot_start, slot.slot_end, current.availability_slot_id]);
        const closerSlot = closerSlotResult.rows[0];
        if (closerSlot && closerSlot.id !== current.availability_slot_id) {
          const reservedCloser = await client.query<{ id: string }>(
            `UPDATE field_ops.closer_availability
             SET booked_count = booked_count + 1,
                 status = CASE WHEN booked_count + 1 >= capacity THEN 'BOOKED' ELSE 'AVAILABLE' END,
                 updated_at = NOW()
             WHERE id = $1 AND status = 'AVAILABLE' AND booked_count < capacity
             RETURNING id`, [closerSlot.id]);
          if (reservedCloser.rows[0]) {
            if (current.availability_slot_id) await releaseCloserAvailability(client, current.availability_slot_id);
            releasedCurrentAvailability = Boolean(current.availability_slot_id);
            nextAvailabilitySlotId = closerSlot.id;
          } else {
            if (current.availability_slot_id) await releaseCloserAvailability(client, current.availability_slot_id);
            releasedCurrentAvailability = Boolean(current.availability_slot_id);
            nextCloserId = null;
            nextAvailabilitySlotId = null;
          }
        } else if (!closerSlot) {
          if (current.availability_slot_id) await releaseCloserAvailability(client, current.availability_slot_id);
          releasedCurrentAvailability = Boolean(current.availability_slot_id);
          nextCloserId = null;
          nextAvailabilitySlotId = null;
        }
      }

      // Legacy appointments reserved closer availability even when they were
      // still unassigned. Moving them onto the shared operational schedule
      // must release that old reservation as part of the same transaction.
      if (current.availability_slot_id && !releasedCurrentAvailability && current.availability_slot_id !== nextAvailabilitySlotId) {
        await releaseCloserAvailability(client, current.availability_slot_id);
      }

      if (current.operational_slot_id && current.operational_slot_id !== input.operationalSlotId) {
        await releaseOperationalSlot(client, current.operational_slot_id);
      }
      const nextStatus: FieldAppointmentStatus = nextCloserId ? "RESCHEDULED" : "UNASSIGNED";
      const result = await client.query<AppointmentRow>(
        `UPDATE field_ops.appointments
         SET operational_slot_id = $2, is_overflow = $3,
             scheduled_start = $4, scheduled_end = $5, timezone = $6,
             closer_id = $7, availability_slot_id = $8, status = $9,
             outcome = NULL, outcome_notes = NULL,
             assigned_at = CASE WHEN $7::uuid IS NULL THEN NULL ELSE assigned_at END,
             assigned_by = CASE WHEN $7::uuid IS NULL THEN NULL ELSE assigned_by END,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${appointmentColumns}`,
        [input.appointmentId, slot.id, slot.is_overflow, slot.slot_start, slot.slot_end, slot.timezone, nextCloserId, nextAvailabilitySlotId, nextStatus]);
      const appointment = result.rows[0];
      if (!appointment) return null;
      if (nextCloserId) {
        await client.query("UPDATE field_ops.leads SET current_closer_id = $2, updated_at = NOW() WHERE id = $1", [appointment.lead_id, nextCloserId]);
      } else if (current.closer_id) {
        await client.query("UPDATE field_ops.leads SET current_closer_id = NULL, updated_at = NOW() WHERE id = $1 AND current_closer_id = $2", [appointment.lead_id, current.closer_id]);
      }
      await appendActivity(client, appointment.lead_id, input.actorId, "APPOINTMENT_RESCHEDULED", {
        appointmentId: appointment.id,
        oldOperationalSlotId: current.operational_slot_id,
        newOperationalSlotId: slot.id,
        oldScheduledStart: iso(current.scheduled_start),
        newScheduledStart: iso(slot.slot_start),
        closerRetained: Boolean(nextCloserId),
        isOverflow: slot.is_overflow,
      }, input.isTestData);
      await queueSync(client, appointment.lead_id, input.isTestData);
      return toAppointment(appointment);
    });
  }

  async addNote(input: { leadId: string; appointmentId?: string | null; authorId: string; body: string; isTestData?: boolean }): Promise<FieldNote> {
    return this.withTransaction(async (client) => {
      const result = await client.query<NoteRow>(
        `INSERT INTO field_ops.notes (id, lead_id, appointment_id, author_id, kind, body, is_test_data)
         VALUES ($1, $2, $3, $4, 'TEXT', $5, $6) RETURNING id, lead_id, appointment_id, author_id, kind, body, created_at, updated_at`,
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
      const priorResult = await client.query<{ id: string }>("SELECT id FROM field_ops.bill_attachments WHERE lead_id = $1 AND replaced_by IS NULL ORDER BY created_at DESC LIMIT 1", [input.leadId]);
      const priorBillId = priorResult.rows[0]?.id ?? null;
      const billId = randomUUID();
      const result = await client.query<BillRow>(
        `INSERT INTO field_ops.bill_attachments (id, lead_id, uploaded_by, storage_key, file_name, mime_type, file_size_bytes, is_test_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, lead_id, uploaded_by, storage_key, file_name, mime_type, file_size_bytes, replaced_by, replaced_at, created_at`,
        [billId, input.leadId, input.uploadedBy, input.storageKey, input.fileName, input.mimeType, input.fileSizeBytes, Boolean(input.isTestData)]);
      const bill = result.rows[0];
      if (!bill) throw new Error("Bill attachment could not be added.");
      if (priorBillId) {
        await client.query("UPDATE field_ops.bill_attachments SET replaced_by = $2, replaced_at = NOW() WHERE id = $1", [priorBillId, bill.id]);
      }
      await appendActivity(client, input.leadId, input.uploadedBy, priorBillId ? "BILL_REPLACED" : "BILL_UPLOADED", { billId: bill.id, previousBillId: priorBillId, fileName: input.fileName }, input.isTestData);
      await queueSync(client, input.leadId, input.isTestData);
      return toBill(bill);
    });
  }

  async listFollowUps(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<FieldFollowUp[]> {
    const filter = followUpScopeFilter(input.scope, input.userId, input.teamIds);
    const result = await this.client.query<FollowUpRow>(
      `${followUpSelect}
       WHERE ${filter.sql}
       ORDER BY CASE WHEN f.status IN ('OPEN', 'SNOOZED') THEN 0 ELSE 1 END,
                f.due_at ASC NULLS LAST, f.updated_at DESC
       LIMIT 500`, filter.params);
    return result.rows.map(toFollowUp);
  }

  async getFollowUp(id: string): Promise<FieldFollowUp | null> {
    const result = await this.client.query<FollowUpRow>(
      `${followUpSelect}
       WHERE f.id = $1`, [id]);
    return result.rows[0] ? toFollowUp(result.rows[0]) : null;
  }

  async createFollowUp(input: { id?: string; leadId?: string | null; teamId?: string | null; ownerUserId: string; dueAt?: string | null; dueDaypart?: string | null; homeownerName?: string; phone?: string | null; email?: string | null; addressLine1: string; city?: string | null; state?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; reason: string; note?: string; createdBy: string; isTestData?: boolean }): Promise<FieldFollowUp> {
    return this.withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO field_ops.follow_ups
          (id, lead_id, team_id, owner_user_id, due_at, due_daypart, homeowner_name, phone, email,
           address_line1, city, state, postal_code, latitude, longitude, reason, note, status, created_by, is_test_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'OPEN', $18, $19)
         RETURNING id`,
        [input.id ?? randomUUID(), input.leadId ?? null, input.teamId ?? null, input.ownerUserId, input.dueAt ?? null, input.dueDaypart ?? null,
          input.homeownerName ?? "", input.phone ?? null, input.email ?? null, input.addressLine1, input.city ?? null, input.state ?? null,
          input.postalCode ?? null, input.latitude ?? null, input.longitude ?? null, input.reason, input.note ?? "", input.createdBy, Boolean(input.isTestData)]);
      const created = result.rows[0];
      if (!created) throw new Error("Follow-up could not be created.");
      await appendFollowUpActivity(client, created.id, input.createdBy, "FOLLOW_UP_CREATED", {
        followUpId: created.id, dueAt: input.dueAt ?? null, dueDaypart: input.dueDaypart ?? null,
        reason: input.reason,
      }, input.isTestData);
      if (input.note?.trim()) await appendFollowUpActivity(client, created.id, input.createdBy, "FOLLOW_UP_NOTE_ADDED", { body: input.note.trim() }, input.isTestData);
      if (input.leadId) {
        await appendActivity(client, input.leadId, input.createdBy, "FOLLOW_UP_CREATED", { followUpId: created.id, dueAt: input.dueAt ?? null, reason: input.reason }, input.isTestData);
        await queueSync(client, input.leadId, input.isTestData);
      }
      const hydrated = await client.query<FollowUpRow>(`${followUpSelect} WHERE f.id = $1`, [created.id]);
      if (!hydrated.rows[0]) throw new Error("Follow-up could not be loaded after creation.");
      return toFollowUp(hydrated.rows[0]);
    });
  }

  async updateFollowUp(input: { id: string; actorId: string; status: FieldFollowUpStatus; dueAt?: string | null; dueDaypart?: string | null; convertedAppointmentId?: string | null }): Promise<FieldFollowUp | null> {
    return this.withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `UPDATE field_ops.follow_ups f
         SET status = $2,
             due_at = CASE WHEN $3::text IS NULL THEN f.due_at ELSE NULLIF($3::text, '')::timestamptz END,
             due_daypart = CASE WHEN $4::text IS NULL THEN f.due_daypart ELSE NULLIF($4::text, '') END,
             completed_at = CASE WHEN $2 IN ('DONE', 'CANCELLED', 'CONVERTED_TO_APPOINTMENT', 'CONVERTED') THEN COALESCE(f.completed_at, NOW()) ELSE NULL END,
             converted_appointment_id = COALESCE($5::uuid, f.converted_appointment_id),
             updated_at = NOW()
         WHERE f.id = $1
         RETURNING f.id`,
        [input.id, input.status, input.dueAt === undefined ? null : input.dueAt, input.dueDaypart === undefined ? null : input.dueDaypart, input.convertedAppointmentId ?? null]);
      const updated = result.rows[0];
      if (!updated) return null;
      const rescheduled = input.dueAt !== undefined || input.dueDaypart !== undefined;
      const activityType = rescheduled ? "FOLLOW_UP_RESCHEDULED" : input.status === "DONE" ? "FOLLOW_UP_COMPLETED" : input.status === "CANCELLED" ? "FOLLOW_UP_CANCELLED" : "FOLLOW_UP_UPDATED";
      await appendFollowUpActivity(client, updated.id, input.actorId, activityType, {
        followUpId: updated.id, status: input.status, dueAt: input.dueAt ?? null, dueDaypart: input.dueDaypart ?? null,
        convertedAppointmentId: input.convertedAppointmentId ?? null,
      });
      const hydrated = await client.query<FollowUpRow>(`${followUpSelect} WHERE f.id = $1`, [updated.id]);
      const followUp = hydrated.rows[0] ? toFollowUp(hydrated.rows[0]) : null;
      if (followUp?.leadId) {
        await appendActivity(client, followUp.leadId, input.actorId, activityType, { followUpId: updated.id, status: input.status, dueAt: input.dueAt ?? null }, false);
        await queueSync(client, followUp.leadId);
      }
      return followUp;
    });
  }

  async addFollowUpNote(input: { id: string; actorId: string; body: string; isTestData?: boolean }): Promise<FieldFollowUp | null> {
    return this.withTransaction(async (client) => {
      const updated = await client.query<{ id: string }>(
        `UPDATE field_ops.follow_ups SET updated_at = NOW() WHERE id = $1 RETURNING id`, [input.id]);
      if (!updated.rows[0]) return null;
      await appendFollowUpActivity(client, input.id, input.actorId, "FOLLOW_UP_NOTE_ADDED", { body: input.body }, input.isTestData);
      const hydrated = await client.query<FollowUpRow>(`${followUpSelect} WHERE f.id = $1`, [input.id]);
      const followUp = hydrated.rows[0] ? toFollowUp(hydrated.rows[0]) : null;
      if (followUp?.leadId) {
        await appendActivity(client, followUp.leadId, input.actorId, "FOLLOW_UP_NOTE_ADDED", { followUpId: input.id, body: input.body }, input.isTestData);
        await queueSync(client, followUp.leadId, input.isTestData);
      }
      return followUp;
    });
  }

  async convertFollowUpToLead(input: { followUpId: string; setterId: string; teamId?: string | null; isTestData?: boolean }): Promise<{ followUp: FieldFollowUp; lead: FieldLead } | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<FollowUpConversionRow>(
        `SELECT f.id, f.lead_id, f.team_id, f.owner_user_id, f.due_at, f.due_daypart, f.reason, f.note,
                f.homeowner_name, f.phone, f.email, f.address_line1, f.city, f.state, f.postal_code,
                f.latitude, f.longitude, f.status, f.converted_lead_id, f.is_test_data
         FROM field_ops.follow_ups f WHERE f.id = $1 FOR UPDATE`, [input.followUpId]);
      const current = currentResult.rows[0];
      if (!current || current.lead_id || current.converted_lead_id || current.status === "CONVERTED" || current.status === "CONVERTED_TO_APPOINTMENT") return null;

      const leadId = randomUUID();
      const leadResult = await client.query<LeadRow>(
        `INSERT INTO field_ops.leads
          (id, source_follow_up_id, property_id, setter_id, created_by_user_id, team_id, homeowner_name, phone, email,
           address_line1, city, state, postal_code, latitude, longitude, qualification_json, status, is_test_data)
         VALUES ($1, $2, NULL, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, 'KNOCKED', $15)
         RETURNING id, source_follow_up_id, property_id, setter_id, current_closer_id, created_by_user_id, team_id,
                   homeowner_name, phone, email, address_line1, city, state, postal_code, latitude, longitude,
                   utility, supplier, approximate_monthly_bill, qualification_json, status, created_at, updated_at`,
        [leadId, current.id, input.setterId, input.teamId ?? current.team_id ?? null,
          current.homeowner_name.trim() || `Homeowner at ${current.address_line1}`,
          current.phone, current.email, current.address_line1, current.city, current.state, current.postal_code,
          current.latitude, current.longitude, JSON.stringify({ source: "PRE_LEAD_FOLLOW_UP", followUpId: current.id }), Boolean(input.isTestData ?? current.is_test_data)]);
      const leadRow = leadResult.rows[0];
      if (!leadRow) throw new Error("Lead could not be created from the follow-up.");
      const lead = toLead(leadRow);

      const noteActivities = await client.query<{ actor_id: string | null; event_json: unknown }>(
        `SELECT actor_id, event_json FROM field_ops.follow_up_activities WHERE follow_up_id = $1 AND event_type = 'FOLLOW_UP_NOTE_ADDED' ORDER BY created_at ASC`, [current.id]);
      if (noteActivities.rows.length === 0 && current.note.trim()) {
        await insertLeadNote(client, lead.id, input.setterId, current.note, input.isTestData ?? current.is_test_data);
      }
      for (const activity of noteActivities.rows) {
        const event = parseJson(activity.event_json) as { body?: unknown };
        if (typeof event.body === "string" && event.body.trim()) await insertLeadNote(client, lead.id, activity.actor_id ?? input.setterId, event.body, input.isTestData ?? current.is_test_data);
      }
      await appendActivity(client, lead.id, input.setterId, "LEAD_CREATED", { status: "KNOCKED", sourceFollowUpId: current.id }, input.isTestData ?? current.is_test_data);
      await appendActivity(client, lead.id, input.setterId, "FOLLOW_UP_CONVERTED", { followUpId: current.id, leadId: lead.id }, input.isTestData ?? current.is_test_data);
      await queueSync(client, lead.id, input.isTestData ?? current.is_test_data);
      await client.query(
        `UPDATE field_ops.follow_ups SET status = 'CONVERTED', converted_lead_id = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [current.id, lead.id]);
      await appendFollowUpActivity(client, current.id, input.setterId, "FOLLOW_UP_CONVERTED", { followUpId: current.id, leadId: lead.id }, input.isTestData ?? current.is_test_data);
      const followUpResult = await client.query<FollowUpRow>(`${followUpSelect} WHERE f.id = $1`, [current.id]);
      const followUp = followUpResult.rows[0] ? toFollowUp(followUpResult.rows[0]) : null;
      return followUp ? { followUp, lead } : null;
    });
  }

  async convertFollowUpToAppointment(input: { followUpId: string; slotId?: string; operationalSlotId?: string; allowOverflow?: boolean; setterId: string; appointmentType?: string; isTestData?: boolean }): Promise<{ followUp: FieldFollowUp; appointment: FieldAppointment } | null> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<{ id: string; lead_id: string; owner_user_id: string; status: FieldFollowUpStatus; team_id: string | null }>(
        `SELECT f.id, f.lead_id, f.owner_user_id, f.status, l.team_id
         FROM field_ops.follow_ups f JOIN field_ops.leads l ON l.id = f.lead_id
         WHERE f.id = $1 FOR UPDATE`, [input.followUpId]);
      const current = currentResult.rows[0];
      if (!current || !["OPEN", "SNOOZED"].includes(current.status)) return null;
      const appointment = await this.createAppointmentInTransaction(client, {
        id: randomUUID(), leadId: current.lead_id, setterId: input.setterId, teamId: current.team_id,
        slotId: input.slotId, operationalSlotId: input.operationalSlotId, allowOverflow: input.allowOverflow, appointmentType: input.appointmentType, isTestData: input.isTestData,
      });
      if (!appointment) return null;
      await client.query(
        `UPDATE field_ops.follow_ups f
         SET status = 'CONVERTED_TO_APPOINTMENT', completed_at = NOW(), converted_appointment_id = $2, updated_at = NOW()
         WHERE f.id = $1`, [input.followUpId, appointment.id]);
      const updatedResult = await client.query<FollowUpRow>(`${followUpSelect} WHERE f.id = $1`, [input.followUpId]);
      const updated = updatedResult.rows[0];
      if (!updated) return null;
      await appendFollowUpActivity(client, input.followUpId, input.setterId, "FOLLOW_UP_CONVERTED_TO_APPOINTMENT", { followUpId: input.followUpId, appointmentId: appointment.id }, input.isTestData);
      await appendActivity(client, current.lead_id, input.setterId, "FOLLOW_UP_CONVERTED_TO_APPOINTMENT", { followUpId: input.followUpId, appointmentId: appointment.id });
      return { followUp: toFollowUp(updated), appointment };
    });
  }

  async getReport(input: { userId: string; teamIds: string[] | null; scope: FieldListScope }): Promise<{ leadCount: number; appointmentCount: number; byStatus: Array<{ status: string; count: number }>; byOutcome: Array<{ outcome: string; count: number }>; sync: { pending: number; synced: number; failed: number }; capacity: { standard: number; booked: number; remaining: number; overflow: number }; unassignedCount: number; confirmedCount: number; cancelledCount: number; cancellationReasons: Array<{ reason: string; count: number }> }> {
    await this.listOperationalSlots({ from: new Date().toISOString(), to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), teamIds: input.teamIds });
    const leadFilter = scopeFilter("l", input.scope, input.userId, input.teamIds, 1);
    const appointmentFilter = scopeFilter("a", input.scope, input.userId, input.teamIds, 1);
    const [leads, appointments, statuses, outcomes, sync, capacity, unassigned, confirmed, cancelled, cancellationReasons] = await Promise.all([
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.leads l WHERE ${leadFilter.sql}`, leadFilter.params),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql}`, appointmentFilter.params),
      this.client.query<{ status: string; count: string }>(`SELECT a.status, count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} GROUP BY a.status ORDER BY a.status`, appointmentFilter.params),
      this.client.query<{ outcome: string; count: string }>(`SELECT COALESCE(a.outcome, 'PENDING') AS outcome, count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} GROUP BY COALESCE(a.outcome, 'PENDING') ORDER BY outcome`, appointmentFilter.params),
      this.client.query<{ status: "PENDING" | "SYNCED" | "FAILED"; count: string }>(`SELECT s.status, count(*)::text AS count FROM field_ops.sheet_sync_jobs s JOIN field_ops.leads l ON l.id = s.lead_id WHERE ${leadFilter.sql} GROUP BY s.status`, leadFilter.params),
      this.client.query<{ standard: string; booked: string; remaining: string; overflow: string }>(
        `SELECT COALESCE(SUM(os.standard_capacity), 0)::text AS standard,
                COALESCE(SUM(os.booked_count), 0)::text AS booked,
                COALESCE(SUM(GREATEST(os.standard_capacity - os.booked_count, 0)), 0)::text AS remaining,
                COALESCE(SUM(os.overflow_count), 0)::text AS overflow
         FROM field_ops.operational_slots os
         WHERE os.slot_date >= CURRENT_DATE AND (os.team_id IS NULL OR $1::uuid[] IS NULL OR os.team_id = ANY($1::uuid[]))`,
        [input.teamIds]),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} AND a.status = 'UNASSIGNED'`, appointmentFilter.params),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} AND a.closer_id IS NOT NULL AND a.status IN ('ASSIGNED', 'STARTED', 'RESCHEDULED')`, appointmentFilter.params),
      this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} AND a.status = 'CANCELLED'`, appointmentFilter.params),
      this.client.query<{ reason: string; count: string }>(`SELECT COALESCE(NULLIF(a.cancel_reason, ''), 'Unspecified') AS reason, count(*)::text AS count FROM field_ops.appointments a WHERE ${appointmentFilter.sql} AND a.status = 'CANCELLED' GROUP BY 1 ORDER BY count(*) DESC, reason`, appointmentFilter.params),
    ]);
    const syncCounts = { pending: 0, synced: 0, failed: 0 };
    for (const row of sync.rows) syncCounts[row.status.toLowerCase() as keyof typeof syncCounts] = Number(row.count);
    const canonicalOutcomes = ["CLOSED", "SAT_NOT_CLOSED", "DID_NOT_SIT", "CREDIT_FAIL", "NO_SHOW", "NOT_QUALIFIED", "FOLLOW_UP", "RESCHEDULED", "CANCELLED"];
    const outcomeCounts = new Map(outcomes.rows.map((row) => [row.outcome, Number(row.count)]));
    const byOutcome = canonicalOutcomes.map((outcome) => ({ outcome, count: outcomeCounts.get(outcome) ?? 0 }));
    for (const row of outcomes.rows) {
      if (!canonicalOutcomes.includes(row.outcome)) byOutcome.push({ outcome: row.outcome, count: Number(row.count) });
    }
    return {
      leadCount: Number(leads.rows[0]?.count ?? 0), appointmentCount: Number(appointments.rows[0]?.count ?? 0),
      byStatus: statuses.rows.map((row) => ({ status: row.status, count: Number(row.count) })),
      byOutcome,
      sync: syncCounts,
      capacity: {
        standard: Number(capacity.rows[0]?.standard ?? 0),
        booked: Number(capacity.rows[0]?.booked ?? 0),
        remaining: Number(capacity.rows[0]?.remaining ?? 0),
        overflow: Number(capacity.rows[0]?.overflow ?? 0),
      },
      unassignedCount: Number(unassigned.rows[0]?.count ?? 0),
      confirmedCount: Number(confirmed.rows[0]?.count ?? 0),
      cancelledCount: Number(cancelled.rows[0]?.count ?? 0),
      cancellationReasons: cancellationReasons.rows.map((row) => ({ reason: row.reason, count: Number(row.count) })),
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
      await deleted("follow_up_activities");
      const followUps = await deleted("follow_ups");
      const appointments = await deleted("appointments");
      // QA appointments can share non-test operational slots. Rebuild those
      // counters after deleting test rows so a later seed cannot inherit stale
      // capacity from a prior run.
      await client.query(
        `UPDATE field_ops.operational_slots os
         SET booked_count = counts.booked_count,
             overflow_count = GREATEST(counts.booked_count - os.standard_capacity, 0),
             updated_at = NOW()
         FROM (
           SELECT os_inner.id, COUNT(a.id)::integer AS booked_count
           FROM field_ops.operational_slots os_inner
           LEFT JOIN field_ops.appointments a
             ON a.operational_slot_id = os_inner.id AND a.status <> 'CANCELLED'
           GROUP BY os_inner.id
         ) counts
         WHERE os.id = counts.id`,
      );
      const leads = await deleted("leads");
      const availabilitySlots = await deleted("closer_availability");
      return { leads, appointments, notes, billMetadata, activities, sheetSyncJobs, availabilitySlots, followUps };
    });
  }

  private async withTransaction<T>(callback: (client: SqlClient) => Promise<T>): Promise<T> {
    return this.client.transaction ? this.client.transaction(callback) : callback(this.client);
  }
}

interface AvailabilityRow { id: string; closer_id: string; closer_name: string; slot_start: string | Date; slot_end: string | Date; timezone: string; capacity: number | string; booked_count: number | string; status: "AVAILABLE" | "BLOCKED" | "BOOKED"; note: string | null; }
interface CloserCandidateRow { id: string; display_name: string; team_ids: string[]; appointments_today: number | string; }
interface AssignmentRow { id: string; lead_id: string; setter_id: string | null; closer_id: string | null; team_id: string | null; availability_slot_id: string | null; scheduled_start: string | Date; scheduled_end: string | Date; status: FieldAppointmentStatus; }
interface NoteRow { id: string; lead_id: string; appointment_id: string | null; author_id: string | null; author_name?: string | null; author_role?: string | null; kind: "TEXT" | "VOICE"; body: string | null; created_at: string | Date; updated_at: string | Date; }
interface BillRow { id: string; lead_id: string; uploaded_by: string | null; storage_key: string; file_name: string; mime_type: string; file_size_bytes: number | string; replaced_by: string | null; replaced_at: string | Date | null; created_at: string | Date; }
interface ActivityRow { id: string; lead_id: string; actor_id: string | null; actor_name?: string | null; event_type: string; event_json: unknown; created_at: string | Date; }
interface SyncRow { id: string; lead_id: string; status: "PENDING" | "SYNCED" | "FAILED"; attempts: number | string; last_synced_at: string | Date | null; last_error: string | null; next_attempt_at: string | Date | null; updated_at: string | Date; }
interface FollowUpRow {
  id: string; lead_id: string | null; team_id: string | null; owner_user_id: string; due_at: string | Date | null; due_daypart: string | null;
  reason: string; note: string; status: FieldFollowUpStatus; created_by: string | null; created_at: string | Date;
  completed_at: string | Date | null; updated_at: string | Date; converted_appointment_id: string | null; converted_lead_id: string | null;
  homeowner_name: string; address_line1: string; phone: string | null; email: string | null; city: string | null; state: string | null;
  postal_code: string | null; latitude: number | string | null; longitude: number | string | null; activities: unknown;
}
interface FollowUpConversionRow {
  id: string; lead_id: string | null; team_id: string | null; owner_user_id: string; due_at: string | Date | null; due_daypart: string | null;
  reason: string; note: string; homeowner_name: string; phone: string | null; email: string | null; address_line1: string;
  city: string | null; state: string | null; postal_code: string | null; latitude: number | string | null; longitude: number | string | null;
  status: FieldFollowUpStatus; converted_lead_id: string | null; is_test_data: boolean;
}

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

function followUpScopeFilter(scope: FieldListScope, userId: string, teamIds: string[] | null): { sql: string; params: unknown[] } {
  if (scope === "all") return { sql: "TRUE", params: [] };
  if (scope === "team") {
    if (teamIds === null) return { sql: "TRUE", params: [] };
    return teamIds.length > 0 ? { sql: "f.team_id = ANY($1::uuid[])", params: [teamIds] } : { sql: "FALSE", params: [] };
  }
  return { sql: "f.owner_user_id = $1", params: [userId] };
}

async function appendActivity(client: SqlClient, leadId: string, actorId: string, eventType: string, event: unknown, isTestData = false): Promise<void> {
  await client.query(`INSERT INTO field_ops.activities (id, lead_id, actor_id, event_type, event_json, is_test_data) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`, [randomUUID(), leadId, actorId, eventType, JSON.stringify(event ?? {}), Boolean(isTestData)]);
}

async function appendFollowUpActivity(client: SqlClient, followUpId: string, actorId: string, eventType: string, event: unknown, isTestData = false): Promise<void> {
  await client.query(`INSERT INTO field_ops.follow_up_activities (id, follow_up_id, actor_id, event_type, event_json, is_test_data) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`, [randomUUID(), followUpId, actorId, eventType, JSON.stringify(event ?? {}), Boolean(isTestData)]);
}

async function insertLeadNote(client: SqlClient, leadId: string, authorId: string, body: string, isTestData = false): Promise<void> {
  await client.query(
    `INSERT INTO field_ops.notes (id, lead_id, author_id, kind, body, is_test_data) VALUES ($1, $2, $3, 'TEXT', $4, $5)`,
    [randomUUID(), leadId, authorId, body, Boolean(isTestData)],
  );
}

async function queueSync(client: SqlClient, leadId: string, isTestData = false): Promise<void> {
  await client.query(
    `INSERT INTO field_ops.sheet_sync_jobs (id, lead_id, status, attempts, next_attempt_at, updated_at, is_test_data)
     VALUES ($1, $2, 'PENDING', 0, NOW(), NOW(), $3)
     ON CONFLICT (lead_id) DO UPDATE SET status = 'PENDING', last_error = NULL, next_attempt_at = NOW(), updated_at = NOW()`,
    [randomUUID(), leadId, Boolean(isTestData)],
  );
}

async function releaseCloserAvailability(client: SqlClient, id: string): Promise<void> {
  await client.query(
    `UPDATE field_ops.closer_availability
     SET booked_count = GREATEST(booked_count - 1, 0),
         status = CASE WHEN GREATEST(booked_count - 1, 0) < capacity THEN 'AVAILABLE' ELSE status END,
         updated_at = NOW()
     WHERE id = $1`, [id]);
}

async function releaseOperationalSlot(client: SqlClient, id: string): Promise<void> {
  await client.query(
    `UPDATE field_ops.operational_slots
     SET booked_count = GREATEST(booked_count - 1, 0),
         overflow_count = GREATEST(GREATEST(booked_count - 1, 0) - standard_capacity, 0),
         updated_at = NOW()
     WHERE id = $1`, [id]);
}

function toLead(row: LeadRow): FieldLead {
  return { id: row.id, sourceFollowUpId: row.source_follow_up_id ?? null, propertyId: row.property_id, setterId: row.setter_id, currentCloserId: row.current_closer_id, createdByUserId: row.created_by_user_id, teamId: row.team_id, homeownerName: row.homeowner_name, phone: row.phone, email: row.email, addressLine1: row.address_line1, city: row.city, state: row.state, postalCode: row.postal_code, latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude), utility: row.utility, supplier: row.supplier, approximateMonthlyBill: numberOrNull(row.approximate_monthly_bill), qualification: parseJson(row.qualification_json), status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function toAppointment(row: AppointmentRow): FieldAppointment {
  return { id: row.id, leadId: row.lead_id, setterId: row.setter_id, closerId: row.closer_id, teamId: row.team_id, availabilitySlotId: row.availability_slot_id ?? null, operationalSlotId: row.operational_slot_id ?? null, isOverflow: Boolean(row.is_overflow), scheduledStart: iso(row.scheduled_start), scheduledEnd: iso(row.scheduled_end), timezone: row.timezone, appointmentType: row.appointment_type, status: row.status, outcome: row.outcome, outcomeNotes: row.outcome_notes, startedAt: iso(row.started_at), completedAt: iso(row.completed_at), assignedAt: iso(row.assigned_at), assignedBy: row.assigned_by, notes: row.notes, cancelReason: row.cancel_reason ?? null, cancelledAt: iso(row.cancelled_at ?? null), cancelledBy: row.cancelled_by ?? null, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), homeownerName: row.homeowner_name ?? null, addressLine1: row.address_line1 ?? null, city: row.city ?? null, state: row.state ?? null, postalCode: row.postal_code ?? null, setterName: row.setter_name ?? null, closerName: row.closer_name ?? null, hasBill: row.has_bill == null ? undefined : Boolean(row.has_bill) };
}
function toAvailability(row: AvailabilityRow): FieldAvailabilitySlot { return { id: row.id, closerId: row.closer_id, closerName: row.closer_name.trim(), slotStart: iso(row.slot_start), slotEnd: iso(row.slot_end), timezone: row.timezone, capacity: Number(row.capacity), bookedCount: Number(row.booked_count), status: row.status, note: row.note }; }
function toOperationalSlot(row: OperationalSlotRow): FieldOperationalSlot {
  const appointments = Array.isArray(row.appointments) ? row.appointments : [];
  return {
    id: row.id,
    teamId: row.team_id,
    slotDate: row.slot_date instanceof Date ? row.slot_date.toISOString().slice(0, 10) : String(row.slot_date).slice(0, 10),
    startTime: row.start_time,
    slotStart: iso(row.slot_start),
    slotEnd: iso(row.slot_end),
    timezone: row.timezone,
    standardCapacity: Number(row.standard_capacity),
    bookedCount: Number(row.booked_count),
    remainingCapacity: Number(row.remaining_capacity),
    overflowCount: Number(row.overflow_count),
    overflowPolicy: row.overflow_policy,
    status: row.status,
    appointments: appointments as FieldOperationalSlotAppointment[],
  };
}
function toOperationalSlotDefinition(row: OperationalSlotDefinitionRow): FieldOperationalSlotDefinition {
  return { id: row.id, startTime: row.start_time, durationMinutes: Number(row.duration_minutes), standardCapacity: Number(row.standard_capacity), overflowPolicy: row.overflow_policy, source: row.source, active: row.active };
}
function toNote(row: NoteRow): FieldNote { return { id: row.id, leadId: row.lead_id, appointmentId: row.appointment_id, authorId: row.author_id, authorName: row.author_name ?? null, authorRole: row.author_role ?? null, kind: row.kind, body: row.body, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) }; }
function toBill(row: BillRow): FieldBillAttachment { return { id: row.id, leadId: row.lead_id, uploadedBy: row.uploaded_by, storageKey: row.storage_key, fileName: row.file_name, mimeType: row.mime_type, fileSizeBytes: Number(row.file_size_bytes), replacedBy: row.replaced_by, replacedAt: iso(row.replaced_at), createdAt: iso(row.created_at) }; }
function toActivity(row: ActivityRow): FieldActivity { return { id: row.id, leadId: row.lead_id, actorId: row.actor_id, actorName: row.actor_name ?? null, eventType: row.event_type, event: parseJson(row.event_json), createdAt: iso(row.created_at) }; }
function toSync(row: SyncRow): FieldSheetSyncJob { return { id: row.id, leadId: row.lead_id, status: row.status, attempts: Number(row.attempts), lastSyncedAt: iso(row.last_synced_at), lastError: row.last_error, nextAttemptAt: iso(row.next_attempt_at), updatedAt: iso(row.updated_at) }; }
function toFollowUp(row: FollowUpRow): FieldFollowUp {
  const activities = parseJson(row.activities);
  return {
    id: row.id, leadId: row.lead_id, teamId: row.team_id, convertedLeadId: row.converted_lead_id, ownerUserId: row.owner_user_id,
    dueAt: iso(row.due_at), dueDaypart: row.due_daypart ?? null, reason: row.reason, note: row.note ?? "", status: row.status,
    createdBy: row.created_by, createdAt: iso(row.created_at), completedAt: iso(row.completed_at), updatedAt: iso(row.updated_at),
    convertedAppointmentId: row.converted_appointment_id, homeownerName: row.homeowner_name ?? "", addressLine1: row.address_line1 ?? "",
    phone: row.phone ?? null, email: row.email ?? null, city: row.city ?? null, state: row.state ?? null, postalCode: row.postal_code ?? null,
    latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude), activities: Array.isArray(activities) ? activities.map((activity) => {
      const value = activity as Record<string, unknown>;
      return { id: String(value.id ?? ""), followUpId: String(value.followUpId ?? row.id), actorId: typeof value.actorId === "string" ? value.actorId : null, eventType: String(value.eventType ?? "ACTIVITY"), event: value.event ?? {}, createdAt: iso(String(value.createdAt ?? row.created_at)) };
    }) : [],
  };
}
function iso(value: string | Date): string;
function iso(value: string | Date | null): string | null;
function iso(value: string | Date | null): string | null { if (value == null) return null; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toISOString(); }
function numberOrNull(value: number | string | null): number | null { if (value == null) return null; const result = Number(value); return Number.isFinite(result) ? result : null; }
function parseJson(value: unknown): unknown { if (typeof value !== "string") return value ?? {}; try { return JSON.parse(value); } catch { return {}; } }
function outcomeLeadStatus(outcome: FieldAppointmentOutcome): FieldLeadStatus {
  switch (outcome) {
    case "CLOSED": return "CLOSED";
    case "SAT_NOT_CLOSED":
    case "SAT": return "SAT";
    case "DID_NOT_SIT":
    case "CREDIT_FAIL":
    case "FOLLOW_UP": return "FOLLOW_UP";
    case "NO_SHOW": return "NO_SHOW";
    case "NOT_QUALIFIED": return "NOT_QUALIFIED";
    case "PROPOSAL": return "PROPOSAL";
    case "NOT_INTERESTED": return "NOT_INTERESTED";
    case "RESCHEDULED": return "APPOINTMENT_SET";
    default: return "CANCELLED";
  }
}
