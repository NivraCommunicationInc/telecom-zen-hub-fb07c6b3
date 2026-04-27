DELETE FROM services
WHERE id = (
  SELECT id FROM services
  WHERE name = 'GIGA + TV Basic'
  ORDER BY created_at ASC
  LIMIT 1
);