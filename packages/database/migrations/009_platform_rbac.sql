-- Normalize authorization so a person can hold multiple operational roles.
-- The legacy field_ops.users.role column is retained for compatibility with
-- early development data, but new authorization reads user_roles instead.
CREATE TABLE IF NOT EXISTS field_ops.roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_ops.permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_ops.user_roles (
  user_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES field_ops.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_field_ops_user_roles_role
  ON field_ops.user_roles (role_id, user_id);

CREATE TABLE IF NOT EXISTS field_ops.role_permissions (
  role_id TEXT NOT NULL REFERENCES field_ops.roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES field_ops.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE field_ops.users
  ALTER COLUMN role DROP NOT NULL;

ALTER TABLE field_ops.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE field_ops.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

INSERT INTO field_ops.roles (id, name, description)
VALUES
  ('SUPER_ADMIN', 'Super Admin', 'Full platform access including Labs and system configuration.'),
  ('ADMIN', 'Admin', 'User administration, territory management, and team operations.'),
  ('MANAGER', 'Manager', 'Team operations, assignment, reporting, and territory visibility.'),
  ('SETTER', 'Setter', 'Lead capture, appointment creation, bills, and own pipeline.'),
  ('CLOSER', 'Closer', 'Assigned appointments, outcomes, bills, and lead context.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO field_ops.permissions (id, name, description)
VALUES
  ('lead:create', 'Create leads', 'Create a new lead.'),
  ('lead:view-own', 'View own leads', 'View leads created by the current user.'),
  ('lead:view-assigned', 'View assigned leads', 'View leads assigned to the current user.'),
  ('lead:view-team', 'View team leads', 'View leads belonging to the current team.'),
  ('lead:view-all', 'View all leads', 'View every lead in the company.'),
  ('lead:update-own', 'Update own leads', 'Edit leads created by the current user.'),
  ('lead:update-all', 'Update all leads', 'Edit any lead in the company.'),
  ('appointment:create', 'Create appointments', 'Create an appointment from a lead.'),
  ('appointment:view-own', 'View own appointments', 'View appointments created by the current user.'),
  ('appointment:view-assigned', 'View assigned appointments', 'View appointments assigned to the current user.'),
  ('appointment:view-team', 'View team appointments', 'View the team appointment schedule.'),
  ('appointment:assign', 'Assign appointments', 'Assign an unassigned appointment to a closer.'),
  ('appointment:reassign', 'Reassign appointments', 'Move an appointment between closers.'),
  ('appointment:update-outcome', 'Update appointment outcomes', 'Record sit, proposal, close, follow-up, or no-show outcomes.'),
  ('appointment:cancel', 'Cancel appointments', 'Cancel an appointment while preserving its history and reason.'),
  ('appointment:reschedule', 'Reschedule appointments', 'Move an appointment to another operational slot while preserving its identity.'),
  ('bill:upload', 'Upload bills', 'Upload a homeowner bill.'),
  ('bill:view-assigned', 'View assigned bills', 'View bills attached to assigned work.'),
  ('bill:view-all', 'View all bills', 'View bills across the company.'),
  ('team:view', 'View team', 'View team members and operational status.'),
  ('team:create-user', 'Create users', 'Invite or create a team member.'),
  ('team:update-user', 'Update users', 'Edit or deactivate a team member.'),
  ('team:assign-role', 'Assign roles', 'Add or remove operational roles.'),
  ('analytics:view', 'View analytics', 'View operational and territory analytics.'),
  ('reports:view', 'View reports', 'View operational reports.'),
  ('reports:view-own', 'View own reports', 'View personal performance reports.'),
  ('reports:export', 'Export reports', 'Export CSV or XLSX reports.'),
  ('territory:view', 'View territories', 'View territory performance and maps.'),
  ('territory:manage', 'Manage territories', 'Manage territory configuration.'),
  ('labs:view', 'View Labs', 'Access experimental lead finding and intelligence tools.'),
  ('system:manage', 'Manage system', 'Manage platform-level configuration and Super Admin access.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Preserve early users created with field_ops.users.role.
INSERT INTO field_ops.user_roles (user_id, role_id)
SELECT id, role
FROM field_ops.users
WHERE role IS NOT NULL
  AND role IN (SELECT id FROM field_ops.roles)
ON CONFLICT DO NOTHING;

-- Setter capabilities.
INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT 'SETTER', permission_id
FROM unnest(ARRAY[
  'lead:create', 'lead:view-own', 'lead:update-own', 'appointment:create',
  'appointment:view-own', 'bill:upload', 'reports:view-own'
]) AS permission_id
ON CONFLICT DO NOTHING;

-- Closer capabilities are limited to assigned appointment work. A user who
-- also has SETTER receives lead capture through the normalized role union.
INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT 'CLOSER', permission_id
FROM unnest(ARRAY[
  'lead:update-own', 'lead:view-assigned', 'appointment:view-assigned',
  'appointment:update-outcome', 'bill:upload', 'bill:view-assigned',
  'reports:view-own'
]) AS permission_id
ON CONFLICT DO NOTHING;

-- Manager capabilities.
INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT 'MANAGER', permission_id
FROM unnest(ARRAY[
  'lead:view-team', 'lead:update-all', 'appointment:view-team', 'appointment:assign',
  'appointment:reassign', 'team:view', 'team:create-user', 'team:update-user',
  'team:assign-role', 'analytics:view', 'reports:view',
  'reports:export', 'territory:view'
]) AS permission_id
ON CONFLICT DO NOTHING;

-- Admin capabilities include manager capabilities plus user and territory administration.
INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT 'ADMIN', permission_id
FROM unnest(ARRAY[
  'lead:view-team', 'lead:update-all', 'appointment:view-team', 'appointment:assign',
  'appointment:reassign', 'team:view', 'team:create-user', 'team:update-user',
  'team:assign-role', 'analytics:view', 'reports:view', 'reports:export',
  'territory:view', 'territory:manage'
]) AS permission_id
ON CONFLICT DO NOTHING;

-- Super Admin receives every permission, including Labs and system management.
INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', id
FROM field_ops.permissions
ON CONFLICT DO NOTHING;
