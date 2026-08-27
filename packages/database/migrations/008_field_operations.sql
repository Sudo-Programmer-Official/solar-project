-- Field operations owns the setter/closer workflow. It intentionally lives
-- beside, not inside, the lead-discovery public tables and the intelligence
-- sales/analytics schemas.
CREATE SCHEMA IF NOT EXISTS field_ops;

CREATE TABLE IF NOT EXISTS field_ops.users (
  id UUID PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('SETTER', 'CLOSER', 'ADMIN')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_users_role_active
  ON field_ops.users (role, active);

CREATE TABLE IF NOT EXISTS field_ops.leads (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  setter_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  current_closer_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  homeowner_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address_line1 TEXT NOT NULL,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  utility TEXT,
  supplier TEXT,
  approximate_monthly_bill NUMERIC,
  qualification_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'KNOCKED' CHECK (status IN (
    'KNOCKED', 'INTERESTED', 'FOLLOW_UP', 'APPOINTMENT_SET', 'NO_SHOW',
    'SAT', 'PROPOSAL', 'CLOSED', 'NOT_INTERESTED', 'NOT_QUALIFIED', 'CANCELLED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_leads_setter_status
  ON field_ops.leads (setter_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_leads_closer_status
  ON field_ops.leads (current_closer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_leads_property
  ON field_ops.leads (property_id);

CREATE TABLE IF NOT EXISTS field_ops.closer_availability (
  id UUID PRIMARY KEY,
  closer_id UUID NOT NULL REFERENCES field_ops.users(id) ON DELETE CASCADE,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BLOCKED', 'BOOKED')),
  source TEXT NOT NULL DEFAULT 'MANUAL',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (slot_end > slot_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_closer_slot_start
  ON field_ops.closer_availability (closer_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_field_ops_closer_availability_window
  ON field_ops.closer_availability (slot_start, slot_end, status);

CREATE TABLE IF NOT EXISTS field_ops.appointments (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES field_ops.leads(id) ON DELETE CASCADE,
  setter_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  closer_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'STARTED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED')),
  outcome TEXT CHECK (outcome IN ('NO_SHOW', 'SAT', 'PROPOSAL', 'CLOSED', 'FOLLOW_UP', 'NOT_QUALIFIED', 'CANCELLED')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deal_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_closer_window
  ON field_ops.appointments (closer_id, scheduled_start, status);
CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_lead
  ON field_ops.appointments (lead_id, scheduled_start DESC);

CREATE TABLE IF NOT EXISTS field_ops.notes (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES field_ops.leads(id) ON DELETE CASCADE,
  author_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'TEXT' CHECK (kind IN ('TEXT', 'VOICE')),
  body TEXT,
  audio_storage_key TEXT,
  audio_duration_seconds INTEGER,
  transcript TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body IS NOT NULL OR audio_storage_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_field_ops_notes_lead_created
  ON field_ops.notes (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS field_ops.bill_attachments (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES field_ops.leads(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  replaced_by UUID REFERENCES field_ops.bill_attachments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_bills_lead_created
  ON field_ops.bill_attachments (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS field_ops.activities (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES field_ops.leads(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES field_ops.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_ops_activities_lead_created
  ON field_ops.activities (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS field_ops.sheet_sync_jobs (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES field_ops.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SYNCED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_field_ops_sheet_sync_lead
  ON field_ops.sheet_sync_jobs (lead_id);
CREATE INDEX IF NOT EXISTS idx_field_ops_sheet_sync_pending
  ON field_ops.sheet_sync_jobs (status, next_attempt_at);
