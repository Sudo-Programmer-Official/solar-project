import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { PlatformRole } from "../../../../packages/contracts/src/index";
import type {
  PlatformRepository,
  PlatformSessionRecord,
  PlatformUserRecord,
  TeamMemberRecord,
} from "../../../../packages/database/src/platform";
import type { FieldAppointment, FieldLead, FieldLeadContext, FieldOperationsRepository } from "../../../../packages/database/src/field-operations";
import {
  ACCESS_COOKIE,
  PlatformAuthService,
  PlatformHttpError,
  verifyPassword,
} from "../platform-auth";
import {
  seedDemoFieldData,
  permissionsForSeedRoles,
  seedTestUsers,
  TEST_USER_DEFINITIONS,
  TEST_USER_PASSWORD,
} from "./test-user-seed";

test("QA seed creates the linked appointment lifecycle fixture", async () => {
  const { repository: platformRepository } = createMemoryPlatformRepository();
  const seeded = await seedTestUsers(platformRepository);
  const fieldRepository = createMemoryFieldRepository();

  const summary = await seedDemoFieldData(fieldRepository, seeded);
  assert.deepEqual(summary, {
    leads: 5,
    appointments: 4,
    unassignedAppointments: 1,
    assignedAppointments: 3,
    closedLeads: 1,
    followUpLeads: 1,
    missingBillLeads: 4,
    billMetadata: 1,
  });

  const leadA = await fieldRepository.getLeadContext("00000000-0000-4000-8000-000000000221");
  const leadB = await fieldRepository.getLeadContext("00000000-0000-4000-8000-000000000222");
  const leadC = await fieldRepository.getLeadContext("00000000-0000-4000-8000-000000000223");
  assert.equal(leadA?.appointments[0]?.status, "UNASSIGNED");
  assert.equal(leadB?.appointments[0]?.outcome, "NO_SHOW");
  assert.equal(leadB?.appointments[0]?.status, "NO_SHOW");
  assert.equal(leadC?.lead.status, "INTERESTED");

  const rerun = await seedDemoFieldData(fieldRepository, seeded);
  assert.deepEqual(rerun, summary);
});

test("test-user seed is complete, hashed, idempotent, and authenticates every role", async () => {
  const { repository, records } = createMemoryPlatformRepository();
  const first = await seedTestUsers(repository);
  const second = await seedTestUsers(repository);

  assert.equal(Object.keys(first.users).length, 6);
  assert.equal(Object.keys(second.users).length, 6);
  assert.equal(records.size, 6);

  const auth = new PlatformAuthService(repository);
  for (const definition of TEST_USER_DEFINITIONS) {
    const record = recordFor(records, definition.email);
    assert.deepEqual(record.roles, definition.roles);
    assert.equal(record.active, true);
    assert.equal(record.mustChangePassword, false);
    assert.notEqual(record.passwordHash, TEST_USER_PASSWORD);
    assert.equal(verifyPassword(TEST_USER_PASSWORD, record.passwordHash ?? ""), true);

    const login = await auth.login(definition.email, TEST_USER_PASSWORD, request());
    const authenticated = await auth.authenticate({
      headers: { cookie: `${ACCESS_COOKIE}=${login.tokens.accessToken}` },
    } as unknown as http.IncomingMessage);
    assert.ok(authenticated);
    assert.deepEqual(authenticated.user.roles, definition.roles);
  }

  await assert.rejects(
    () => auth.login("setter@test.local", "wrong-password", request()),
    (error: unknown) => error instanceof PlatformHttpError && error.status === 401,
  );

  recordFor(records, "setter@test.local").active = false;
  await assert.rejects(
    () => auth.login("setter@test.local", TEST_USER_PASSWORD, request()),
    (error: unknown) => error instanceof PlatformHttpError && error.status === 401,
  );
});

function recordFor(records: Map<string, TeamMemberRecord>, email: string): TeamMemberRecord {
  const record = [...records.values()].find((candidate) => candidate.email === email);
  if (!record) throw new Error(`Missing test record for ${email}`);
  return record;
}

