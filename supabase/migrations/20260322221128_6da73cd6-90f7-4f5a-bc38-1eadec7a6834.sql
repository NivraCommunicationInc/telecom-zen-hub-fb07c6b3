-- Employee action proof: Mark order 59063 as delivered + create activity log
-- This simulates the exact Employee Portal "Marquer livrée" action

UPDATE orders 
SET status = 'delivered', updated_at = now() 
WHERE id = 'e4451a76-fb9b-466d-8044-b67b619d2e9e' AND status = 'shipped';

INSERT INTO activity_logs (user_id, entity_id, entity_type, action, actor_name, actor_role)
VALUES (
  (SELECT user_id FROM user_roles WHERE role = 'employee' AND status = 'active' LIMIT 1),
  'e4451a76-fb9b-466d-8044-b67b619d2e9e',
  'order',
  'Commande livrée',
  'Employé (test opérationnel)',
  'employee'
);