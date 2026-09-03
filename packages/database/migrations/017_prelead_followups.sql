-- Pre-lead follow-ups are lightweight setter records. They stay outside the
-- lead and appointment pipeline until a setter explicitly promotes them.
ALTER TABLE field_ops.follow_ups
  ALTER COLUMN lead_id DROP NOT NULL,
  ALTER COLUMN due_at DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES field_ops.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS homeowner_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS due_daypart TEXT,
  ADD COLUMN IF NOT EXISTS converted_lead_id UUID REFERENCES field_ops.leads(id) ON DELETE SET NULL;

ALTER TABLE field_ops.follow_ups
  DROP CONSTRAINT IF EXISTS follow_ups_status_check,
  ADD CONSTRAINT follow_ups_status_check CHECK (status IN (
    'OPEN', 'DONE', 'SNOOZED', 'CANCELLED', 'CONVERTED_TO_APPOINTMENT', 'CONVERTED'
  )),
  ADD CONSTRAINT follow_ups_schedule_check CHECK (due_at IS NOT NULL OR due_daypart IS NOT NULL);

UPDATE field_ops.follow_ups f
SET team_id = l.team_id,
    homeowner_name = CASE WHEN f.homeowner_name = '' THEN l.homeowner_name ELSE f.homeowner_name END,
    phone = COALESCE(f.phone, l.phone),
    email = COALESCE(f.email, l.email),
    address_line1 = CASE WHEN f.address_line1 = '' THEN l.address_line1 ELSE f.address_line1 END,
    city = COALESCE(f.city, l.city),
    state = COALESCE(f.state, l.state),
    postal_code = COALESCE(f.postal_code, l.postal_code),
    latitude = COALESCE(f.latitude, l.latitude),
    longitude = COALESCE(f.longitude, l.longitude)
FROM field_ops.leads l
WHERE l.id = f.lead_id;

CREATE INDEX IF NOT EXISTS idx_field_ops_follow_ups_team_status_due
  ON field_ops.follow_ups (team_id, status, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_follow_ups_converted_lead
  ON field_ops.follow_ups (converted_lead_id)
  WHERE converted_lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS field_ops.follow_up_activities (
  id UUID PRIMARY KEY,
  follow_up_id UUID NOT NULL REFERENCES field_ops.follow_ups(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test_data BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_field_ops_follow_up_activities_history
  ON field_ops.follow_up_activities (follow_up_id, created_at ASC);

ALTER TABLE field_ops.leads
  ADD COLUMN IF NOT EXISTS source_follow_up_id UUID REFERENCES field_ops.follow_ups(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_leads_source_follow_up
  ON field_ops.leads (source_follow_up_id)
  WHERE source_follow_up_id IS NOT NULL;

UPDATE field_ops.permissions
SET description = 'Create a lightweight pre-lead follow-up.'
WHERE id = 'followup:create';

UPDATE field_ops.permissions
SET description = 'Update owned pre-lead follow-ups.'
WHERE id = 'followup:update-own';
