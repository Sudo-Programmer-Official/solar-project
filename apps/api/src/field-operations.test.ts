import assert from "node:assert/strict";
import test from "node:test";
import { FieldOperationsService } from "./field-operations";
import { PlatformHttpError, type AuthenticatedPlatformUser } from "./platform-auth";
import { DEFAULT_PLATFORM_FEATURE_FLAGS } from "../../../packages/contracts/src/index";
import type { FieldOperationsRepository } from "../../../packages/database/src/index";

const manager: AuthenticatedPlatformUser = {
  id: "manager-1",
  displayName: "Test Manager",
  email: "manager@test.local",
  phone: null,
  active: true,
  mustChangePassword: false,
  roles: ["MANAGER"],
  permissions: ["appointment:assign"],
  teamIds: ["team-1"],
  featureFlags: DEFAULT_PLATFORM_FEATURE_FLAGS,
  modules: [],
};

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
