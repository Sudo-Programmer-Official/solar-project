-- Canonical closer result values and time-window assignment support.
ALTER TABLE field_ops.appointments
  ADD COLUMN IF NOT EXISTS availability_slot_id UUID REFERENCES field_ops.closer_availability(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_availability_slot
  ON field_ops.appointments (availability_slot_id);

ALTER TABLE field_ops.appointments
  DROP CONSTRAINT IF EXISTS appointments_outcome_check;

-- Keep legacy values readable for existing records while restricting new API
-- writes to the canonical result set in the service layer.
ALTER TABLE field_ops.appointments
  ADD CONSTRAINT appointments_outcome_check CHECK (outcome IS NULL OR outcome IN (
    'CLOSED', 'SAT_NOT_CLOSED', 'DID_NOT_SIT', 'CREDIT_FAIL', 'NO_SHOW',
    'NOT_QUALIFIED', 'FOLLOW_UP', 'RESCHEDULED', 'CANCELLED',
    'SAT', 'PROPOSAL', 'NOT_INTERESTED'
  ));

-- A follow-up is a durable reminder attached to an existing lead. It is kept
-- separate from appointments because it may exist before a sales visit is
-- scheduled.
CREATE TABLE IF NOT EXISTS field_ops.follow_ups (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES field_ops.leads(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE RESTRICT,
  due_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'DONE', 'SNOOZED', 'CANCELLED', 'CONVERTED_TO_APPOINTMENT'
  )),
  created_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_appointment_id UUID REFERENCES field_ops.appointments(id) ON DELETE SET NULL,
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_field_ops_follow_ups_owner_due
  ON field_ops.follow_ups (owner_user_id, due_at, status);
CREATE INDEX IF NOT EXISTS idx_field_ops_follow_ups_lead
  ON field_ops.follow_ups (lead_id, due_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_follow_ups_team_due
  ON field_ops.follow_ups (due_at, status);

INSERT INTO field_ops.permissions (id, name, description)
VALUES
  ('followup:create', 'Create follow-ups', 'Create a reminder attached to a lead.'),
  ('followup:view-own', 'View own follow-ups', 'View follow-ups owned by the current user.'),
  ('followup:view-team', 'View team follow-ups', 'View follow-ups for the current team.'),
  ('followup:update-own', 'Update own follow-ups', 'Complete, snooze, or cancel owned follow-ups.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO field_ops.role_permissions (role_id, permission_id)
VALUES
  ('SETTER', 'followup:create'),
  ('SETTER', 'followup:view-own'),
  ('SETTER', 'followup:update-own'),
  ('CLOSER', 'followup:create'),
  ('CLOSER', 'followup:view-own'),
  ('CLOSER', 'followup:update-own'),
  ('MANAGER', 'followup:view-team'),
  ('ADMIN', 'followup:view-team')
ON CONFLICT DO NOTHING;
