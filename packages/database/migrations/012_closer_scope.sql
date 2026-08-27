-- Keep the persisted RBAC defaults aligned with the field workflow: a pure
-- closer works assigned appointments, while SETTER+CLOSER gets lead capture
-- from the normalized role union.
DELETE FROM field_ops.role_permissions
WHERE role_id = 'CLOSER'
  AND permission_id IN ('lead:create', 'lead:view-own', 'appointment:create', 'appointment:view-own');

INSERT INTO field_ops.role_permissions (role_id, permission_id)
SELECT 'CLOSER', permission_id
FROM unnest(ARRAY[
  'lead:update-own', 'lead:view-assigned', 'appointment:view-assigned',
  'appointment:update-outcome', 'bill:upload', 'bill:view-assigned',
  'reports:view-own'
]) AS permission_id
ON CONFLICT DO NOTHING;
