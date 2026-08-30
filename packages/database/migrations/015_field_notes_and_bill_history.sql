-- Field notes and bills are append-oriented records. These columns make edits
-- and replacements explicit without destroying the previous operational value.
ALTER TABLE field_ops.notes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE field_ops.bill_attachments
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_field_ops_bills_current
  ON field_ops.bill_attachments (lead_id, created_at DESC)
  WHERE replaced_by IS NULL;

INSERT INTO field_ops.permissions (id, name, description)
VALUES ('bill:view-own', 'View own bills', 'View bills attached to leads owned by the current user.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO field_ops.role_permissions (role_id, permission_id)
VALUES ('SETTER', 'bill:view-own')
ON CONFLICT DO NOTHING;

-- Bill upload is a setter capture action. Assigned closers remain read-only
-- for the bill while manager/admin roles use bill:view-all.
DELETE FROM field_ops.role_permissions
WHERE role_id = 'CLOSER' AND permission_id = 'bill:upload';

INSERT INTO field_ops.role_permissions (role_id, permission_id)
VALUES
  ('MANAGER', 'bill:view-all'),
  ('ADMIN', 'bill:view-all')
ON CONFLICT DO NOTHING;
