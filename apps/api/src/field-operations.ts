import type {
  CreateAvailabilityInput,
  CreateFieldLeadInput,
  CreateFieldLeadWithAppointmentInput,
  FieldBillAttachment,
  FieldAppointment,
  FieldAppointmentOutcome,
  FieldAppointmentStatus,
  FieldAvailabilitySlot,
  FieldOperationalSlot,
  FieldOperationalSlotDefinition,
  FieldFollowUp,
  FieldFollowUpStatus,
  FieldLead,
  FieldLeadContext,
  FieldListScope,
  FieldOperationsRepository,
} from "../../../packages/database/src/index";
import type { PlatformPermission } from "../../../packages/contracts/src/index";
import type { OperationalOverflowPolicy } from "../../../packages/database/src/operational-slots";
import type { AuthenticatedPlatformUser } from "./platform-auth";
import { PlatformHttpError, requireLeadScope, requirePermission } from "./platform-auth";
import { billStorageKey, createBillDownloadToken, type FieldBillStorage, verifyBillDownloadToken } from "./field-bill-storage";

export class FieldOperationsService {
  constructor(private readonly repository: FieldOperationsRepository, private readonly billStorage?: FieldBillStorage) {}

  async listLeads(user: AuthenticatedPlatformUser) {
    return this.repository.listLeads({ userId: user.id, teamIds: scopedTeams(user), scope: leadListScope(user) });
  }

  async getLead(user: AuthenticatedPlatformUser, leadId: string): Promise<FieldLeadContext> {
    const context = await this.repository.getLeadContext(leadId);
    if (!context) throw new PlatformHttpError(404, "Lead not found.", "LEAD_NOT_FOUND");
    requireLeadScope(user, context.lead);
    return context;
  }

  async createLead(user: AuthenticatedPlatformUser, input: Omit<CreateFieldLeadInput, "setterId" | "createdByUserId" | "teamId"> & { teamId?: string | null }): Promise<ReturnType<FieldOperationsRepository["createLead"]>> {
    requirePermission(user, "lead:create");
    const teamId = input.teamId ?? user.teamIds[0] ?? null;
    assertTeamAccess(user, teamId);
    return this.repository.createLead({ ...input, setterId: user.id, createdByUserId: user.id, teamId });
  }

  async createLeadWithAppointment(user: AuthenticatedPlatformUser, input: Omit<CreateFieldLeadWithAppointmentInput, "setterId" | "createdByUserId" | "teamId"> & { teamId?: string | null }): Promise<{ lead: FieldLead; appointment: FieldAppointment }> {
    requirePermission(user, "lead:create");
    requirePermission(user, "appointment:create");
    const teamId = input.teamId ?? user.teamIds[0] ?? null;
    assertTeamAccess(user, teamId);
    if (!this.repository.createLeadWithAppointment) throw new PlatformHttpError(503, "Operational scheduling is not available until the database is migrated.", "SCHEDULING_NOT_MIGRATED");
    const created = await this.repository.createLeadWithAppointment({ ...input, setterId: user.id, createdByUserId: user.id, teamId });
    if (!created) throw new PlatformHttpError(409, "That time just filled up. Choose another time.", "SLOT_UNAVAILABLE");
    return created;
  }

  async listAvailability(user: AuthenticatedPlatformUser, from: string, to: string): Promise<FieldAvailabilitySlot[]> {
    requireAny(user, ["appointment:create", "appointment:view-team", "appointment:assign"]);
    return this.repository.listAvailability({ from, to, teamIds: scopedTeams(user) });
  }

  async listOperationalSlots(user: AuthenticatedPlatformUser, from: string, to: string): Promise<FieldOperationalSlot[]> {
    requireAny(user, ["appointment:create", "appointment:view-own", "appointment:view-assigned", "appointment:view-team"]);
    if (!this.repository.listOperationalSlots) throw new PlatformHttpError(503, "Operational scheduling is not available until the database is migrated.", "SCHEDULING_NOT_MIGRATED");
    return this.repository.listOperationalSlots({ from, to, teamIds: scopedTeams(user) });
  }

