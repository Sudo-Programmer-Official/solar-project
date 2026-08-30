import { randomUUID } from "node:crypto";
import { PlatformRole, PLATFORM_ROLE_PERMISSIONS, type PlatformPermission } from "../../../../packages/contracts/src/index";
import type {
  FieldAppointment,
  FieldLeadContext,
  FieldOperationsRepository,
  PlatformRepository,
  TeamMemberRecord,
} from "../../../../packages/database/src/index";
import { hashPassword } from "../platform-auth";

export const TEST_USER_PASSWORD = "SolarTest123!";
export const TEST_TEAM_ID = "00000000-0000-4000-8000-000000000100";

export function assertTestDataEnvironment(action = "modify test data"): void {
  const nodeEnv = (process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (nodeEnv === "production") {
    throw new Error(`Refusing to ${action} while NODE_ENV=production.`);
  }
  if ((process.env.ALLOW_TEST_USERS ?? "").trim().toLowerCase() !== "true") {
    throw new Error(`Test-data operations are disabled. Set ALLOW_TEST_USERS=true for a local or staging run before attempting to ${action}.`);
  }
}

export function assertTestSeedEnvironment(): void {
  assertTestDataEnvironment("seed test users");
}

export interface TestUserDefinition {
  firstName: string;
  lastName: string;
  email: string;
  roles: PlatformRole[];
}

export const TEST_USER_DEFINITIONS: readonly TestUserDefinition[] = [
  { firstName: "Test", lastName: "Setter", email: "setter@test.local", roles: [PlatformRole.SETTER] },
  { firstName: "Test", lastName: "Closer", email: "closer@test.local", roles: [PlatformRole.CLOSER] },
  { firstName: "Test", lastName: "Setter Closer", email: "settercloser@test.local", roles: [PlatformRole.SETTER, PlatformRole.CLOSER] },
  { firstName: "Test", lastName: "Manager", email: "manager@test.local", roles: [PlatformRole.MANAGER] },
  { firstName: "Test", lastName: "Admin", email: "admin@test.local", roles: [PlatformRole.ADMIN] },
  { firstName: "Test", lastName: "Super Admin", email: "superadmin@test.local", roles: [PlatformRole.SUPER_ADMIN] },
];

export interface SeededTestUsers {
  teamId: string;
  users: Record<string, TeamMemberRecord>;
}

export interface SeededFieldDataSummary {
  leads: number;
  appointments: number;
  unassignedAppointments: number;
  assignedAppointments: number;
  closedLeads: number;
  followUpLeads: number;
  missingBillLeads: number;
  billMetadata: number;
}

export async function seedTestUsers(repository: PlatformRepository): Promise<SeededTestUsers> {
  const teams = await repository.listTeams();
  const team = teams.find((candidate) => candidate.id === TEST_TEAM_ID) ?? teams[0];
  if (!team) throw new Error("No active team exists. Run the database migrations before seeding test users.");

  const users: Record<string, TeamMemberRecord> = {};
  for (const definition of TEST_USER_DEFINITIONS) {
    const email = definition.email.toLowerCase();
    const existing = await repository.findUserByEmail(email);
    const user = existing ?? await repository.createUser({
      id: deterministicUserId(email),
      firstName: definition.firstName,
      lastName: definition.lastName,
      email,
      passwordHash: hashPassword(TEST_USER_PASSWORD),
      mustChangePassword: false,
    });

    const profile = await repository.updateUser(user.id, {
      firstName: definition.firstName,
      lastName: definition.lastName,
      phone: null,
      active: true,
    });
    if (!profile) throw new Error(`Unable to update seeded user ${email}.`);

    await repository.setPassword(user.id, hashPassword(TEST_USER_PASSWORD), false);
    const withRoles = await repository.replaceUserRoles(user.id, definition.roles, null);
    if (!withRoles) throw new Error(`Unable to assign roles to seeded user ${email}.`);
    const withTeams = await repository.replaceUserTeams(user.id, [...new Set([...user.teamIds, team.id])], null);
    if (!withTeams) throw new Error(`Unable to assign a team to seeded user ${email}.`);

    await repository.appendAudit({
      id: randomUUID(),
      actorId: null,
      action: "TEST_USER_SEEDED",
      entityType: "USER",
      entityId: user.id,
      details: { email, roles: definition.roles, active: true, mustChangePassword: false, passwordReset: true },
    });
    users[email] = withTeams;
  }

  return { teamId: team.id, users };
}

export async function seedDemoFieldData(
  repository: FieldOperationsRepository,
  seeded: SeededTestUsers,
): Promise<SeededFieldDataSummary> {
  const setter = requiredUser(seeded, "setter@test.local");
  const setterCloser = requiredUser(seeded, "settercloser@test.local");
  const closer = requiredUser(seeded, "closer@test.local");
  const manager = requiredUser(seeded, "manager@test.local");

  const leads = [
    {
      id: "00000000-0000-4000-8000-000000000221",
      setterId: setter.id,
      homeownerName: "Jordan Miller",
      phone: "555-0101",
      email: "jordan.miller@test.local",
      addressLine1: "101 Suncrest Avenue",
      city: "Pittsburgh",
      state: "PA",
      postalCode: "15213",
      utility: "Duquesne Light",
      approximateMonthlyBill: 185,
      qualification: { roof: "south-facing", homeowner: true, source: "seed" },
    },
    {
      id: "00000000-0000-4000-8000-000000000222",
      setterId: setterCloser.id,
      homeownerName: "Casey Thompson",
      phone: "555-0102",
      email: "casey.thompson@test.local",
      addressLine1: "202 Cedar Ridge Road",
      city: "Pittsburgh",
      state: "PA",
      postalCode: "15217",
      utility: "Duquesne Light",
      approximateMonthlyBill: 142,
      qualification: { roof: "open", homeowner: true, source: "seed" },
    },
    {
      id: "00000000-0000-4000-8000-000000000223",
      setterId: setter.id,
      homeownerName: "Riley Davis",
      phone: "555-0103",
      email: "riley.davis@test.local",
      addressLine1: "303 Maple Hollow Lane",
      city: "Pittsburgh",
      state: "PA",
      postalCode: "15218",
      utility: "Duquesne Light",
      approximateMonthlyBill: 210,
      qualification: { roof: "large", homeowner: true, source: "seed" },
    },
    {
      id: "00000000-0000-4000-8000-000000000224",
      setterId: setterCloser.id,
      homeownerName: "Morgan Wilson",
      phone: "555-0104",
      email: "morgan.wilson@test.local",
      addressLine1: "404 Orchard View Drive",
      city: "Pittsburgh",
      state: "PA",
      postalCode: "15220",
      utility: "Duquesne Light",
      approximateMonthlyBill: 265,
      qualification: { roof: "south-facing", homeowner: true, source: "seed" },
    },
    {
      id: "00000000-0000-4000-8000-000000000225",
      setterId: setter.id,
      homeownerName: "Taylor Brooks",
      phone: "555-0105",
      email: "taylor.brooks@test.local",
      addressLine1: "505 Highland Park Way",
      city: "Pittsburgh",
      state: "PA",
      postalCode: "15221",
      utility: "Duquesne Light",
      approximateMonthlyBill: 198,
      qualification: { roof: "west-facing", homeowner: true, source: "seed" },
    },
  ] as const;

  const contexts = new Map<string, FieldLeadContext>();
  for (const input of leads) {
    const context = await ensureLead(repository, {
      ...input,
      createdByUserId: input.setterId,
      teamId: seeded.teamId,
      isTestData: true,
    });
    contexts.set(input.id, context);
  }

  const slots = [
    { id: "00000000-0000-4000-8000-000000000321", closerId: closer.id, hour: 18, minute: 0 },
    { id: "00000000-0000-4000-8000-000000000322", closerId: closer.id, hour: 10, minute: 0 },
    { id: "00000000-0000-4000-8000-000000000323", closerId: closer.id, hour: 14, minute: 0 },
    { id: "00000000-0000-4000-8000-000000000324", closerId: closer.id, hour: 16, minute: 0 },
  ] as const;
  for (const slot of slots) {
    const existing = await repository.getAvailabilityById(slot.id);
    if (!existing) {
      const start = nextDayAt(slot.hour, slot.minute, 2);
      const created = await repository.createAvailability({
        id: slot.id,
        closerId: slot.closerId,
        slotStart: start.toISOString(),
        slotEnd: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        timezone: "America/New_York",
        capacity: 1,
        note: "Development seed slot",
        isTestData: true,
      });
      if (!created) throw new Error(`Unable to create seeded availability ${slot.id}.`);
    }
  }

  const appointmentDefinitions = [
    { id: "00000000-0000-4000-8000-000000000421", leadId: leads[0].id, setterId: leads[0].setterId, slotId: slots[0].id, outcome: null, notes: "Ready for manager assignment at the 6:00 PM capacity slot." },
    { id: "00000000-0000-4000-8000-000000000422", leadId: leads[1].id, setterId: leads[1].setterId, slotId: slots[1].id, outcome: "NO_SHOW" as const, notes: "Customer did not attend the consultation." },
    { id: "00000000-0000-4000-8000-000000000423", leadId: leads[3].id, setterId: leads[3].setterId, slotId: slots[2].id, outcome: "CLOSED" as const, notes: "Closed after a strong utility-bill review." },
    { id: "00000000-0000-4000-8000-000000000424", leadId: leads[4].id, setterId: leads[4].setterId, slotId: slots[3].id, outcome: "FOLLOW_UP" as const, notes: "Interested homeowner requested a follow-up call." },
  ] as const;

  for (const definition of appointmentDefinitions) {
    let context = contexts.get(definition.leadId)!;
    let appointment: FieldAppointment | undefined = context.appointments.find((candidate) => candidate.id === definition.id);
    if (!appointment) {
      const created = await repository.createAppointment({
        id: definition.id,
        leadId: definition.leadId,
        setterId: definition.setterId,
        teamId: seeded.teamId,
        slotId: definition.slotId,
        appointmentType: "SOLAR_CONSULTATION",
        isTestData: true,
      });
      if (!created) throw new Error(`Unable to create seeded appointment ${definition.id}; check slot capacity.`);
      appointment = created;
    }

    if (definition.outcome) {
      if (appointment.status === "UNASSIGNED" || (appointment.status === "ASSIGNED" && appointment.closerId !== closer.id && !appointment.outcome)) {
        const assigned = await repository.assignAppointment({
          appointmentId: appointment.id,
          closerId: closer.id,
          assignedBy: manager.id,
          teamIds: [seeded.teamId],
          allowReassign: true,
          isTestData: true,
        });
        if (!assigned) throw new Error(`Unable to assign seeded appointment ${appointment.id}.`);
        appointment = assigned;
      }
      if (!appointment.outcome) {
        const updated = await repository.recordOutcome({
          appointmentId: appointment.id,
          actorId: closer.id,
          closerId: closer.id,
          status: definition.outcome === "NO_SHOW" ? "NO_SHOW" : "COMPLETED",
          outcome: definition.outcome,
          outcomeNotes: definition.notes,
          isTestData: true,
        });
        if (!updated) throw new Error(`Unable to record seeded outcome for ${appointment.id}.`);
        appointment = updated;
      }
    }

    context = await repository.getLeadContext(definition.leadId) ?? context;
    const noteBody = definition.notes;
    if (!context.notes.some((note) => note.body === noteBody)) {
      await repository.addNote({ leadId: definition.leadId, appointmentId: definition.id, authorId: closer.id, body: noteBody, isTestData: true });
    }
    contexts.set(definition.leadId, await repository.getLeadContext(definition.leadId) ?? context);
  }

  const interestedContext = contexts.get(leads[2].id)!;
  if (interestedContext.lead.status === "KNOCKED") {
    await repository.updateLeadStatus({ leadId: leads[2].id, status: "INTERESTED", actorId: setter.id, isTestData: true });
    contexts.set(leads[2].id, await repository.getLeadContext(leads[2].id) ?? interestedContext);
  }

  const billContext = contexts.get(leads[3].id) ?? await repository.getLeadContext(leads[3].id);
  if (billContext && !billContext.bills.some((bill) => bill.storageKey === "seed/test-bill-morgan.pdf")) {
    await repository.addBill({
      leadId: leads[3].id,
      uploadedBy: setterCloser.id,
      storageKey: "seed/test-bill-morgan.pdf",
      fileName: "morgan-wilson-bill.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 24576,
      isTestData: true,
    });
  }

  const refreshedContexts = await Promise.all(leads.map((lead) => repository.getLeadContext(lead.id)));
  const allAppointments = refreshedContexts.flatMap((context) => context?.appointments ?? []);
  const allLeads = refreshedContexts.map((context) => context?.lead).filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));
  return {
    leads: allLeads.length,
    appointments: allAppointments.length,
    unassignedAppointments: allAppointments.filter((appointment) => appointment.status === "UNASSIGNED").length,
    assignedAppointments: allAppointments.filter((appointment) => appointment.closerId === closer.id).length,
    closedLeads: allLeads.filter((lead) => lead.status === "CLOSED").length,
    followUpLeads: allLeads.filter((lead) => lead.status === "FOLLOW_UP").length,
    missingBillLeads: refreshedContexts.filter((context) => context && context.bills.length === 0).length,
    billMetadata: refreshedContexts.reduce((count, context) => count + (context?.bills.some((bill) => bill.storageKey === "seed/test-bill-morgan.pdf") ? 1 : 0), 0),
  };
}

