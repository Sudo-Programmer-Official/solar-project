CREATE TABLE IF NOT EXISTS field_ops.sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_sessions_user
  ON field_ops.sessions (user_id, revoked_at, refresh_expires_at);
CREATE INDEX IF NOT EXISTS idx_field_ops_sessions_expiry
  ON field_ops.sessions (expires_at, refresh_expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS field_ops.invites (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_invites_user
  ON field_ops.invites (user_id, used_at, expires_at);

CREATE TABLE IF NOT EXISTS field_ops.audit_log (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_audit_entity
  ON field_ops.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_audit_actor
  ON field_ops.audit_log (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS field_ops.teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_ops.user_teams (
  user_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES field_ops.teams(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_field_ops_user_teams_team
  ON field_ops.user_teams (team_id, user_id);

ALTER TABLE field_ops.leads
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL;

ALTER TABLE field_ops.leads
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES field_ops.teams(id) ON DELETE SET NULL;

UPDATE field_ops.leads
SET created_by_user_id = setter_id
WHERE created_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_field_ops_leads_creator
  ON field_ops.leads (created_by_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_leads_team
  ON field_ops.leads (team_id, updated_at DESC);

ALTER TABLE field_ops.appointments
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES field_ops.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_team_window
  ON field_ops.appointments (team_id, scheduled_start, status);