  async listOperationalSlotDefinitions(user: AuthenticatedPlatformUser): Promise<FieldOperationalSlotDefinition[]> {
    requireAny(user, ["appointment:create", "appointment:view-own", "appointment:view-assigned", "appointment:view-team"]);
    if (!this.repository.listOperationalSlotDefinitions) throw new PlatformHttpError(503, "Operational scheduling is not available until the database is migrated.", "SCHEDULING_NOT_MIGRATED");
    return this.repository.listOperationalSlotDefinitions();
  }

  async updateOperationalSlotDefinition(user: AuthenticatedPlatformUser, id: string, standardCapacity: number, overflowPolicy: OperationalOverflowPolicy): Promise<FieldOperationalSlotDefinition> {
    requirePermission(user, "appointment:assign");
    if (!Number.isInteger(standardCapacity) || standardCapacity < 1 || standardCapacity > 100) throw new PlatformHttpError(400, "standardCapacity must be an integer from 1 to 100.", "SLOT_CAPACITY_INVALID");
    if (!this.repository.updateOperationalSlotDefinition) throw new PlatformHttpError(503, "Operational scheduling is not available until the database is migrated.", "SCHEDULING_NOT_MIGRATED");
    const updated = await this.repository.updateOperationalSlotDefinition({ id, standardCapacity, overflowPolicy, actorId: user.id });
    if (!updated) throw new PlatformHttpError(404, "Operational slot definition not found.", "SLOT_DEFINITION_NOT_FOUND");
    return updated;
  }

  async listEligibleClosers(user: AuthenticatedPlatformUser) {
    requireAny(user, ["appointment:assign", "appointment:create"]);
    return this.repository.listEligibleClosers(scopedTeams(user));
  }

  async listAvailableClosers(user: AuthenticatedPlatformUser, appointmentId: string) {
    requireAny(user, ["appointment:assign", "appointment:reassign"]);
    await this.getAppointment(user, appointmentId);
    return this.repository.listAvailableClosers({ appointmentId, teamIds: scopedTeams(user) });
  }

  async createAvailability(user: AuthenticatedPlatformUser, input: CreateAvailabilityInput): Promise<FieldAvailabilitySlot> {
    requirePermission(user, "appointment:assign");
    if (!isValidDate(input.slotStart) || !isValidDate(input.slotEnd) || new Date(input.slotEnd).getTime() <= new Date(input.slotStart).getTime()) {
      throw new PlatformHttpError(400, "Availability must include a valid start and end time, with the end after the start.", "AVAILABILITY_INVALID");
    }
    if (!Number.isInteger(input.capacity ?? 1) || (input.capacity ?? 1) < 1 || (input.capacity ?? 1) > 100) {
      throw new PlatformHttpError(400, "Capacity must be an integer from 1 to 100.", "AVAILABILITY_CAPACITY_INVALID");
    }
    const closers = await this.repository.listEligibleClosers(scopedTeams(user));
    const closer = closers.find((candidate) => candidate.id === input.closerId);
    if (!closer) throw new PlatformHttpError(403, "That closer is not eligible for your team.", "CLOSER_NOT_ELIGIBLE");
    let created: FieldAvailabilitySlot | null;
    try {
      created = await this.repository.createAvailability(input);
    } catch (cause) {
      if (isUniqueConstraintError(cause, "idx_field_ops_closer_slot_start")) {
        throw new PlatformHttpError(409, "This closer already has availability at that start time.", "AVAILABILITY_EXISTS");
      }
      throw cause;
    }
    if (!created) throw new PlatformHttpError(400, "Availability could not be created for that closer.", "AVAILABILITY_INVALID");
    return created;
  }

  async createAppointment(user: AuthenticatedPlatformUser, leadId: string, input: { slotId?: string; operationalSlotId?: string; allowOverflow?: boolean; appointmentType?: string }): Promise<FieldAppointment> {
    requirePermission(user, "appointment:create");
    if (!input.slotId && !input.operationalSlotId) throw new PlatformHttpError(400, "An operational slot is required.", "SLOT_REQUIRED");
    const context = await this.getLead(user, leadId);
    const appointment = await this.repository.createAppointment({ leadId, setterId: user.id, teamId: context.lead.teamId ?? user.teamIds[0] ?? null, slotId: input.slotId, operationalSlotId: input.operationalSlotId, allowOverflow: input.allowOverflow, appointmentType: input.appointmentType });
    if (!appointment) throw new PlatformHttpError(409, input.allowOverflow ? "That operational slot is no longer available or does not allow overflow." : "That operational slot is full. Confirm an explicit overflow booking to continue.", input.allowOverflow ? "SLOT_UNAVAILABLE" : "OVERFLOW_CONFIRMATION_REQUIRED");
    return appointment;
  }

