import type {
  CreateAvailabilityInput,
  CreateFieldLeadInput,
  FieldAppointment,
  FieldAppointmentOutcome,
  FieldAppointmentStatus,
  FieldAvailabilitySlot,
  FieldLeadContext,
  FieldListScope,
  FieldOperationsRepository,
} from "../../../packages/database/src/index";
import type { PlatformPermission } from "../../../packages/contracts/src/index";
import type { AuthenticatedPlatformUser } from "./platform-auth";
import { PlatformHttpError, requireLeadScope, requirePermission } from "./platform-auth";

export class FieldOperationsService {
  constructor(private readonly repository: FieldOperationsRepository) {}

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

  async listAvailability(user: AuthenticatedPlatformUser, from: string, to: string): Promise<FieldAvailabilitySlot[]> {
    requireAny(user, ["appointment:create", "appointment:view-team", "appointment:assign"]);
    return this.repository.listAvailability({ from, to, teamIds: scopedTeams(user) });
  }

  async listEligibleClosers(user: AuthenticatedPlatformUser) {
    requireAny(user, ["appointment:assign", "appointment:create"]);
    return this.repository.listEligibleClosers(scopedTeams(user));
  }

  async createAvailability(user: AuthenticatedPlatformUser, input: CreateAvailabilityInput): Promise<FieldAvailabilitySlot> {
    requirePermission(user, "appointment:assign");
    const closers = await this.repository.listEligibleClosers(scopedTeams(user));
    const closer = closers.find((candidate) => candidate.id === input.closerId);
    if (!closer) throw new PlatformHttpError(403, "That closer is not eligible for your team.", "CLOSER_NOT_ELIGIBLE");
    const created = await this.repository.createAvailability(input);
    if (!created) throw new PlatformHttpError(400, "Availability could not be created for that closer.", "AVAILABILITY_INVALID");
    return created;
  }

  async createAppointment(user: AuthenticatedPlatformUser, leadId: string, input: { slotId: string; appointmentType?: string }): Promise<FieldAppointment> {
    requirePermission(user, "appointment:create");
    const context = await this.getLead(user, leadId);
    const appointment = await this.repository.createAppointment({ leadId, setterId: user.id, teamId: context.lead.teamId ?? user.teamIds[0] ?? null, slotId: input.slotId, appointmentType: input.appointmentType });
    if (!appointment) throw new PlatformHttpError(409, "That capacity slot is no longer available.", "SLOT_UNAVAILABLE");
    return appointment;
  }

  async listAppointments(user: AuthenticatedPlatformUser): Promise<FieldAppointment[]> {
    requireAny(user, ["appointment:view-own", "appointment:view-assigned", "appointment:view-team", "appointment:reassign"]);
    return this.repository.listAppointments({ userId: user.id, teamIds: scopedTeams(user), scope: appointmentListScope(user) });
  }

  async getAppointment(user: AuthenticatedPlatformUser, appointmentId: string): Promise<{ context: FieldLeadContext; appointment: FieldAppointment }> {
    const context = await this.repository.getAppointmentContext(appointmentId);
    const appointment = context?.appointments.find((candidate) => candidate.id === appointmentId);
    if (!context || !appointment) throw new PlatformHttpError(404, "Appointment not found.", "APPOINTMENT_NOT_FOUND");
    requireLeadScope(user, context.lead);
    return { context, appointment };
  }

  async assignAppointment(user: AuthenticatedPlatformUser, appointmentId: string, closerId: string): Promise<FieldAppointment> {
    requirePermission(user, "appointment:assign");
    const { context, appointment } = await this.getAppointment(user, appointmentId);
    if (appointment.status !== "UNASSIGNED" && !(appointment.status === "ASSIGNED" && user.permissions.includes("appointment:reassign"))) {
      throw new PlatformHttpError(409, "Only an unassigned appointment can be assigned.", "APPOINTMENT_NOT_ASSIGNABLE");
    }
    const assigned = await this.repository.assignAppointment({ appointmentId, closerId, assignedBy: user.id, teamIds: scopedTeams(user), allowReassign: user.permissions.includes("appointment:reassign") });
    if (!assigned) throw new PlatformHttpError(409, "The closer is not eligible or the appointment changed.", "ASSIGNMENT_CONFLICT");
    return assigned;
  }

  async recordOutcome(user: AuthenticatedPlatformUser, appointmentId: string, input: { outcome: FieldAppointmentOutcome; status?: FieldAppointmentStatus; outcomeNotes?: string | null }): Promise<FieldAppointment> {
    requirePermission(user, "appointment:update-outcome");
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

  async addBill(user: AuthenticatedPlatformUser, leadId: string, input: { storageKey: string; fileName: string; mimeType: string; fileSizeBytes: number }) {
    await this.getLead(user, leadId);
    requirePermission(user, "bill:upload");
    if (!input.storageKey || !input.fileName || !input.mimeType || !Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes < 0) throw new PlatformHttpError(400, "A valid bill file reference is required.", "BILL_INVALID");
    return this.repository.addBill({ leadId, uploadedBy: user.id, ...input });
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

function outcomeStatus(outcome: FieldAppointmentOutcome): FieldAppointmentStatus {
  return outcome === "NO_SHOW" ? "NO_SHOW" : outcome === "CANCELLED" ? "CANCELLED" : "COMPLETED";
}

function allowedOutcomeStatus(outcome: FieldAppointmentOutcome, status: FieldAppointmentStatus): boolean {
  return (outcome === "NO_SHOW" && status === "NO_SHOW") || (outcome === "CANCELLED" && status === "CANCELLED") || (!["NO_SHOW", "CANCELLED"].includes(outcome) && ["COMPLETED", "STARTED"].includes(status));
}
