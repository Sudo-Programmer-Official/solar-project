import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type http from "node:http";
import {
  DEFAULT_PLATFORM_FEATURE_FLAGS,
  resolvePlatformModules,
  type PlatformFeatureFlags,
  type PlatformModule,
  type PlatformPermission,
  type PlatformRole,
} from "../../../packages/contracts/src/index";
import type { PlatformRepository, PlatformUserRecord } from "../../../packages/database/src/index";

export const ACCESS_COOKIE = "solar_access";
export const REFRESH_COOKIE = "solar_refresh";
export const ACCESS_TTL_MS = 8 * 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class PlatformHttpError extends Error {
  constructor(readonly status: number, message: string, readonly code = "REQUEST_FAILED") {
    super(message);
    this.name = "PlatformHttpError";
  }
}

export interface AuthenticatedPlatformUser {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  active: boolean;
  mustChangePassword: boolean;
  roles: PlatformRole[];
  permissions: PlatformPermission[];
  teamIds: string[];
  featureFlags: PlatformFeatureFlags;
  modules: PlatformModule[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  sessionId: string;
}

export interface ResourceScope {
  teamId?: string | null;
  createdByUserId?: string | null;
  setterId?: string | null;
  currentCloserId?: string | null;
}

export class PlatformAuthService {
  constructor(
    readonly repository: PlatformRepository,
    private readonly featureFlags: PlatformFeatureFlags = DEFAULT_PLATFORM_FEATURE_FLAGS,
  ) {}

  async login(email: string, password: string, request: http.IncomingMessage): Promise<{ user: AuthenticatedPlatformUser; tokens: SessionTokens }> {
    const user = await this.repository.findUserByEmail(email.trim());
    if (!user || !user.active || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new PlatformHttpError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
    }
    await this.repository.updateLastLogin(user.id);
    const tokens = await this.createSession(user.id, request);
    return { user: toAuthUser(user, this.featureFlags), tokens };
  }

  async authenticate(request: http.IncomingMessage): Promise<{ user: AuthenticatedPlatformUser; sessionId: string } | null> {
    const token = parseCookies(request.headers.cookie)[ACCESS_COOKIE];
    if (!token) return null;
    const session = await this.repository.findSessionByTokenHash(hashToken(token));
    if (!session || !session.user.active) return null;
    return { user: toAuthUser(session.user, this.featureFlags), sessionId: session.id };
  }

  async refresh(request: http.IncomingMessage): Promise<{ user: AuthenticatedPlatformUser; tokens: SessionTokens }> {
    const refreshToken = parseCookies(request.headers.cookie)[REFRESH_COOKIE];
    if (!refreshToken) throw new PlatformHttpError(401, "Refresh session is missing.", "SESSION_REQUIRED");
    const session = await this.repository.findSessionByRefreshHash(hashToken(refreshToken));
    if (!session || !session.user.active) throw new PlatformHttpError(401, "Refresh session is invalid.", "SESSION_INVALID");
    const tokens = await this.createSessionTokens(session.id, session.userId, request, true);
    return { user: toAuthUser(session.user, this.featureFlags), tokens };
  }

  async logout(request: http.IncomingMessage): Promise<void> {
    const current = await this.authenticate(request);
    if (current) {
      await this.repository.revokeSession(current.sessionId);
      return;
    }
    const refreshToken = parseCookies(request.headers.cookie)[REFRESH_COOKIE];
    if (refreshToken) {
      const session = await this.repository.findSessionByRefreshHash(hashToken(refreshToken));
      if (session) await this.repository.revokeSession(session.id);
    }
  }

  async acceptInvite(token: string, password: string): Promise<void> {
    validatePassword(password);
    const invite = await this.repository.consumeInvite(hashToken(token));
    if (!invite) throw new PlatformHttpError(400, "Invite is invalid or expired.", "INVITE_INVALID");
    await this.repository.setPassword(invite.userId, hashPassword(password), false);
    await this.repository.appendAudit({
      id: randomUUID(),
      actorId: invite.userId,
      action: "USER_PASSWORD_SET",
      entityType: "USER",
      entityId: invite.userId,
    });
  }

  async changePassword(userId: string, currentPassword: string, nextPassword: string): Promise<AuthenticatedPlatformUser> {
    validatePassword(nextPassword);
    const user = await this.repository.findUserById(userId);
    if (!user || !user.active || !user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new PlatformHttpError(400, "Current password is incorrect.", "CURRENT_PASSWORD_INVALID");
    }
    if (currentPassword === nextPassword) {
      throw new PlatformHttpError(400, "Choose a new password.", "PASSWORD_UNCHANGED");
    }
    await this.repository.setPassword(userId, hashPassword(nextPassword), false);
    await this.repository.appendAudit({
      id: randomUUID(),
      actorId: userId,
      action: "USER_PASSWORD_CHANGED",
      entityType: "USER",
      entityId: userId,
    });
    const updated = await this.repository.findUserById(userId);
    if (!updated) throw new PlatformHttpError(401, "Your account is no longer available.", "ACCOUNT_UNAVAILABLE");
    return toAuthUser(updated, this.featureFlags);
  }

  async createInvite(userId: string, createdBy: string): Promise<{ token: string; expiresAt: string }> {
    const token = createToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.repository.createInvite({
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      createdBy,
      expiresAt,
    });
    return { token, expiresAt };
  }

  private async createSession(userId: string, request: http.IncomingMessage): Promise<SessionTokens> {
    return this.createSessionTokens(randomUUID(), userId, request, false);
  }

