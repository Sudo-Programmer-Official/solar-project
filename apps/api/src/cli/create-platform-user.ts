import { randomUUID } from "node:crypto";
import { PlatformRole } from "../../../../packages/contracts/src/index";
import { createApiBootstrapContext } from "../bootstrap";
import { hashPassword, validatePassword } from "../platform-auth";

const email = process.env.PLATFORM_USER_EMAIL?.trim().toLowerCase();
const password = process.env.PLATFORM_USER_PASSWORD;
const firstName = process.env.PLATFORM_USER_FIRST_NAME?.trim() || "Platform";
const lastName = process.env.PLATFORM_USER_LAST_NAME?.trim() || "Admin";
const roles = parseRoles(process.env.PLATFORM_USER_ROLES || "SUPER_ADMIN");

if (!email || !password) {
  throw new Error("Set PLATFORM_USER_EMAIL and PLATFORM_USER_PASSWORD before running this command.");
}
validatePassword(password);

const context = await createApiBootstrapContext({ applyMigrations: true });
try {
  const existing = await context.platformRepository.findUserByEmail(email);
  const user = existing
    ? existing
    : await context.platformRepository.createUser({
        id: randomUUID(),
        firstName,
        lastName,
        email,
        passwordHash: hashPassword(password),
      });
  if (existing) await context.platformRepository.setPassword(user.id, hashPassword(password), false);
  await context.platformRepository.replaceUserRoles(user.id, roles, null);
  const current = await context.platformRepository.findUserById(user.id);
  if (current && current.teamIds.length === 0) {
    const defaultTeam = (await context.platformRepository.listTeams())[0];
    if (defaultTeam) await context.platformRepository.replaceUserTeams(user.id, [defaultTeam.id], null);
  }
  await context.platformRepository.appendAudit({
    id: randomUUID(),
    actorId: null,
    action: existing ? "PLATFORM_USER_BOOTSTRAPPED" : "PLATFORM_USER_CREATED",
    entityType: "USER",
    entityId: user.id,
    details: { roles },
  });
  console.log(`Platform user ready: ${user.email} (${roles.join(", ")})`);
} finally {
  await context.close();
}

function parseRoles(value: string): PlatformRole[] {
  const allowed = new Set(Object.values(PlatformRole));
  const parsed = value.split(",").map((role) => role.trim().toUpperCase());
  if (parsed.some((role) => !allowed.has(role as PlatformRole)) || parsed.length === 0) {
    throw new Error(`PLATFORM_USER_ROLES must contain valid roles: ${Object.values(PlatformRole).join(", ")}`);
  }
  return [...new Set(parsed as PlatformRole[])];
}
