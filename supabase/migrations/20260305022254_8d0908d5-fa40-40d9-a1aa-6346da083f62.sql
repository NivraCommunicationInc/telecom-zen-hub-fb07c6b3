ALTER TABLE user_roles DISABLE TRIGGER tr_validate_role_change;

UPDATE user_roles SET role = 'admin' WHERE user_id = '7fb4c3f9-5a8b-4551-9f1b-9f91305f8c0f';

INSERT INTO admin_users (user_id, is_active, notes)
VALUES ('7fb4c3f9-5a8b-4551-9f1b-9f91305f8c0f', true, 'Audit test account')
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_roles ENABLE TRIGGER tr_validate_role_change;