function requiredUser(seeded: SeededTestUsers, email: string): TeamMemberRecord {
  const user = seeded.users[email];
  if (!user) throw new Error(`Seeded user ${email} is missing.`);
  return user;
}

async function ensureLead(repository: FieldOperationsRepository, input: {
  id: string;
  setterId: string;
  createdByUserId: string;
  teamId: string;
  homeownerName: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  utility: string;
  approximateMonthlyBill: number;
  qualification: unknown;
  isTestData?: boolean;
}): Promise<FieldLeadContext> {
  let context = await repository.getLeadContext(input.id);
  if (!context) {
    await repository.createLead(input);
    context = await repository.getLeadContext(input.id);
  }
  if (!context) throw new Error(`Unable to load seeded lead ${input.id}.`);
  return context;
}

function nextDayAt(hour: number, minute: number, daysAhead: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function deterministicUserId(email: string): string {
  const ids: Record<string, string> = {
    "setter@test.local": "00000000-0000-4000-8000-000000000101",
    "closer@test.local": "00000000-0000-4000-8000-000000000102",
    "settercloser@test.local": "00000000-0000-4000-8000-000000000103",
    "manager@test.local": "00000000-0000-4000-8000-000000000104",
    "admin@test.local": "00000000-0000-4000-8000-000000000105",
    "superadmin@test.local": "00000000-0000-4000-8000-000000000106",
  };
  const id = ids[email];
  if (!id) throw new Error(`No deterministic ID configured for ${email}.`);
  return id;
}

export function permissionsForSeedRoles(roles: readonly PlatformRole[]): PlatformPermission[] {
  if (roles.includes(PlatformRole.SUPER_ADMIN)) return ["*"] as unknown as PlatformPermission[];
  return [...new Set(roles.flatMap((role) => PLATFORM_ROLE_PERMISSIONS[role] as readonly PlatformPermission[]))];
}