  async cancelAppointment(user: AuthenticatedPlatformUser, appointmentId: string, cancelReason: string): Promise<FieldAppointment> {
    requirePermission(user, "appointment:cancel");
    if (!cancelReason.trim()) throw new PlatformHttpError(400, "A cancellation reason is required.", "CANCEL_REASON_REQUIRED");
    const { appointment } = await this.getAppointment(user, appointmentId);
    if (!this.repository.cancelAppointment) throw new PlatformHttpError(503, "Appointment cancellation is not available until the database is migrated.", "SCHEDULING_NOT_MIGRATED");
    const cancelled = await this.repository.cancelAppointment({ appointmentId: appointment.id, actorId: user.id, cancelReason: cancelReason.trim() });
    if (!cancelled) throw new PlatformHttpError(409, "Only active appointments can be cancelled.", "APPOINTMENT_CANCEL_CONFLICT");
    return cancelled;
  }

  async rescheduleAppointment(user: AuthenticatedPlatformUser, appointmentId: string, operationalSlotId: string, allowOverflow = false): Promise<FieldAppointment> {
    requirePermission(user, "appointment:reschedule");
    const { appointment } = await this.getAppointment(user, appointmentId);
    if (!this.repository.rescheduleAppointment) throw new PlatformHttpError(503, "Appointment rescheduling is not available until the database is migrated.", "SCHEDULING_NOT_MIGRATED");
    const rescheduled = await this.repository.rescheduleAppointment({ appointmentId: appointment.id, operationalSlotId, actorId: user.id, allowOverflow });
    if (!rescheduled) throw new PlatformHttpError(409, allowOverflow ? "The destination slot is unavailable or overflow is not permitted." : "The destination slot is full. Confirm overflow to continue.", "RESCHEDULE_CONFLICT");
    return rescheduled;
  }

  async listAppointments(user: AuthenticatedPlatformUser): Promise<FieldAppointment[]> {
    requireAny(user, ["appointment:view-own", "appointment:view-assigned", "appointment:view-team", "appointment:reassign"]);
    return this.repository.listAppointments({ userId: user.id, teamIds: scopedTeams(user), scope: appointmentListScope(user) });
  }

  async getAppointment(user: AuthenticatedPlatformUser, appointmentId: string): Promise<{ context: FieldLeadContext; appointment: FieldAppointment }> {
    const context = await this.repository.getAppointmentContext(appointmentId);
    const appointment = context?.appointments.find((candidate) => candidate.id === appointmentId);
    if (!context || !appointment) throw new PlatformHttpError(404, "Appointment not found.", "APPOINTMENT_NOT_FOUND");
    // A cancelled appointment keeps its closer association for history, even
    // though it no longer contributes workload or active lead assignment.
    if (!(appointment.status === "CANCELLED" && appointment.closerId === user.id && user.permissions.includes("appointment:view-assigned"))) {
      requireLeadScope(user, context.lead);
    }
    return { context, appointment };
  }

  async assignAppointment(user: AuthenticatedPlatformUser, appointmentId: string, closerId: string): Promise<FieldAppointment> {
    const { appointment } = await this.getAppointment(user, appointmentId);
    if (appointment.status === "UNASSIGNED") requirePermission(user, "appointment:assign");
    else requirePermission(user, "appointment:reassign");
    if (appointment.status !== "UNASSIGNED" && !["ASSIGNED", "RESCHEDULED"].includes(appointment.status)) {
      throw new PlatformHttpError(409, "Only an unassigned appointment can be assigned.", "APPOINTMENT_NOT_ASSIGNABLE");
    }
    const assigned = await this.repository.assignAppointment({ appointmentId, closerId, assignedBy: user.id, teamIds: scopedTeams(user), allowReassign: user.permissions.includes("appointment:reassign") });
    if (!assigned) {
      const time = new Date(appointment.scheduledStart).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      throw new PlatformHttpError(409, `That closer is unavailable or has a conflicting ${time} appointment. Choose another AVAILABLE closer.`, "ASSIGNMENT_CONFLICT");
    }
    return assigned;
  }