function request(): http.IncomingMessage {
  return { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage;
}

function createMemoryPlatformRepository(): { repository: PlatformRepository; records: Map<string, TeamMemberRecord> } {
  const records = new Map<string, TeamMemberRecord>();
  const sessions = new Map<string, PlatformSessionRecord>();
  const repository = {
    listTeams: async () => [{ id: "00000000-0000-4000-8000-000000000100", name: "Default Team" }],
    findUserByEmail: async (email: string) => [...records.values()].find((record) => record.email === email.toLowerCase()) ?? null,
    findUserById: async (id: string) => records.get(id) ?? null,
    listTeamMembers: async () => [...records.values()],
    createUser: async (input: { id: string; firstName: string; lastName: string; email: string; phone?: string | null; passwordHash?: string | null; mustChangePassword?: boolean }) => {
      const member = memberFrom({
        id: input.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        active: true,
        passwordHash: input.passwordHash ?? null,
        mustChangePassword: input.mustChangePassword ?? false,
        roles: [],
        permissions: [],
        teamIds: [],
        lastLoginAt: null,
      });
      records.set(member.id, member);
      return member;
    },
    updateUser: async (id: string, input: { firstName?: string; lastName?: string; phone?: string | null; active?: boolean }) => {
      const current = records.get(id);
      if (!current) return null;
      const updated = memberFrom({ ...current, ...input, phone: input.phone === undefined ? current.phone : input.phone });
      records.set(id, updated);
      return updated;
    },
    replaceUserRoles: async (id: string, roles: PlatformRole[]) => {
      const current = records.get(id);
      if (!current) return null;
      const updated = memberFrom({ ...current, roles: [...roles], permissions: permissionsForSeedRoles(roles) });
      records.set(id, updated);
      return updated;
    },
    replaceUserTeams: async (id: string, teamIds: string[]) => {
      const current = records.get(id);
      if (!current) return null;
      const updated = memberFrom({ ...current, teamIds: [...teamIds] });
      records.set(id, updated);
      return updated;
    },
    setPassword: async (id: string, passwordHash: string, mustChangePassword = false) => {
      const current = records.get(id);
      if (current) records.set(id, memberFrom({ ...current, passwordHash, mustChangePassword }));
    },
    updateLastLogin: async (id: string) => {
      const current = records.get(id);
      if (current) records.set(id, memberFrom({ ...current, lastLoginAt: new Date().toISOString() }));
    },
    createSession: async (input: { id: string; userId: string; sessionTokenHash: string; refreshTokenHash: string; expiresAt: string; refreshExpiresAt: string }) => {
      const user = records.get(input.userId);
      if (!user) throw new Error("Missing session user");
      sessions.set(input.id, { ...input, revokedAt: null, user });
    },
    findSessionByTokenHash: async (tokenHash: string) => findSession(sessions, records, (session) => session.sessionTokenHash === tokenHash),
    findSessionByRefreshHash: async (tokenHash: string) => findSession(sessions, records, (session) => session.refreshTokenHash === tokenHash),
    rotateSession: async () => undefined,
    revokeSession: async (id: string) => { sessions.get(id)!.revokedAt = new Date().toISOString(); },
    createInvite: async () => undefined,
    consumeInvite: async () => null,
    appendAudit: async () => undefined,
  } as unknown as PlatformRepository;
  return { repository, records };
}

function memberFrom(input: PlatformUserRecord): TeamMemberRecord {
  return { ...input, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: new Date().toISOString() };
}

function findSession(
  sessions: Map<string, PlatformSessionRecord>,
  records: Map<string, TeamMemberRecord>,
  predicate: (session: PlatformSessionRecord) => boolean,
): PlatformSessionRecord | null {
  const session = [...sessions.values()].find(predicate);
  if (!session) return null;
  return { ...session, user: records.get(session.userId)! };
}

function createMemoryFieldRepository(): FieldOperationsRepository {
  const leads = new Map<string, FieldLead>();
  const appointments = new Map<string, FieldAppointment>();
  const availability = new Map<string, { id: string; closerId: string; slotStart: string; slotEnd: string; timezone: string; capacity: number; bookedCount: number; status: "AVAILABLE" | "BLOCKED" | "BOOKED"; note: string | null }>();
  const notes = new Map<string, Array<{ body: string; appointmentId: string | null }>>();
  const bills = new Map<string, Array<{ storageKey: string }>>();

  const repository = {
    getLeadContext: async (id: string) => {
      const lead = leads.get(id);
      if (!lead) return null;
      return {
        lead,
        appointments: [...appointments.values()].filter((appointment) => appointment.leadId === id),
        notes: (notes.get(id) ?? []).map((note) => ({ ...note, id: note.body, leadId: id, authorId: null, kind: "TEXT", createdAt: "2026-01-01T00:00:00.000Z" })),
        bills: (bills.get(id) ?? []).map((bill) => ({ ...bill, id: bill.storageKey, leadId: id, uploadedBy: null, fileName: bill.storageKey, mimeType: "application/pdf", fileSizeBytes: 1, createdAt: "2026-01-01T00:00:00.000Z" })),
        activities: [],
        sheetSync: null,
      } as unknown as FieldLeadContext;
    },
    createLead: async (input: { id?: string; setterId: string; createdByUserId: string; teamId?: string | null; homeownerName: string; phone?: string | null; email?: string | null; addressLine1: string; city?: string | null; state?: string | null; postalCode?: string | null; utility?: string | null; approximateMonthlyBill?: number | null; qualification?: unknown }) => {
      const lead = {
        id: input.id!, propertyId: null, setterId: input.setterId, currentCloserId: null, createdByUserId: input.createdByUserId, teamId: input.teamId ?? null,
        homeownerName: input.homeownerName, phone: input.phone ?? null, email: input.email ?? null, addressLine1: input.addressLine1, city: input.city ?? null,
        state: input.state ?? null, postalCode: input.postalCode ?? null, latitude: null, longitude: null, utility: input.utility ?? null, supplier: null,
        approximateMonthlyBill: input.approximateMonthlyBill ?? null, qualification: input.qualification ?? {}, status: "KNOCKED" as const,
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      };
      leads.set(lead.id, lead);
      return lead;
    },
    updateLeadStatus: async (input: { leadId: string; status: FieldLead["status"] }) => {
      const lead = leads.get(input.leadId);
      if (!lead) return null;
      lead.status = input.status;
      return lead;
    },
    getAvailabilityById: async (id: string) => availability.get(id) ?? null,
    createAvailability: async (input: { id?: string; closerId: string; slotStart: string; slotEnd: string; timezone?: string; capacity?: number; note?: string | null }) => {
      const slot = { id: input.id!, closerId: input.closerId, slotStart: input.slotStart, slotEnd: input.slotEnd, timezone: input.timezone ?? "America/New_York", capacity: input.capacity ?? 1, bookedCount: 0, status: "AVAILABLE" as const, note: input.note ?? null };
      availability.set(slot.id, slot);
      return { ...slot, closerName: "Test Closer" };
    },
    createAppointment: async (input: { id?: string; leadId: string; setterId: string; teamId?: string | null; slotId: string; appointmentType?: string }) => {
      const slot = availability.get(input.slotId);
      if (!slot || slot.status !== "AVAILABLE" || slot.bookedCount >= slot.capacity) return null;
      slot.bookedCount += 1;
      slot.status = slot.bookedCount >= slot.capacity ? "BOOKED" : "AVAILABLE";
      const appointment = {
        id: input.id!, leadId: input.leadId, setterId: input.setterId, closerId: null, teamId: input.teamId ?? null, scheduledStart: slot.slotStart, scheduledEnd: slot.slotEnd,
        timezone: slot.timezone, appointmentType: input.appointmentType ?? "SOLAR_CONSULTATION", status: "UNASSIGNED" as const, outcome: null, outcomeNotes: null,
        startedAt: null, completedAt: null, assignedAt: null, assignedBy: null, notes: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      };
      appointments.set(appointment.id, appointment);
      leads.get(input.leadId)!.status = "APPOINTMENT_SET";
      return appointment;
    },
    assignAppointment: async (input: { appointmentId: string; closerId: string; assignedBy: string }) => {
      const appointment = appointments.get(input.appointmentId);
      if (!appointment) return null;
      appointment.closerId = input.closerId;
      appointment.status = "ASSIGNED";
      appointment.assignedBy = input.assignedBy;
      leads.get(appointment.leadId)!.currentCloserId = input.closerId;
      return appointment;
    },
    recordOutcome: async (input: { appointmentId: string; closerId: string; status: FieldAppointment["status"]; outcome: NonNullable<FieldAppointment["outcome"]>; outcomeNotes?: string | null }) => {
      const appointment = appointments.get(input.appointmentId);
      if (!appointment || appointment.closerId !== input.closerId || appointment.outcome) return null;
      appointment.status = input.status;
      appointment.outcome = input.outcome;
      appointment.outcomeNotes = input.outcomeNotes ?? null;
      const statusMap = { NO_SHOW: "NO_SHOW", CLOSED: "CLOSED", FOLLOW_UP: "FOLLOW_UP" } as const;
      const leadStatus = statusMap[input.outcome as keyof typeof statusMap];
      if (leadStatus) leads.get(appointment.leadId)!.status = leadStatus;
      return appointment;
    },
    addNote: async (input: { leadId: string; appointmentId?: string | null; body: string }) => {
      const list = notes.get(input.leadId) ?? [];
      list.push({ body: input.body, appointmentId: input.appointmentId ?? null });
      notes.set(input.leadId, list);
      return {};
    },
    addBill: async (input: { leadId: string; storageKey: string }) => {
      const list = bills.get(input.leadId) ?? [];
      list.push({ storageKey: input.storageKey });
      bills.set(input.leadId, list);
      return {};
    },
  } as unknown as FieldOperationsRepository;
  return repository;
}
