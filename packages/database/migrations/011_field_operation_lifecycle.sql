-- Production identity and field-operation lifecycle additions.
INSERT INTO field_ops.teams (id, name, active)
VALUES ('00000000-0000-4000-8000-000000000100', 'Default Team', TRUE)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE field_ops.users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.closer_availability
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS booked_count INTEGER NOT NULL DEFAULT 0;

UPDATE field_ops.closer_availability
SET booked_count = CASE WHEN status = 'BOOKED' THEN GREATEST(booked_count, 1) ELSE booked_count END;

ALTER TABLE field_ops.closer_availability
  DROP CONSTRAINT IF EXISTS closer_availability_capacity_check,
  ADD CONSTRAINT closer_availability_capacity_check CHECK (capacity > 0 AND booked_count >= 0 AND booked_count <= capacity);

ALTER TABLE field_ops.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE field_ops.appointments
  ADD CONSTRAINT appointments_status_check CHECK (status IN (
    'UNASSIGNED', 'ASSIGNED', 'STARTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED', 'SCHEDULED'
  ));

ALTER TABLE field_ops.appointments
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_type TEXT NOT NULL DEFAULT 'SOLAR_CONSULTATION',
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT;

ALTER TABLE field_ops.notes
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES field_ops.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_ops_notes_appointment
  ON field_ops.notes (appointment_id, created_at DESC);

ALTER TABLE field_ops.appointments
  DROP CONSTRAINT IF EXISTS appointments_outcome_check;

ALTER TABLE field_ops.appointments
  ADD CONSTRAINT appointments_outcome_check CHECK (outcome IS NULL OR outcome IN (
    'NO_SHOW', 'SAT', 'PROPOSAL', 'CLOSED', 'FOLLOW_UP', 'NOT_QUALIFIED', 'CANCELLED', 'NOT_INTERESTED'
  ));

CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_unassigned
  ON field_ops.appointments (team_id, scheduled_start, status)
  WHERE status = 'UNASSIGNED';

-- Keep the database seed aligned with the shared permission contract. Managers
-- may record an administrative outcome when policy allows it; closers remain
-- restricted to their assigned appointment by the service scope checks.
INSERT INTO field_ops.role_permissions (role_id, permission_id)
VALUES ('MANAGER', 'appointment:update-outcome')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_field_ops_availability_capacity
  ON field_ops.closer_availability (closer_id, slot_start, status, booked_count, capacity);
