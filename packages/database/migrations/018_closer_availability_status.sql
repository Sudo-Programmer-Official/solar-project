-- Closer availability is an operational status on the user, not a calendar
-- of publishable time windows. The legacy closer_availability table remains
-- readable for existing records and cleanup, but is no longer required for
-- assignment.
ALTER TABLE field_ops.users
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'AVAILABLE';

ALTER TABLE field_ops.users
  ALTER COLUMN availability_status SET DEFAULT 'AVAILABLE';

UPDATE field_ops.users
SET availability_status = 'AVAILABLE'
WHERE availability_status IS NULL;

ALTER TABLE field_ops.users
  ALTER COLUMN availability_status SET NOT NULL;

ALTER TABLE field_ops.users
  DROP CONSTRAINT IF EXISTS users_availability_status_check;

ALTER TABLE field_ops.users
  ADD CONSTRAINT users_availability_status_check
  CHECK (availability_status IN ('AVAILABLE', 'UNAVAILABLE'));

CREATE INDEX IF NOT EXISTS idx_field_ops_users_closer_availability
  ON field_ops.users (availability_status, active);

INSERT INTO field_ops.permissions (id, name, description)
VALUES (
  'availability:update-own',
  'Update own closer availability',
  'Mark your closer availability status.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO field_ops.role_permissions (role_id, permission_id)
VALUES ('CLOSER', 'availability:update-own')
ON CONFLICT DO NOTHING;
