-- Mark development-only field fixtures explicitly so QA cleanup never needs
-- to delete from the operational tables by date, owner, or status.
ALTER TABLE field_ops.leads
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.closer_availability
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.appointments
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.notes
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.bill_attachments
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.activities
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE field_ops.sheet_sync_jobs
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

-- The original QA seed predates this discriminator. These are the only
-- deterministic fixture IDs used by that seed; related rows are marked by
-- their foreign keys below.
UPDATE field_ops.leads
SET is_test_data = TRUE
WHERE id = ANY(ARRAY[
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000222',
  '00000000-0000-4000-8000-000000000223',
  '00000000-0000-4000-8000-000000000224',
  '00000000-0000-4000-8000-000000000225',
  -- Legacy QA fixture IDs created before the current seed layout.
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000203',
  '00000000-0000-4000-8000-000000000204',
  '00000000-0000-4000-8000-000000000205'
]::uuid[]);

UPDATE field_ops.closer_availability
SET is_test_data = TRUE
WHERE id = ANY(ARRAY[
  '00000000-0000-4000-8000-000000000321',
  '00000000-0000-4000-8000-000000000322',
  '00000000-0000-4000-8000-000000000323',
  '00000000-0000-4000-8000-000000000324',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000303'
]::uuid[]);

UPDATE field_ops.appointments
SET is_test_data = TRUE
WHERE id = ANY(ARRAY[
  '00000000-0000-4000-8000-000000000421',
  '00000000-0000-4000-8000-000000000422',
  '00000000-0000-4000-8000-000000000423',
  '00000000-0000-4000-8000-000000000424',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000402',
  '00000000-0000-4000-8000-000000000403'
]::uuid[]);

UPDATE field_ops.notes
SET is_test_data = TRUE
WHERE lead_id IN (SELECT id FROM field_ops.leads WHERE is_test_data)
   OR appointment_id IN (SELECT id FROM field_ops.appointments WHERE is_test_data);

UPDATE field_ops.bill_attachments
SET is_test_data = TRUE
WHERE lead_id IN (SELECT id FROM field_ops.leads WHERE is_test_data);

UPDATE field_ops.activities
SET is_test_data = TRUE
WHERE lead_id IN (SELECT id FROM field_ops.leads WHERE is_test_data);

UPDATE field_ops.sheet_sync_jobs
SET is_test_data = TRUE
WHERE lead_id IN (SELECT id FROM field_ops.leads WHERE is_test_data);

CREATE INDEX IF NOT EXISTS idx_field_ops_leads_test_data
  ON field_ops.leads (is_test_data, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_appointments_test_data
  ON field_ops.appointments (is_test_data, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_ops_availability_test_data
  ON field_ops.closer_availability (is_test_data, created_at DESC);
