import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import type { PlatformRepository, PlatformUserRecord } from "../../../packages/database/src/platform";
import { PlatformRole } from "../../../packages/contracts/src/index";
import {
  PlatformAuthService,
  PlatformHttpError,
  type AuthenticatedPlatformUser,
  canAssignRoles,
  canManageUserRoles,
  hashPassword,
  manageableRolesForUser,
  requirePermission,
  requireLeadScope,
  requireResourceScope,
  toAuthUser,
  verifyPassword,
} from "./platform-auth";

const user: PlatformUserRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  firstName: "Chris",
  lastName: "Setter",
  email: "chris@example.com",
  phone: null,
  active: true,
  passwordHash: hashPassword("a-secure-password"),
  lastLoginAt: null,
  roles: [PlatformRole.CLOSER, PlatformRole.SETTER],
  permissions: ["lead:create", "lead:view-own", "lead:view-team", "lead:update-own"],
  teamIds: ["00000000-0000-4000-8000-000000000010"],
};

test("passwords are salted and verifiable without storing plaintext", () => {
  const encoded = hashPassword("another-secure-password");
  assert.notEqual(encoded, "another-secure-password");
  assert.equal(verifyPassword("another-secure-password", encoded), true);
  assert.equal(verifyPassword("wrong-password", encoded), false);
});

test("login rejects disabled users and creates a session for active users", async () => {
  let sessionCreated = false;
  const repository = {
    findUserByEmail: async () => user,
    updateLastLogin: async () => undefined,
    createSession: async () => { sessionCreated = true; },
  } as unknown as PlatformRepository;
  const service = new PlatformAuthService(repository);
  const request = { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as unknown as http.IncomingMessage;
  const result = await service.login(user.email, "a-secure-password", request);
  assert.equal(result.user.roles.includes(PlatformRole.CLOSER), true);
  assert.equal(result.user.roles.includes(PlatformRole.SETTER), true);
  assert.equal(sessionCreated, true);

  const disabledRepository = { findUserByEmail: async () => ({ ...user, active: false }) } as unknown as PlatformRepository;
  await assert.rejects(() => new PlatformAuthService(disabledRepository).login(user.email, "a-secure-password", request), (error: unknown) => error instanceof PlatformHttpError && error.status === 401);
});

test("temporary-password users must change their password and the flag is cleared", async () => {
  let current = { ...user, mustChangePassword: true };
  let changed = false;
  const repository = {
    findUserById: async () => current,
    setPassword: async (_id: string, passwordHash: string, mustChangePassword: boolean) => {
      current = { ...current, passwordHash, mustChangePassword };
      changed = true;
    },
    appendAudit: async () => undefined,
  } as unknown as PlatformRepository;
  const updated = await new PlatformAuthService(repository).changePassword(user.id, "a-secure-password", "a-new-secure-password");
  assert.equal(changed, true);
  assert.equal(updated.mustChangePassword, false);
  assert.equal(current.mustChangePassword, false);
  assert.equal(verifyPassword("a-new-secure-password", current.passwordHash ?? ""), true);
});

test("permission and resource scope checks are independent", () => {
  const authUser = toAuthUser(user, {
    leadFinderEnabled: true,
    routeOptimizerEnabled: false,
    installationSignalsEnabled: true,
    aiTerritoryScoreEnabled: false,
  });
  requirePermission(authUser, "lead:view-own");
  requireResourceScope(authUser, { setterId: authUser.id }, { all: "lead:view-all", team: "lead:view-team", own: "lead:view-own" });
  requireResourceScope(authUser, { teamId: authUser.teamIds[0] }, { all: "lead:view-all", team: "lead:view-team", own: "lead:view-own" });
  assert.throws(() => requirePermission(authUser, "team:view"), (error: unknown) => error instanceof PlatformHttpError && error.status === 403);
  assert.throws(() => requireResourceScope(authUser, { teamId: "00000000-0000-4000-8000-000000000099" }, { all: "lead:view-all", team: "lead:view-team", own: "lead:view-own" }), (error: unknown) => error instanceof PlatformHttpError && error.code === "RESOURCE_FORBIDDEN");
  assert.equal(canAssignRoles(authUser, [PlatformRole.CLOSER, PlatformRole.SETTER]), true);
  assert.equal(canAssignRoles(authUser, [PlatformRole.SUPER_ADMIN]), false);
});

test("assigned closers can open the full lead context without team-wide access", () => {
  const closer = {
    ...toAuthUser(user, { leadFinderEnabled: true, routeOptimizerEnabled: false, installationSignalsEnabled: true, aiTerritoryScoreEnabled: false }),
    roles: [PlatformRole.CLOSER],
    permissions: ["lead:view-own", "lead:view-assigned"],
  } as AuthenticatedPlatformUser;
  requireLeadScope(closer, { currentCloserId: closer.id, teamId: "another-team" });
  assert.throws(() => requireLeadScope(closer, { currentCloserId: "another-user", teamId: "another-team" }), (error: unknown) => error instanceof PlatformHttpError && error.code === "RESOURCE_FORBIDDEN");
});

test("team role hierarchy limits each manager to the level below it", () => {
  const manager: AuthenticatedPlatformUser = { ...toAuthUser(user, { leadFinderEnabled: true, routeOptimizerEnabled: false, installationSignalsEnabled: true, aiTerritoryScoreEnabled: false }), roles: [PlatformRole.MANAGER], permissions: ["team:view", "team:create-user", "team:update-user", "team:assign-role"] };
  const admin: AuthenticatedPlatformUser = { ...manager, roles: [PlatformRole.ADMIN] };
  const superAdmin: AuthenticatedPlatformUser = { ...manager, roles: [PlatformRole.SUPER_ADMIN], permissions: ["system:manage"] };

  assert.deepEqual(manageableRolesForUser(manager), [PlatformRole.SETTER, PlatformRole.CLOSER]);
  assert.equal(canManageUserRoles(manager, [], [PlatformRole.SETTER, PlatformRole.CLOSER]), true);
  assert.equal(canManageUserRoles(manager, [], [PlatformRole.MANAGER]), false);
  assert.equal(canManageUserRoles(manager, [], [PlatformRole.ADMIN]), false);
  assert.equal(canManageUserRoles(admin, [], [PlatformRole.MANAGER, PlatformRole.SETTER]), true);
  assert.equal(canManageUserRoles(admin, [PlatformRole.ADMIN], [PlatformRole.SETTER]), false);
  assert.equal(canManageUserRoles(admin, [], [PlatformRole.SUPER_ADMIN]), false);
  assert.equal(canManageUserRoles(superAdmin, [], [PlatformRole.ADMIN, PlatformRole.MANAGER]), true);
  assert.equal(canManageUserRoles(superAdmin, [], [PlatformRole.SUPER_ADMIN]), true);
});
