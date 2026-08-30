-- Operational slots are the shared schedule capacity. They are deliberately
-- separate from closer_availability: a team can book the standard schedule
-- before a manager assigns a specific closer.
CREATE TABLE IF NOT EXISTS field_ops.operational_slot_definitions (
  id TEXT PRIMARY KEY,
  start_time TIME NOT NULL UNIQUE,
  duration_minutes INTEGER NOT NULL DEFAULT 120 CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  standard_capacity INTEGER NOT NULL DEFAULT 1 CHECK (standard_capacity > 0),
  overflow_policy TEXT NOT NULL DEFAULT 'ALLOW_WITH_WARNING' CHECK (overflow_policy IN ('ALLOW_WITH_WARNING', 'BLOCK')),
  source TEXT NOT NULL DEFAULT 'OFFICIAL_SCHEDULE_TEMPLATE',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time IN (TIME '10:00', TIME '12:00', TIME '14:00', TIME '16:00', TIME '18:00', TIME '20:00'))
);

INSERT INTO field_ops.operational_slot_definitions (id, start_time, duration_minutes, standard_capacity, overflow_policy, source)
VALUES
  ('SLOT_10_00', '10:00', 120, 1, 'ALLOW_WITH_WARNING', 'OFFICIAL_SCHEDULE_TEMPLATE'),
  ('SLOT_12_00', '12:00', 120, 1, 'ALLOW_WITH_WARNING', 'OFFICIAL_SCHEDULE_TEMPLATE'),
  ('SLOT_14_00', '14:00', 120, 1, 'ALLOW_WITH_WARNING', 'OFFICIAL_SCHEDULE_TEMPLATE'),
  ('SLOT_16_00', '16:00', 120, 1, 'ALLOW_WITH_WARNING', 'OFFICIAL_SCHEDULE_TEMPLATE'),
  ('SLOT_18_00', '18:00', 120, 1, 'ALLOW_WITH_WARNING', 'OFFICIAL_SCHEDULE_TEMPLATE'),
  ('SLOT_20_00', '20:00', 120, 1, 'ALLOW_WITH_WARNING', 'OFFICIAL_SCHEDULE_TEMPLATE')
ON CONFLICT (id) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  duration_minutes = EXCLUDED.duration_minutes,
  source = EXCLUDED.source,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS field_ops.operational_slots (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES field_ops.teams(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_definition_id TEXT NOT NULL REFERENCES field_ops.operational_slot_definitions(id) ON DELETE RESTRICT,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  standard_capacity INTEGER NOT NULL CHECK (standard_capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  overflow_count INTEGER NOT NULL DEFAULT 0 CHECK (overflow_count >= 0),
  overflow_policy TEXT NOT NULL DEFAULT 'ALLOW_WITH_WARNING' CHECK (overflow_policy IN ('ALLOW_WITH_WARNING', 'BLOCK')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'BLOCKED')),
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (slot_end > slot_start)
);

ALTER TABLE field_ops.operational_slots
  ADD COLUMN IF NOT EXISTS overflow_policy TEXT NOT NULL DEFAULT 'ALLOW_WITH_WARNING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_operational_slots_global
  ON field_ops.operational_slots (slot_date, slot_definition_id)
  WHERE team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_operational_slots_team
  ON field_ops.operational_slots (team_id, slot_date, slot_definition_id)
  WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_field_ops_operational_slots_window
  ON field_ops.operational_slots (slot_start, slot_end, status);

ALTER TABLE field_ops.appointments
  ADD COLUMN IF NOT EXISTS operational_slot_id UUID REFERENCES field_ops.operational_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_overflow BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_operational_slot
  ON field_ops.appointments (operational_slot_id, status);
CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_overflow
  ON field_ops.appointments (is_overflow, scheduled_start)
  WHERE is_overflow = TRUE;

INSERT INTO field_ops.permissions (id, name, description)
VALUES
  ('appointment:cancel', 'Cancel appointments', 'Cancel an appointment while preserving its history and reason.'),
  ('appointment:reschedule', 'Reschedule appointments', 'Move an appointment to another operational slot while preserving its identity.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT role_id, permission_id
FROM (VALUES
  ('SETTER', 'appointment:cancel'), ('SETTER', 'appointment:reschedule'),
  ('CLOSER', 'appointment:cancel'), ('CLOSER', 'appointment:reschedule'),
  ('MANAGER', 'appointment:cancel'), ('MANAGER', 'appointment:reschedule'),
  ('ADMIN', 'appointment:cancel'), ('ADMIN', 'appointment:reschedule'),
  ('SUPER_ADMIN', 'appointment:cancel'), ('SUPER_ADMIN', 'appointment:reschedule')
) AS grants(role_id, permission_id)
ON CONFLICT DO NOTHING;
