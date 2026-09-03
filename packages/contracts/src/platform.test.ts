import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PLATFORM_FEATURE_FLAGS, PlatformRole, platformRoleCan, platformRolesCan, primaryPlatformRoute, resolvePlatformModules } from "./index";

test("platform permissions keep Labs separate from manager operations", () => {
  assert.equal(platformRoleCan(PlatformRole.MANAGER, "team:view"), true);
  assert.equal(platformRoleCan(PlatformRole.MANAGER, "appointment:assign"), true);
  assert.equal(platformRoleCan(PlatformRole.MANAGER, "labs:view"), false);
  assert.equal(platformRoleCan(PlatformRole.SETTER, "appointment:create"), true);
  assert.equal(platformRoleCan(PlatformRole.SETTER, "appointment:assign"), false);
  assert.equal(platformRoleCan(PlatformRole.CLOSER, "appointment:view-assigned"), true);
  assert.equal(platformRoleCan(PlatformRole.CLOSER, "appointment:create"), false);
  assert.equal(platformRoleCan(PlatformRole.SUPER_ADMIN, "system:manage"), true);
});

test("multi-role identities receive the union of their operational permissions", () => {
  assert.equal(platformRolesCan([PlatformRole.SETTER, PlatformRole.CLOSER], "lead:create"), true);
  assert.equal(platformRolesCan([PlatformRole.SETTER, PlatformRole.CLOSER], "appointment:update-outcome"), true);
  assert.equal(platformRolesCan([PlatformRole.SETTER, PlatformRole.CLOSER], "appointment:assign"), false);
  assert.equal(platformRolesCan([PlatformRole.MANAGER], "team:create-user"), true);
  assert.equal(platformRolesCan([PlatformRole.MANAGER], "system:manage"), false);
});

test("module registry resolves role capabilities and landing routes", () => {
  const setterModules = resolvePlatformModules(
    ["lead:create", "lead:view-own", "lead:update-own", "appointment:create", "appointment:view-own", "bill:upload", "reports:view-own"],
    DEFAULT_PLATFORM_FEATURE_FLAGS,
  );
  assert.equal(setterModules.includes("HOME"), true);
  assert.equal(setterModules.includes("LEADS"), true);
  assert.equal(setterModules.includes("SCHEDULE"), true);
  assert.equal(setterModules.includes("LABS"), false);
  assert.equal(primaryPlatformRoute(setterModules), "/home");

  const closerModules = resolvePlatformModules(
    ["lead:update-own", "lead:view-assigned", "appointment:view-assigned", "appointment:update-outcome"],
    DEFAULT_PLATFORM_FEATURE_FLAGS,
  );
  assert.equal(closerModules.includes("APPOINTMENTS"), true);
  assert.equal(primaryPlatformRoute(closerModules), "/appointments");

  const managerModules = resolvePlatformModules(["lead:view-team", "appointment:view-team", "appointment:assign", "team:view", "reports:view", "analytics:view"], DEFAULT_PLATFORM_FEATURE_FLAGS);
  assert.equal(managerModules.includes("OPERATIONS"), true);
  assert.equal(managerModules.includes("TODAY"), true);
  assert.equal(managerModules.includes("LABS"), false);
  assert.equal(primaryPlatformRoute(managerModules), "/today");

  const superAdminModules = resolvePlatformModules(["*"], DEFAULT_PLATFORM_FEATURE_FLAGS);
  assert.equal(superAdminModules.includes("SYSTEM"), true);
  assert.equal(superAdminModules.includes("LEAD_FINDER"), true);
  assert.equal(primaryPlatformRoute(superAdminModules), "/today");
});