  async recordOutcome(user: AuthenticatedPlatformUser, appointmentId: string, input: { outcome: FieldAppointmentOutcome; status?: FieldAppointmentStatus; outcomeNotes?: string | null }): Promise<FieldAppointment> {
    requirePermission(user, "appointment:update-outcome");
    if (input.outcome === "CANCELLED") return this.cancelAppointment(user, appointmentId, input.outcomeNotes ?? "Cancelled from appointment outcome.");
    const { context, appointment } = await this.getAppointment(user, appointmentId);
    if (!appointment.closerId) throw new PlatformHttpError(409, "The appointment must be assigned before an outcome is recorded.", "APPOINTMENT_UNASSIGNED");
    if (user.roles.includes("CLOSER") && appointment.closerId !== user.id && !user.permissions.includes("appointment:view-team")) {
      throw new PlatformHttpError(403, "Only the assigned closer can update this outcome.", "OUTCOME_FORBIDDEN");
    }
    const status = input.status ?? outcomeStatus(input.outcome);
    if (!allowedOutcomeStatus(input.outcome, status)) throw new PlatformHttpError(400, "That outcome and appointment status are not compatible.", "OUTCOME_INVALID");
    const updated = await this.repository.recordOutcome({ appointmentId, actorId: user.id, closerId: appointment.closerId, status, outcome: input.outcome, outcomeNotes: input.outcomeNotes });
    if (!updated) throw new PlatformHttpError(409, "The appointment outcome could not be recorded from its current state.", "OUTCOME_CONFLICT");
    return updated;
  }

  async addNote(user: AuthenticatedPlatformUser, leadId: string, input: { appointmentId?: string | null; body: string }) {
    const context = await this.getLead(user, leadId);
    requireAny(user, ["lead:update-own", "lead:update-all"]);
    if (!input.body.trim()) throw new PlatformHttpError(400, "Note body is required.", "NOTE_REQUIRED");
    if (input.appointmentId && !context.appointments.some((appointment) => appointment.id === input.appointmentId)) throw new PlatformHttpError(400, "Appointment does not belong to this lead.", "APPOINTMENT_INVALID");
    return this.repository.addNote({ leadId, appointmentId: input.appointmentId, authorId: user.id, body: input.body.trim() });
  }

  async addBill(user: AuthenticatedPlatformUser, leadId: string, input: { fileName: string; mimeType: string; fileSizeBytes: number; content: Buffer }) {
    await this.getLead(user, leadId);
    requirePermission(user, "bill:upload");
    if (!input.fileName || !input.mimeType || !Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0) throw new PlatformHttpError(400, "A valid bill file is required.", "BILL_INVALID");
    if (input.fileSizeBytes > 10 * 1024 * 1024) throw new PlatformHttpError(413, "Bills must be 10 MB or smaller.", "BILL_TOO_LARGE");
    const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"]);
    if (!allowedMimeTypes.has(input.mimeType.toLowerCase())) throw new PlatformHttpError(400, "Bills must be a PDF, JPG, PNG, or HEIC image.", "BILL_TYPE_INVALID");
    if (!input.content || input.content.byteLength === 0) throw new PlatformHttpError(400, "Bill file content is required.", "BILL_CONTENT_REQUIRED");
    if (!isSupportedBillContent(input.content, input.mimeType.toLowerCase())) throw new PlatformHttpError(400, "The uploaded bill content does not match its file type.", "BILL_CONTENT_INVALID");
    if (!this.billStorage) throw new PlatformHttpError(503, "Bill storage is not configured.", "BILL_STORAGE_UNAVAILABLE");
    const storageKey = billStorageKey(leadId);
    await this.billStorage.put(storageKey, input.content, input.mimeType);
    return this.repository.addBill({ leadId, uploadedBy: user.id, storageKey, fileName: input.fileName, mimeType: input.mimeType, fileSizeBytes: input.fileSizeBytes });
  }

  async createBillDownloadUrl(user: AuthenticatedPlatformUser, billId: string): Promise<{ url: string; expiresAt: string }> {
    const record = await this.repository.getBillContext(billId);
    if (!record) throw new PlatformHttpError(404, "Bill not found.", "BILL_NOT_FOUND");
    requireLeadScope(user, record.lead);
    requireBillViewPermission(user, record.lead);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const token = createBillDownloadToken(billId, expiresAt);
    return { url: `/api/v1/field/bills/${encodeURIComponent(billId)}/download?token=${encodeURIComponent(token)}`, expiresAt: new Date(expiresAt).toISOString() };
  }

