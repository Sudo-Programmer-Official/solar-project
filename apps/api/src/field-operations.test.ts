import assert from "node:assert/strict";
import test from "node:test";
import { FieldOperationsService } from "./field-operations";
import { PlatformHttpError, type AuthenticatedPlatformUser } from "./platform-auth";
import { DEFAULT_PLATFORM_FEATURE_FLAGS } from "../../../packages/contracts/src/index";
import type { FieldAppointment, FieldLeadContext, FieldOperationsRepository } from "../../../packages/database/src/index";

const manager: AuthenticatedPlatformUser = {
  id: "manager-1",
  displayName: "Test Manager",
  email: "manager@test.local",
  phone: null,
  active: true,
  mustChangePassword: false,
  roles: ["MANAGER"],
  permissions: ["appointment:assign", "appointment:reassign", "lead:view-team"],
  teamIds: ["team-1"],
  featureFlags: DEFAULT_PLATFORM_FEATURE_FLAGS,
  modules: [],
};

const assignmentAppointment: FieldAppointment = {
  id: "appointment-1",
  leadId: "lead-1",
  setterId: "setter-1",
  closerId: null,
  teamId: "team-1",
  availabilitySlotId: "availability-1",
  operationalSlotId: null,
  isOverflow: false,
  scheduledStart: "2026-09-04T22:00:00.000Z",
  scheduledEnd: "2026-09-04T23:00:00.000Z",
  timezone: "America/New_York",
  appointmentType: "SOLAR_CONSULTATION",
  status: "UNASSIGNED",
  outcome: null,
  outcomeNotes: null,
  startedAt: null,
  completedAt: null,
  assignedAt: null,
  assignedBy: null,
  notes: null,
  cancelReason: null,
  cancelledAt: null,
  cancelledBy: null,
  createdAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T12:00:00.000Z",
};

function appointmentContext(appointment: FieldAppointment): FieldLeadContext {
  return {
    lead: {
      id: appointment.leadId,
      propertyId: null,
      setterId: appointment.setterId,
      currentCloserId: appointment.closerId,
      createdByUserId: appointment.setterId,
      teamId: appointment.teamId,
      homeownerName: "Jordan Miller",
      phone: null,
      email: null,
      addressLine1: "1 Sun Street",
      city: "Pittsburgh",
      state: "PA",
      postalCode: "15213",
      latitude: null,
      longitude: null,
      utility: null,
      supplier: null,
      approximateMonthlyBill: null,
      qualification: {},
      status: "APPOINTMENT_SET",
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    },
    appointments: [appointment],
    notes: [],
    bills: [],
    activities: [],
    sheetSync: null,
  };
}

test("duplicate closer availability is returned as a safe conflict", async () => {
  const duplicate = Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint: "idx_field_ops_closer_slot_start",
  });
  const repository = {
    listEligibleClosers: async () => [{ id: "closer-1", displayName: "Test Closer", teamIds: ["team-1"] }],
    createAvailability: async () => { throw duplicate; },
  } as unknown as FieldOperationsRepository;
  const service = new FieldOperationsService(repository);

  await assert.rejects(
    () => service.createAvailability(manager, {
      closerId: "closer-1",
      slotStart: "2026-08-30T14:00:00.000Z",
      slotEnd: "2026-08-30T16:00:00.000Z",
    }),
    (error: unknown) => error instanceof PlatformHttpError
      && error.status === 409
      && error.code === "AVAILABILITY_EXISTS"
      && error.message === "This closer already has availability at that start time.",
  );
});

test("availability rejects an incomplete or reversed time window before repository access", async () => {
  let called = false;
  const repository = {
    listEligibleClosers: async () => [{ id: "closer-1", displayName: "Test Closer", teamIds: ["team-1"] }],
    createAvailability: async () => { called = true; return null; },
  } as unknown as FieldOperationsRepository;
  const service = new FieldOperationsService(repository);

  await assert.rejects(
    () => service.createAvailability(manager, {
      closerId: "closer-1",
      slotStart: "2026-08-30T16:00:00.000Z",
      slotEnd: "2026-08-30T14:00:00.000Z",
    }),
    (error: unknown) => error instanceof PlatformHttpError && error.code === "AVAILABILITY_INVALID",
  );
  assert.equal(called, false);
});

test("manager assignment persists through the authoritative repository mutation", async () => {
  let received: Record<string, unknown> | undefined;
  const assigned = { ...assignmentAppointment, closerId: "closer-1", closerName: "Test Closer", status: "ASSIGNED" as const };
  const repository = {
    getAppointmentContext: async () => appointmentContext(assignmentAppointment),
    assignAppointment: async (input: Record<string, unknown>) => { received = input; return assigned; },
  } as unknown as FieldOperationsRepository;

  const result = await new FieldOperationsService(repository).assignAppointment(manager, assignmentAppointment.id, "closer-1");

  assert.equal(result.closerId, "closer-1");
  assert.equal(result.status, "ASSIGNED");
  assert.equal(received?.appointmentId, assignmentAppointment.id);
  assert.equal(received?.closerId, "closer-1");
  assert.equal(received?.assignedBy, manager.id);
  assert.equal(received?.allowReassign, true);
});

test("manager reassigns an assigned appointment with reassign permission", async () => {
  const current = { ...assignmentAppointment, closerId: "old-closer", status: "ASSIGNED" as const };
  const reassigned = { ...current, closerId: "new-closer", closerName: "New Closer" };
  let received: Record<string, unknown> | undefined;
  const repository = {
    getAppointmentContext: async () => appointmentContext(current),
    assignAppointment: async (input: Record<string, unknown>) => { received = input; return reassigned; },
  } as unknown as FieldOperationsRepository;

  const result = await new FieldOperationsService(repository).assignAppointment(manager, current.id, "new-closer");

  assert.equal(result.closerId, "new-closer");
  assert.equal(received?.allowReassign, true);
});

test("setter cannot assign an appointment", async () => {
  let called = false;
  const setter: AuthenticatedPlatformUser = { ...manager, id: "setter-1", roles: ["SETTER"], permissions: ["appointment:view-own", "lead:view-own"] };
  const repository = {
    getAppointmentContext: async () => appointmentContext(assignmentAppointment),
    assignAppointment: async () => { called = true; return assignmentAppointment; },
  } as unknown as FieldOperationsRepository;

  await assert.rejects(
    () => new FieldOperationsService(repository).assignAppointment(setter, assignmentAppointment.id, "closer-1"),
    (error: unknown) => error instanceof PlatformHttpError && error.status === 403 && error.code === "FORBIDDEN",
  );
  assert.equal(called, false);
});

test("assignment conflict preserves the row and explains that the closer changed availability", async () => {
  const repository = {
    getAppointmentContext: async () => appointmentContext(assignmentAppointment),
    assignAppointment: async () => null,
  } as unknown as FieldOperationsRepository;

  await assert.rejects(
    () => new FieldOperationsService(repository).assignAppointment(manager, assignmentAppointment.id, "closer-1"),
    (error: unknown) => error instanceof PlatformHttpError
      && error.status === 409
      && error.code === "ASSIGNMENT_CONFLICT"
      && error.message.includes("no longer available")
      && error.message.includes("Choose another eligible closer"),
  );
});
