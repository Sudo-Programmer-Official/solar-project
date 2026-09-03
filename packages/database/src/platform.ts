import type {
  PlatformPermission,
  PlatformRole,
} from "../../contracts/src/index";
import type { SqlClient } from "./repository";

export type CloserAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";

export interface PlatformUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  active: boolean;
  passwordHash: string | null;
  mustChangePassword?: boolean;
  lastLoginAt: string | null;
  roles: PlatformRole[];
  permissions: PlatformPermission[];
  teamIds: string[];
  availabilityStatus?: CloserAvailabilityStatus;
}

export interface PlatformSessionRecord {
  id: string;
  userId: string;
  sessionTokenHash: string;
  refreshTokenHash: string;
  expiresAt: string;
  refreshExpiresAt: string;
  revokedAt: string | null;
  user: PlatformUserRecord;
}

export interface TeamMemberRecord extends PlatformUserRecord {
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformUserInput {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  passwordHash?: string | null;
  mustChangePassword?: boolean;
}

export interface PlatformRepository {
  findUserByEmail(email: string): Promise<PlatformUserRecord | null>;
  findUserById(id: string): Promise<PlatformUserRecord | null>;
  listTeamMembers(): Promise<TeamMemberRecord[]>;
  listTeams(): Promise<Array<{ id: string; name: string }>>;
  createUser(input: CreatePlatformUserInput): Promise<TeamMemberRecord>;
  updateUser(id: string, input: { firstName?: string; lastName?: string; phone?: string | null; active?: boolean; availabilityStatus?: CloserAvailabilityStatus }): Promise<TeamMemberRecord | null>;
  replaceUserRoles(userId: string, roles: PlatformRole[], assignedBy?: string | null): Promise<TeamMemberRecord | null>;
  replaceUserTeams(userId: string, teamIds: string[], assignedBy?: string | null): Promise<TeamMemberRecord | null>;
  setPassword(userId: string, passwordHash: string, mustChangePassword?: boolean): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;
  createSession(input: {
    id: string;
    userId: string;
    sessionTokenHash: string;
    refreshTokenHash: string;
    expiresAt: string;
    refreshExpiresAt: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<PlatformSessionRecord | null>;
  findSessionByRefreshHash(refreshTokenHash: string): Promise<PlatformSessionRecord | null>;
  rotateSession(id: string, input: { sessionTokenHash: string; refreshTokenHash: string; expiresAt: string; refreshExpiresAt: string }): Promise<void>;
  revokeSession(id: string): Promise<void>;
  createInvite(input: { id: string; userId: string; tokenHash: string; createdBy: string; expiresAt: string }): Promise<void>;
  consumeInvite(tokenHash: string): Promise<{ inviteId: string; userId: string } | null>;
  appendAudit(input: { id: string; actorId: string | null; action: string; entityType: string; entityId?: string | null; details?: unknown }): Promise<void>;
}

const identitySelect = `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.active,
    u.password_hash,
    u.must_change_password,
    u.last_login_at,
    u.availability_status,
    u.created_at,
    u.updated_at,
    COALESCE(array_agg(DISTINCT ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), ARRAY[]::text[]) AS roles,
    COALESCE(array_agg(DISTINCT rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), ARRAY[]::text[]) AS permissions,
    COALESCE(array_agg(DISTINCT ut.team_id::text) FILTER (WHERE ut.team_id IS NOT NULL), ARRAY[]::text[]) AS team_ids
  FROM field_ops.users u
  LEFT JOIN field_ops.user_roles ur ON ur.user_id = u.id
  LEFT JOIN field_ops.role_permissions rp ON rp.role_id = ur.role_id
  LEFT JOIN field_ops.user_teams ut ON ut.user_id = u.id
`;

interface PlatformUserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  active: boolean;
  password_hash: string | null;
  must_change_password: boolean;
  last_login_at: string | Date | null;
  availability_status?: CloserAvailabilityStatus;
  created_at: string | Date;
  updated_at: string | Date;
  roles: string[];
  permissions: string[];
  team_ids: string[];
}

export class PostgresPlatformRepository implements PlatformRepository {
  constructor(private readonly client: SqlClient) {}