  async downloadBill(user: AuthenticatedPlatformUser, billId: string, token: string | null): Promise<{ bill: FieldBillAttachment; content: Buffer }> {
    const record = await this.repository.getBillContext(billId);
    if (!record) throw new PlatformHttpError(404, "Bill not found.", "BILL_NOT_FOUND");
    requireLeadScope(user, record.lead);
    requireBillViewPermission(user, record.lead);
    if (!token || !verifyBillDownloadToken(token, billId)) throw new PlatformHttpError(403, "This bill link is missing or has expired.", "BILL_LINK_EXPIRED");
    if (!this.billStorage) throw new PlatformHttpError(503, "Bill storage is not configured.", "BILL_STORAGE_UNAVAILABLE");
    try {
      return { bill: record.bill, content: await this.billStorage.get(record.bill.storageKey) };
    } catch {
      throw new PlatformHttpError(404, "The bill file is no longer available.", "BILL_FILE_NOT_FOUND");
    }
  }

  async listFollowUps(user: AuthenticatedPlatformUser): Promise<FieldFollowUp[]> {
    requireAny(user, ["followup:view-own", "followup:view-team"]);
    return this.repository.listFollowUps({ userId: user.id, teamIds: scopedTeams(user), scope: followUpListScope(user) });
  }

  async getFollowUp(user: AuthenticatedPlatformUser, followUpId: string): Promise<FieldFollowUp> {
    const followUp = await this.repository.getFollowUp(followUpId);
    if (!followUp) throw new PlatformHttpError(404, "Follow-up not found.", "FOLLOW_UP_NOT_FOUND");
    const canViewTeam = user.permissions.includes("*" as PlatformPermission) || (user.permissions.includes("followup:view-team") && (followUp.teamId == null || user.teamIds.includes(followUp.teamId)));
    const canViewOwn = user.permissions.includes("*" as PlatformPermission) || (user.permissions.includes("followup:view-own") && followUp.ownerUserId === user.id);
    if (!canViewTeam && !canViewOwn) throw new PlatformHttpError(403, "You do not have access to this follow-up.", "FOLLOW_UP_FORBIDDEN");
    return followUp;
  }

  async createFollowUp(user: AuthenticatedPlatformUser, input: { leadId?: string | null; teamId?: string | null; dueAt?: string | null; dueDaypart?: string | null; homeownerName?: string | null; phone?: string | null; email?: string | null; addressLine1?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; reason: string; note?: string }): Promise<FieldFollowUp> {
    requirePermission(user, "followup:create");
    const linkedLead = input.leadId ? await this.getLead(user, input.leadId) : null;
    const lead = linkedLead?.lead;
    const addressLine1 = (input.addressLine1 ?? lead?.addressLine1 ?? "").trim();
    if (!addressLine1) throw new PlatformHttpError(400, "A property address is required.", "FOLLOW_UP_ADDRESS_REQUIRED");
    if (input.dueAt != null && !isValidDate(input.dueAt)) throw new PlatformHttpError(400, "dueAt must be a valid date.", "FOLLOW_UP_INVALID");
    if (input.dueAt == null && !input.dueDaypart) throw new PlatformHttpError(400, "Choose a follow-up time or daypart.", "FOLLOW_UP_SCHEDULE_REQUIRED");
    if (input.dueDaypart != null && !validFollowUpDaypart(input.dueDaypart)) throw new PlatformHttpError(400, "That follow-up daypart is not supported.", "FOLLOW_UP_DAYPART_INVALID");
    if (!input.reason.trim()) throw new PlatformHttpError(400, "A follow-up reason is required.", "FOLLOW_UP_REASON_REQUIRED");
    const teamId = input.teamId ?? lead?.teamId ?? user.teamIds[0] ?? null;
    assertTeamAccess(user, teamId);
    return this.repository.createFollowUp({
      leadId: input.leadId ?? null, teamId, ownerUserId: user.id, dueAt: input.dueAt ?? null, dueDaypart: input.dueDaypart ?? null,
      homeownerName: input.homeownerName?.trim() ?? lead?.homeownerName ?? "", phone: input.phone?.trim() || lead?.phone || null, email: input.email?.trim() || lead?.email || null,
      addressLine1, city: input.city?.trim() || lead?.city || null, state: input.state?.trim() || lead?.state || null, postalCode: input.postalCode?.trim() || lead?.postalCode || null,
      latitude: input.latitude ?? lead?.latitude ?? null, longitude: input.longitude ?? lead?.longitude ?? null, reason: input.reason.trim(), note: input.note?.trim() ?? "", createdBy: user.id,
    });
  }