  private async createSessionTokens(sessionId: string, userId: string, request: http.IncomingMessage, rotate: boolean): Promise<SessionTokens> {
    const accessToken = createToken();
    const refreshToken = createToken();
    const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
    const input = {
      sessionTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: accessExpiresAt,
      refreshExpiresAt,
    };
    if (rotate) {
      await this.repository.rotateSession(sessionId, input);
    } else {
      await this.repository.createSession({
        id: sessionId,
        userId,
        ...input,
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
        ipAddress: request.socket.remoteAddress ?? null,
      });
    }
    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, sessionId };
  }
}

export function requireAuthenticated(
  auth: { user: AuthenticatedPlatformUser } | null,
): AuthenticatedPlatformUser {
  if (!auth) throw new PlatformHttpError(401, "Authentication is required.", "AUTH_REQUIRED");
  return auth.user;
}

export function requirePermission(user: AuthenticatedPlatformUser, permission: PlatformPermission): void {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes(permission)) return;
  throw new PlatformHttpError(403, "You do not have permission to perform this action.", "FORBIDDEN");
}

export function requireAnyPermission(user: AuthenticatedPlatformUser, permissions: readonly PlatformPermission[]): void {
  if (permissions.some((permission) => user.permissions.includes("*" as PlatformPermission) || user.permissions.includes(permission))) return;
  throw new PlatformHttpError(403, "You do not have permission to perform this action.", "FORBIDDEN");
}

export function canAssignRoles(user: AuthenticatedPlatformUser, roles: readonly PlatformRole[]): boolean {
  if (roles.includes("SUPER_ADMIN")) return user.permissions.includes("system:manage" as PlatformPermission);
  return true;
}

export function manageableRolesForUser(user: AuthenticatedPlatformUser): PlatformRole[] {
  if (user.roles.includes("SUPER_ADMIN") || user.permissions.includes("system:manage" as PlatformPermission)) {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER", "SETTER", "CLOSER"];
  }
  if (user.roles.includes("ADMIN")) return ["MANAGER", "SETTER", "CLOSER"];
  if (user.roles.includes("MANAGER")) return ["SETTER", "CLOSER"];
  return [];
}

export function canManageUserRoles(
  user: AuthenticatedPlatformUser,
  targetRoles: readonly PlatformRole[],
  nextRoles: readonly PlatformRole[],
): boolean {
  const manageable = new Set(manageableRolesForUser(user));
  return [...targetRoles, ...nextRoles].every((role) => manageable.has(role));
}

/**
 * Permission grants access to a resource class; this helper applies the
 * relationship rule that keeps that permission inside the user's scope.
 */
export function requireResourceScope(
  user: AuthenticatedPlatformUser,
  resource: ResourceScope,
  permissions: {
    all: PlatformPermission;
    team: PlatformPermission;
    own: PlatformPermission;
  },
): void {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes(permissions.all)) return;
  if (user.permissions.includes(permissions.team) && resource.teamId && user.teamIds.includes(resource.teamId)) return;
  if (
    user.permissions.includes(permissions.own) &&
    [resource.createdByUserId, resource.setterId, resource.currentCloserId].includes(user.id)
  ) {
    return;
  }
  throw new PlatformHttpError(403, "You do not have access to this resource.", "RESOURCE_FORBIDDEN");
}

export function requireLeadScope(
  user: AuthenticatedPlatformUser,
  lead: ResourceScope,
): void {
  if (user.permissions.includes("*" as PlatformPermission) || user.permissions.includes("lead:view-all")) return;
  if (user.permissions.includes("lead:view-team") && lead.teamId && user.teamIds.includes(lead.teamId)) return;
  if (user.permissions.includes("lead:view-assigned") && lead.currentCloserId === user.id) return;
  requireResourceScope(user, lead, {
    all: "lead:view-all",
    team: "lead:view-team",
    own: "lead:view-own",
  });
}

export function toAuthUser(user: PlatformUserRecord, featureFlags: PlatformFeatureFlags): AuthenticatedPlatformUser {
  return {
    id: user.id,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone,
    active: user.active,
    mustChangePassword: Boolean(user.mustChangePassword),
    roles: user.roles,
    permissions: user.permissions,
    teamIds: user.teamIds,
    featureFlags,
    modules: resolvePlatformModules(user.permissions, featureFlags),
  };
}

export function hashPassword(password: string): string {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  try {
    const actual = scryptSync(password, salt, 64).toString("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(actual, "hex");
    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

export function validatePassword(password: string): void {
  if (typeof password !== "string" || password.length < 12) {
    throw new PlatformHttpError(400, "Password must be at least 12 characters.", "PASSWORD_POLICY");
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export function parseCookies(value: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of value?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(raw);
  }
  return cookies;
}

export function buildAuthCookies(tokens: SessionTokens, secure: boolean): string[] {
  const secureFlag = secure ? "; Secure" : "";
  const sameSite = secure ? "None" : "Lax";
  return [
    `${ACCESS_COOKIE}=${encodeURIComponent(tokens.accessToken)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.floor(ACCESS_TTL_MS / 1000)}${secureFlag}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(tokens.refreshToken)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.floor(REFRESH_TTL_MS / 1000)}${secureFlag}`,
  ];
}

export function clearAuthCookies(secure: boolean): string[] {
  const secureFlag = secure ? "; Secure" : "";
  const sameSite = secure ? "None" : "Lax";
  return [
    `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`,
    `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`,
  ];
}
