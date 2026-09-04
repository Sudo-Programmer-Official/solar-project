-- Closers can capture a new lead from the field. Appointment assignment and
-- appointment creation remain separate permissions.
INSERT INTO field_ops.permissions (id, name, description)
VALUES (
  'lead:create',
  'Create leads',
  'Create a new lead.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO field_ops.role_permissions (role_id, permission_id)
VALUES ('CLOSER', 'lead:create')
ON CONFLICT DO NOTHING;

UPDATE field_ops.roles
SET description = 'Assigned appointments, outcomes, bills, lead capture, and lead context.'
WHERE id = 'CLOSER';