  async updateFollowUp(user: AuthenticatedPlatformUser, followUpId: string, input: { status: FieldFollowUpStatus; dueAt?: string | null; dueDaypart?: string | null }): Promise<FieldFollowUp> {
    requirePermission(user, "followup:update-own");
    const followUp = await this.getFollowUp(user, followUpId);
    if (followUp.ownerUserId !== user.id && !user.permissions.includes("*" as PlatformPermission)) throw new PlatformHttpError(403, "Only the follow-up owner can update it.", "FOLLOW_UP_OWNER_REQUIRED");
    if (input.dueAt != null && !isValidDate(input.dueAt)) throw new PlatformHttpError(400, "dueAt must be a valid date.", "FOLLOW_UP_INVALID");
    if (input.dueDaypart && !validFollowUpDaypart(input.dueDaypart)) throw new PlatformHttpError(400, "That follow-up daypart is not supported.", "FOLLOW_UP_DAYPART_INVALID");
    if (!( ["DONE", "SNOOZED", "CANCELLED"] as FieldFollowUpStatus[]).includes(input.status)) throw new PlatformHttpError(400, "That follow-up status cannot be set directly.", "FOLLOW_UP_STATUS_INVALID");
    const updated = await this.repository.updateFollowUp({ id: followUp.id, actorId: user.id, status: input.status, dueAt: input.dueAt, dueDaypart: input.dueDaypart });
    if (!updated) throw new PlatformHttpError(409, "The follow-up could not be updated.", "FOLLOW_UP_CONFLICT");
    return updated;
  }

  async addFollowUpNote(user: AuthenticatedPlatformUser, followUpId: string, body: string): Promise<FieldFollowUp> {
    requirePermission(user, "followup:update-own");
    const followUp = await this.getFollowUp(user, followUpId);
    if (followUp.ownerUserId !== user.id && !user.permissions.includes("*" as PlatformPermission)) throw new PlatformHttpError(403, "Only the follow-up owner can update it.", "FOLLOW_UP_OWNER_REQUIRED");
    const note = body.trim();
    if (!note) throw new PlatformHttpError(400, "A note is required.", "FOLLOW_UP_NOTE_REQUIRED");
    const updated = await this.repository.addFollowUpNote({ id: followUp.id, actorId: user.id, body: note });
    if (!updated) throw new PlatformHttpError(409, "The follow-up could not be updated.", "FOLLOW_UP_CONFLICT");
    return updated;
  }

  async convertFollowUpToLead(user: AuthenticatedPlatformUser, followUpId: string): Promise<{ followUp: FieldFollowUp; lead: FieldLead }> {
    requirePermission(user, "lead:create");
    const followUp = await this.getFollowUp(user, followUpId);
    assertTeamAccess(user, followUp.teamId);
    const converted = await this.repository.convertFollowUpToLead({ followUpId: followUp.id, setterId: user.id, teamId: followUp.teamId });
    if (!converted) throw new PlatformHttpError(409, "This follow-up has already been converted or is no longer available.", "FOLLOW_UP_ALREADY_CONVERTED");
    return converted;
  }

  async convertFollowUp(user: AuthenticatedPlatformUser, followUpId: string, slot: { slotId?: string; operationalSlotId?: string; allowOverflow?: boolean }, appointmentType?: string): Promise<{ followUp: FieldFollowUp; appointment: FieldAppointment }> {
    requirePermission(user, "appointment:create");
    if (!slot.slotId && !slot.operationalSlotId) throw new PlatformHttpError(400, "An operational slot is required.", "SLOT_REQUIRED");
    const followUp = await this.getFollowUp(user, followUpId);
    const converted = await this.repository.convertFollowUpToAppointment({ followUpId: followUp.id, ...slot, setterId: user.id, appointmentType });
    if (!converted) throw new PlatformHttpError(409, "The follow-up is no longer open or that capacity slot is unavailable.", "FOLLOW_UP_CONFLICT");
    return converted;
  }