  async findUserByEmail(email: string): Promise<PlatformUserRecord | null> {
    const result = await this.client.query<PlatformUserRow>(`${identitySelect} WHERE LOWER(u.email) = LOWER($1) GROUP BY u.id`, [email]);
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<PlatformUserRecord | null> {
    const result = await this.client.query<PlatformUserRow>(`${identitySelect} WHERE u.id = $1 GROUP BY u.id`, [id]);
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async listTeamMembers(): Promise<TeamMemberRecord[]> {
    const result = await this.client.query<PlatformUserRow>(`${identitySelect} GROUP BY u.id ORDER BY u.active DESC, u.last_name, u.first_name`, []);
    return result.rows.map(toTeamMember);
  }

  async listTeams(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.client.query<{ id: string; name: string }>("SELECT id, name FROM field_ops.teams WHERE active = TRUE ORDER BY name", []);
    return result.rows;
  }

  async createUser(input: CreatePlatformUserInput): Promise<TeamMemberRecord> {
    await this.client.query(
      `INSERT INTO field_ops.users (id, first_name, last_name, email, phone, password_hash, must_change_password, active)
       VALUES ($1, $2, $3, LOWER($4), $5, $6, $7, TRUE)`,
      [input.id, input.firstName, input.lastName, input.email, input.phone ?? null, input.passwordHash ?? null, input.mustChangePassword ?? false],
    );
    const created = await this.findUserById(input.id);
    if (!created) throw new Error("Created user could not be loaded.");
    return {
      ...created,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateUser(id: string, input: { firstName?: string; lastName?: string; phone?: string | null; active?: boolean; availabilityStatus?: CloserAvailabilityStatus }): Promise<TeamMemberRecord | null> {
    const current = await this.findUserById(id);
    if (!current) return null;
    await this.client.query(
      `UPDATE field_ops.users
       SET first_name = $2, last_name = $3, phone = $4, active = $5,
           availability_status = $6, updated_at = NOW()
       WHERE id = $1`,
      [id, input.firstName ?? current.firstName, input.lastName ?? current.lastName, input.phone === undefined ? current.phone : input.phone, input.active ?? current.active, input.availabilityStatus ?? current.availabilityStatus ?? "AVAILABLE"],
    );
    const updated = await this.findUserById(id);
    return updated ? { ...updated, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : null;
  }

  async replaceUserRoles(userId: string, roles: PlatformRole[], assignedBy: string | null = null): Promise<TeamMemberRecord | null> {
    await this.client.query("DELETE FROM field_ops.user_roles WHERE user_id = $1", [userId]);
    for (const role of roles) {
      await this.client.query(
        `INSERT INTO field_ops.user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, role, assignedBy],
      );
    }
    const updated = await this.findUserById(userId);
    return updated ? { ...updated, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : null;
  }

  async replaceUserTeams(userId: string, teamIds: string[], assignedBy: string | null = null): Promise<TeamMemberRecord | null> {
    await this.client.query("DELETE FROM field_ops.user_teams WHERE user_id = $1", [userId]);
    for (const teamId of [...new Set(teamIds)]) {
      await this.client.query(
        `INSERT INTO field_ops.user_teams (user_id, team_id, assigned_by) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, team_id) DO NOTHING`,
        [userId, teamId, assignedBy],
      );
    }
    const updated = await this.findUserById(userId);
    return updated ? { ...updated, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : null;
  }

  async setPassword(userId: string, passwordHash: string, mustChangePassword = false): Promise<void> {
    await this.client.query("UPDATE field_ops.users SET password_hash = $2, must_change_password = $3, updated_at = NOW() WHERE id = $1", [userId, passwordHash, mustChangePassword]);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.client.query("UPDATE field_ops.users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1", [userId]);
  }

  async createSession(input: {
    id: string;
    userId: string;
    sessionTokenHash: string;
    refreshTokenHash: string;
    expiresAt: string;
    refreshExpiresAt: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    await this.client.query(
      `INSERT INTO field_ops.sessions
        (id, user_id, session_token_hash, refresh_token_hash, expires_at, refresh_expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [input.id, input.userId, input.sessionTokenHash, input.refreshTokenHash, input.expiresAt, input.refreshExpiresAt, input.userAgent ?? null, input.ipAddress ?? null],
    );
  }

  async findSessionByTokenHash(tokenHash: string): Promise<PlatformSessionRecord | null> {
    const result = await this.client.query<SessionRow>(`${sessionSelect} WHERE s.session_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW() GROUP BY s.id, u.id`, [tokenHash]);
    return result.rows[0] ? toSession(result.rows[0]) : null;
  }

  async findSessionByRefreshHash(refreshTokenHash: string): Promise<PlatformSessionRecord | null> {
    const result = await this.client.query<SessionRow>(`${sessionSelect} WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.refresh_expires_at > NOW() GROUP BY s.id, u.id`, [refreshTokenHash]);
    return result.rows[0] ? toSession(result.rows[0]) : null;
  }

  async rotateSession(id: string, input: { sessionTokenHash: string; refreshTokenHash: string; expiresAt: string; refreshExpiresAt: string }): Promise<void> {
    await this.client.query(
      `UPDATE field_ops.sessions
       SET session_token_hash = $2, refresh_token_hash = $3, expires_at = $4, refresh_expires_at = $5, last_seen_at = NOW()
       WHERE id = $1 AND revoked_at IS NULL`,
      [id, input.sessionTokenHash, input.refreshTokenHash, input.expiresAt, input.refreshExpiresAt],
    );
  }

  async revokeSession(id: string): Promise<void> {
    await this.client.query("UPDATE field_ops.sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL", [id]);
  }

  async createInvite(input: { id: string; userId: string; tokenHash: string; createdBy: string; expiresAt: string }): Promise<void> {
    await this.client.query(
      `INSERT INTO field_ops.invites (id, user_id, token_hash, created_by, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [input.id, input.userId, input.tokenHash, input.createdBy, input.expiresAt],
    );
  }

  async consumeInvite(tokenHash: string): Promise<{ inviteId: string; userId: string } | null> {
    const result = await this.client.query<{ id: string; user_id: string }>(
      `UPDATE field_ops.invites SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING id, user_id`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row ? { inviteId: row.id, userId: row.user_id } : null;
  }

  async appendAudit(input: { id: string; actorId: string | null; action: string; entityType: string; entityId?: string | null; details?: unknown }): Promise<void> {
    await this.client.query(
      `INSERT INTO field_ops.audit_log (id, actor_id, action, entity_type, entity_id, details_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [input.id, input.actorId, input.action, input.entityType, input.entityId ?? null, JSON.stringify(input.details ?? {})],
    );
  }
}

const sessionSelect = `
  SELECT s.id, s.user_id, s.session_token_hash, s.refresh_token_hash,
         s.expires_at, s.refresh_expires_at, s.revoked_at,
         u.id AS identity_id, u.first_name, u.last_name, u.email, u.phone,
         u.active, u.password_hash, u.last_login_at, u.created_at, u.updated_at,
         u.availability_status,
         u.must_change_password,
         COALESCE(array_agg(DISTINCT ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), ARRAY[]::text[]) AS roles,
         COALESCE(array_agg(DISTINCT rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), ARRAY[]::text[]) AS permissions,
         COALESCE(array_agg(DISTINCT ut.team_id::text) FILTER (WHERE ut.team_id IS NOT NULL), ARRAY[]::text[]) AS team_ids
  FROM field_ops.sessions s
  JOIN field_ops.users u ON u.id = s.user_id
  LEFT JOIN field_ops.user_roles ur ON ur.user_id = u.id
  LEFT JOIN field_ops.role_permissions rp ON rp.role_id = ur.role_id
  LEFT JOIN field_ops.user_teams ut ON ut.user_id = u.id
`;

interface SessionRow extends PlatformUserRow {
  id: string;
  user_id: string;
  identity_id: string;
  session_token_hash: string;
  refresh_token_hash: string;
  expires_at: string | Date;
  refresh_expires_at: string | Date;
  revoked_at: string | Date | null;
}

function toUser(row: PlatformUserRow): PlatformUserRecord {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    active: row.active,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password,
    lastLoginAt: toIso(row.last_login_at),
    roles: row.roles as PlatformRole[],
    permissions: row.permissions as PlatformPermission[],
    teamIds: row.team_ids,
    availabilityStatus: row.availability_status === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
  };
}

function toTeamMember(row: PlatformUserRow): TeamMemberRecord {
  return {
    ...toUser(row),
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function toSession(row: SessionRow): PlatformSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    sessionTokenHash: row.session_token_hash,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
    refreshExpiresAt: toIso(row.refresh_expires_at) ?? new Date(0).toISOString(),
    revokedAt: toIso(row.revoked_at),
    user: toUser({ ...row, id: row.identity_id }),
  };
}

function toIso(value: string | Date | null): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