  async report(user: AuthenticatedPlatformUser) {
    const scope = user.permissions.includes("reports:view") || user.permissions.includes("*" as PlatformPermission) ? "team" : "own";
    requireAny(user, ["reports:view", "reports:view-own"]);
    return this.repository.getReport({ userId: user.id, teamIds: scopedTeams(user), scope });
  }

  async activity(user: AuthenticatedPlatformUser, leadId: string) {
    const context = await this.getLead(user, leadId);
    return context.activities;
  }
}

function requireBillViewPermission(user: AuthenticatedPlatformUser, lead: { teamId: string | null; createdByUserId: string | null; setterId: string | null; currentCloserId: string | null }): void {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes("bill:view-all")) return;
  if (user.permissions.includes("bill:view-assigned") && lead.currentCloserId === user.id) return;
  if (user.permissions.includes("bill:view-own") && [lead.createdByUserId, lead.setterId].includes(user.id)) return;
  throw new PlatformHttpError(403, "You do not have permission to view this bill.", "BILL_VIEW_FORBIDDEN");
}

function requireAny(user: AuthenticatedPlatformUser, permissions: readonly PlatformPermission[]): void {
  if (user.permissions.includes("*" as PlatformPermission) || permissions.some((permission) => user.permissions.includes(permission))) return;
  throw new PlatformHttpError(403, "You do not have permission to perform this action.", "FORBIDDEN");
}

function scopedTeams(user: AuthenticatedPlatformUser): string[] | null {
  return user.permissions.includes("*" as PlatformPermission) || user.permissions.includes("system:manage") ? null : user.teamIds;
}

function assertTeamAccess(user: AuthenticatedPlatformUser, teamId: string | null): void {
  if (teamId && !scopedTeams(user)?.includes(teamId) && !user.permissions.includes("*" as PlatformPermission)) throw new PlatformHttpError(403, "You cannot operate outside your team.", "TEAM_SCOPE_FORBIDDEN");
}

function leadListScope(user: AuthenticatedPlatformUser): FieldListScope {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes("lead:view-all")) return "all";
  if (user.permissions.includes("lead:view-team")) return "team";
  if (user.permissions.includes("lead:view-assigned") && user.permissions.includes("lead:view-own")) return "own-or-assigned";
  if (user.permissions.includes("lead:view-assigned")) return "assigned";
  return "own";
}

function appointmentListScope(user: AuthenticatedPlatformUser): FieldListScope {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes("appointment:view-team")) return "team";
  if (user.permissions.includes("appointment:view-assigned") && user.permissions.includes("appointment:view-own")) return "own-or-assigned";
  if (user.permissions.includes("appointment:view-assigned")) return "assigned";
  return "own";
}

function followUpListScope(user: AuthenticatedPlatformUser): FieldListScope {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes("followup:view-team")) return "team";
  return "own";
}

function outcomeStatus(outcome: FieldAppointmentOutcome): FieldAppointmentStatus {
  return outcome === "NO_SHOW" ? "NO_SHOW" : outcome === "CANCELLED" ? "CANCELLED" : outcome === "RESCHEDULED" ? "RESCHEDULED" : "COMPLETED";
}

function allowedOutcomeStatus(outcome: FieldAppointmentOutcome, status: FieldAppointmentStatus): boolean {
  return (outcome === "NO_SHOW" && status === "NO_SHOW") || (outcome === "CANCELLED" && status === "CANCELLED") || (outcome === "RESCHEDULED" && status === "RESCHEDULED") || (!["NO_SHOW", "CANCELLED", "RESCHEDULED"].includes(outcome) && ["COMPLETED", "STARTED"].includes(status));
}

function isSupportedBillContent(content: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return content.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (mimeType === "image/png") return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    if (content.length < 12 || content.subarray(4, 8).toString("ascii") !== "ftyp") return false;
    const brands = [];
    for (let offset = 8; offset + 4 <= content.length; offset += 4) brands.push(content.subarray(offset, offset + 4).toString("ascii"));
    return brands.some((brand) => /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand));
  }
  return false;
}

function isValidDate(value: string): boolean {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function validFollowUpDaypart(value: string): boolean {
  return ["MORNING", "AFTERNOON", "EVENING"].includes(value);
}

function isUniqueConstraintError(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505" && databaseError.constraint === constraint;
}
